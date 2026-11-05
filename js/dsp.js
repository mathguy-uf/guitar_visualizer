(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.GuitarDSP = api;
})(globalThis, () => {
    'use strict';
    const hz = m => 440 * 2 ** ((m - 69) / 12);

    function prepare(input, rate) {
        const stride = Math.max(1, Math.floor(rate / 12000)),
            x = new Float32Array(Math.floor(input.length / stride));
        let mean = 0;
        for (let i = 0; i < x.length; i++) {
            for (let j = 0; j < stride; j++) x[i] += input[i * stride + j] / stride;
            mean += x[i];
        }
        mean /= x.length;
        let energy = 0;
        for (let i = 0; i < x.length; i++) {
            x[i] -= mean;
            energy += x[i] * x[i];
        }
        return {
            x,
            rate: rate / stride,
            rms: Math.sqrt(energy / x.length)
        };
    }

    function yin(x, rate) {
        const min = Math.floor(rate / 1050),
            max = Math.min(Math.ceil(rate / 75), Math.floor(x.length / 2) - 1),
            size = x.length - max;
        const d = new Float32Array(max + 1);
        let sum = 0;
        for (let tau = 1; tau <= max; tau++) {
            let v = 0;
            for (let i = 0; i < size; i++) {
                const z = x[i] - x[i + tau];
                v += z * z;
            }
            sum += v;
            d[tau] = sum ? v * tau / sum : 1;
        }
        for (let tau = min; tau < max; tau++)
            if (d[tau] < .18) {
                while (tau + 1 < max && d[tau + 1] < d[tau]) tau++;
                if (tau <= min || tau >= max) return null;
                const den = d[tau - 1] - 2 * d[tau] + d[tau + 1];
                const delta = den ? .5 * (d[tau - 1] - d[tau + 1]) / den : 0;
                const f = rate / (tau + Math.max(-1, Math.min(1, delta)));
                return {
                    midi: 69 + 12 * Math.log2(f / 440),
                    confidence: 1 - d[tau]
                };
            }
        return null;
    }
    // Windowed correlation at candidate fundamentals. A higher note needs its
    // own fundamental evidence; a bass harmonic alone is not a second string.
    function amplitude(x, rate, f, windowed = false) {
        const coefficient = 2 * Math.cos(2 * Math.PI * f / rate);
        let a = 0,
            b = 0;
        for (let i = 0; i < x.length; i++) {
            const sample = windowed ? x[i] : x[i] * (.5 - .5 * Math.cos(2 * Math.PI * i / (x.length - 1)));
            const next = sample + coefficient * a - b;
            b = a;
            a = next;
        }
        return 4 * Math.sqrt(Math.max(0, a * a + b * b - coefficient * a * b)) / x.length;
    }

    function analyse(input, rate, expected = [], floor = .004) {
        const p = prepare(input, rate),
            {
                x,
                rms
            } = p;
        if (rms < floor) return {
            rms,
            pitches: [],
            confidence: 0,
            energy: [],
            mono: null
        };
        // Use a short causal envelope for attacks. The full pitch window keeps
        // filling after a pluck and must not look like a second pluck.
        let tailSum = 0,
            tailEnergy = 0;
        const tailLength = Math.min(1024, input.length);
        for (let i = input.length - tailLength; i < input.length; i++) {
            tailSum += input[i];
            tailEnergy += input[i] * input[i];
        }
        const attackRms = Math.sqrt(Math.max(0, tailEnergy / tailLength - (tailSum / tailLength) ** 2));
        const mono = yin(x, p.rate);
        const candidates = [...new Set([...expected, ...Array.from({
            length: 37
        }, (_, i) => i + 40)])];
        const windowed = x.map((v, i) => v * (.5 - .5 * Math.cos(2 * Math.PI * i / (x.length - 1))));
        const energy = candidates.map(m => ({
            midi: m,
            amplitude: amplitude(windowed, p.rate, hz(m), true)
        }));
        const strength = m => energy.find(e => e.midi === m)?.amplitude || 0;
        if (expected.length <= 1) return {
            rms,
            attackRms,
            pitches: mono ? [mono.midi] : [],
            confidence: mono?.confidence || 0,
            energy,
            mono,
            expected,
            floor
        };
        const max = Math.max(...energy.map(e => e.amplitude), .00001),
            found = [];
        for (const m of expected) {
            const a = strength(m);
            const lower = energy.filter(e => e.midi < m &&
                Math.abs(hz(m) / hz(e.midi) - Math.round(hz(m) / hz(e.midi))) < .035 &&
                e.amplitude > max * .15 &&
                e.amplitude >= strength(e.midi - 1) && e.amplitude >= strength(e.midi + 1));
            // Octave pinches cannot be separated reliably from natural guitar
            // harmonics here. Keep them uncertain rather than guessing.
            if (lower.length) continue;
            if (a > max * .14 && a > floor * 1.5) found.push(m);
        }
        return {
            rms,
            attackRms,
            pitches: found,
            confidence: found.length === expected.length ? .8 : .35,
            energy,
            mono,
            expected,
            floor
        };
    }
    class AttackGate {
        constructor() {
            this.reset();
        }
        reset() {
            this.lastEnergy = [];
            this.previous = 0;
            this.envelopeValley = 0;
            this.lastAttack = -Infinity;
            this.pending = null;
            this.lastExpected = null;
        }
        process(result, time) {
            const prior = new Map(this.lastEnergy.map(e => [e.midi, e.amplitude]));
            let novelty = 0,
                total = 0;
            const deltas = new Map();
            for (const e of result.energy) {
                const delta = Math.max(0, e.amplitude - (prior.get(e.midi) || 0));
                deltas.set(e.midi, delta);
                novelty += delta;
                total += e.amplitude;
            }
            const envelope = result.attackRms ?? result.rms;
            if (envelope < this.previous) this.envelopeValley = envelope;
            const rise = envelope > this.envelopeValley * 1.20 && envelope > .005;
            const signature = result.expected?.join(',') || '';
            const targetChanged = this.lastExpected !== null && signature !== this.lastExpected;
            const largestDelta = Math.max(...deltas.values(), .00001);
            const freshTarget = result.expected?.some(midi => {
                const delta = deltas.get(midi) || 0;
                const harmonicRise = result.energy.some(e => e.midi < midi &&
                    Math.abs(hz(midi) / hz(e.midi) - Math.round(hz(midi) / hz(e.midi))) < .035 &&
                    (deltas.get(e.midi) || 0) > delta * .9);
                return delta > Math.max((result.floor || .004) * .75, largestDelta * .25) && !harmonicRise;
            });
            const onset = (rise || (targetChanged && freshTarget && novelty / Math.max(total, .0001) > .10)) &&
                envelope > .004 && time - this.lastAttack > .04;
            if (onset && !this.pending) {
                this.pending = {
                    time,
                    tries: 0,
                    baseline: prior,
                    pinchAttacks: new Set()
                };
                this.lastAttack = time;
                this.lastExpected = signature;
                this.envelopeValley = envelope;
            }
            this.previous = envelope;
            this.lastEnergy = result.energy;
            if (this.pending) {
                this.pending.tries++;
                // During rolls, ringing bass can dominate a monophonic estimate.
                // Look for NEW energy at the expected pitch, compared with the
                // previous frame, and reject energy explained by a new lower
                // harmonic. This does not infer a physical string or finger.
                if (result.expected?.length === 1) {
                    const target = result.expected[0],
                        delta = deltas.get(target) || 0;
                    const amplitude = result.energy.find(e => e.midi === target)?.amplitude || 0;
                    const largestDelta = Math.max(...deltas.values(), .00001);
                    const lowerAttack = result.energy.some(e => e.midi < target && Math.abs(hz(target) / hz(e.midi) - Math.round(hz(target) / hz(e.midi))) < .035 && (deltas.get(e.midi) || 0) > delta * .9);
                    const neighbors = result.energy.filter(e => Math.abs(e.midi - target) === 1);
                    const locallyStrong = neighbors.every(e => amplitude > e.amplitude * 1.02);
                    if (delta > largestDelta * .35 && amplitude > (result.floor || .004) * 2 && locallyStrong && !lowerAttack && (!result.mono || Math.abs(result.mono.midi - target) > 3)) {
                        result = {
                            ...result,
                            pitches: [target],
                            confidence: .74
                        };
                    }
                }
                // A pinch needs fresh energy at every constituent pitch.
                // An old ringing bass plus a new treble attack is not a pinch.
                const pinch = result.expected?.length > 1;
                if (pinch) {
                    for (const midi of result.pitches) {
                        const before = this.pending.baseline.get(midi) || 0;
                        const amplitude = result.energy.find(e => e.midi === midi)?.amplitude || 0;
                        if (amplitude - before > Math.max((result.floor || .004) * .75, before * .12)) {
                            this.pending.pinchAttacks.add(midi);
                        }
                    }
                    const fresh = result.pitches.filter(midi => this.pending.pinchAttacks.has(midi));
                    if (fresh.length < result.expected.length) result = {
                        ...result,
                        pitches: fresh,
                        confidence: .35
                    };
                }
                // Allow settling across several windows before calling a pinch uncertain.
                if (result.pitches.length && result.confidence >= (pinch ? .72 : .6)) {
                    const event = {
                        ...result,
                        time: this.pending.time
                    };
                    this.pending = null;
                    return event;
                }
                if (this.pending.tries >= 5) {
                    const event = {
                        ...result,
                        time: this.pending.time
                    };
                    this.pending = null;
                    return event;
                }
            }
            return null;
        }
    }
    return {
        prepare,
        yin,
        amplitude,
        analyse,
        AttackGate
    };
});
