/* Musical time is measured in integer ticks: 960 per quarter note. */
(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.GuitarMusic = api;
})(globalThis, () => {
    'use strict';
    const PPQ = 960;
    const tuning = [64, 59, 55, 50, 45, 40]; // TAB order: high e first.
    const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
    const noteName = midi => ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'][((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
    const barTicks = meter => meter[0] * PPQ * 4 / meter[1];
    // Swing warps the second eighth inside each quarter. Triplets and other
    // tuplets remain straight. Positions and durations share the same mapping.
    function swungTick(tick, swing = 0, straight = false) {
        if (!swing || straight || tick < 0) return tick;
        const beat = Math.floor(tick / PPQ),
            fraction = tick / PPQ - beat;
        const split = 0.5 + Math.max(0, Math.min(1, swing)) / 6;
        return (beat + (fraction < .5 ? fraction * split * 2 : split + (fraction - .5) * (1 - split) * 2)) * PPQ;
    }

    function compile(exercise, swing = 0) {
        const groups = new Map();
        for (const e of exercise.events) {
            if (!Number.isInteger(e.tick) || e.tick < 0 || !Number.isInteger(e.duration) || e.duration <= 0) throw Error('Invalid event time');
            if (e.tick + e.duration > exercise.length) throw Error('Event exceeds exercise');
            const notes = e.notes || [];
            for (const n of notes)
                if (!(n.string >= 1 && n.string <= 6 && n.fret >= 0 && n.fret <= 24)) throw Error('Invalid TAB position');
            const tick = swungTick(e.tick, swing, e.straight);
            const end = swungTick(e.tick + e.duration, swing, e.straight);
            if (!groups.has(tick)) groups.set(tick, {
                tick,
                duration: end - tick,
                notes: [],
                accent: false,
                rest: true
            });
            const group = groups.get(tick);
            group.duration = Math.max(group.duration, end - tick);
            group.accent ||= !!e.accent;
            for (const n of notes) {
                const note = {
                    ...n,
                    midi: tuning[n.string - 1] + n.fret,
                    voice: e.voice || 'treble',
                    tie: !!e.tie,
                    duration: end - tick
                };
                group.notes.push(note);
                if (!e.tie) group.rest = false;
            }
        }
        return [...groups.values()].sort((a, b) => a.tick - b.tick).map((g, id) => ({
            ...g,
            id,
            targets: [...new Set(g.notes.filter(n => !n.tie).map(n => n.midi))]
        }));
    }
    class Transport {
        constructor(now = () => 0, bpm = 60) {
            this.now = now;
            this.bpm = bpm;
            this.tick = 0;
            this.running = false;
            this.anchor = 0;
        }
        position(time = this.now()) {
            return this.tick + (this.running ? (time - this.anchor) * this.bpm / 60 * PPQ : 0);
        }
        start(tick = this.tick) {
            this.tick = tick;
            this.anchor = this.now();
            this.running = true;
        }
        pause() {
            this.tick = this.position();
            this.running = false;
        }
        seek(tick) {
            this.tick = tick;
            this.anchor = this.now();
        }
        setTempo(bpm) {
            this.tick = this.position();
            this.anchor = this.now();
            this.bpm = Math.max(30, Math.min(180, Number(bpm) || 60));
        }
        timeAt(tick) {
            return this.anchor + (tick - this.tick) / PPQ * 60 / this.bpm;
        }
    }
    class Session {
        constructor(events, mode = 'rhythm', tolerance = .18) {
            this.events = events;
            this.mode = mode;
            this.tolerance = tolerance;
            this.results = new Map();
            this.extras = 0;
            this.wrong = 0;
            this.streak = 0;
            this.best = 0;
        }
        next() {
            return this.events.find(e => e.targets.length && !this.results.has(e.id));
        }
        expire(tick, bpm) {
            const margin = this.tolerance * bpm / 60 * PPQ;
            if (this.mode === 'learn') return;
            for (const e of this.events)
                if (e.targets.length && !this.results.has(e.id) && tick > e.tick + margin) {
                    this.results.set(e.id, {
                        kind: 'missed'
                    });
                    this.streak = 0;
                }
        }
        input({
            tick,
            pitches,
            confidence = 1
        }, bpm) {
            const available = this.events.filter(e => e.targets.length && !this.results.has(e.id));
            const e = this.mode === 'learn' ? available[0] : available.reduce((best, e) => !best || Math.abs(e.tick - tick) < Math.abs(best.tick - tick) ? e : best, null);
            if (!e) {
                this.extras++;
                return {
                    kind: 'extra'
                };
            }
            const seconds = (tick - e.tick) / PPQ * 60 / bpm;
            if (this.mode === 'rhythm' && Math.abs(seconds) > this.tolerance) {
                this.extras++;
                this.streak = 0;
                return {
                    kind: 'extra'
                };
            }
            const match = e.targets.every(m => pitches.some(p => Math.abs(p - m) <= .45));
            // Partial/ambiguous pinches remain open for a retry and are reported
            // separately at the end; they never become a wrong-pitch penalty.
            if (e.targets.length > 1 && (!match || confidence < .72)) {
                this.results.set(e.id, {
                    kind: 'uncertain'
                });
                if (this.mode === 'learn') this.results.delete(e.id);
                return {
                    kind: 'uncertain',
                    event: e
                };
            }
            if (confidence < .60 || !pitches.length) return {
                kind: 'uncertain',
                event: e
            };
            if (!match) {
                this.wrong++;
                this.streak = 0;
                return {
                    kind: 'wrong',
                    event: e
                };
            }
            const kind = this.mode === 'learn' || Math.abs(seconds) <= .065 ? 'correct' : seconds < 0 ? 'early' : 'late';
            const unexpected = pitches.filter(p => !e.targets.some(m => Math.abs(p - m) <= .45));
            this.extras += unexpected.length;
            const result = {
                kind,
                seconds,
                event: e,
                extra: unexpected.length
            };
            this.results.set(e.id, result);
            this.streak++;
            this.best = Math.max(this.best, this.streak);
            return result;
        }
        summary() {
            const values = [...this.results.values()];
            const hits = values.filter(r => ['correct', 'early', 'late'].includes(r.kind));
            const judged = values.filter(r => r.kind !== 'uncertain');
            return {
                total: this.events.filter(e => e.targets.length).length,
                hits: hits.length,
                onTime: values.filter(r => r.kind === 'correct').length,
                missed: values.filter(r => r.kind === 'missed').length,
                uncertain: values.filter(r => r.kind === 'uncertain').length,
                wrong: this.wrong,
                extras: this.extras,
                best: this.best,
                accuracy: judged.length ? Math.round(100 * hits.length / judged.length) : null,
                meanMs: hits.length ? Math.round(hits.reduce((s, r) => s + Math.abs(r.seconds), 0) / hits.length * 1000) : null
            };
        }
    }
    return {
        PPQ,
        tuning,
        frequency,
        noteName,
        barTicks,
        swungTick,
        compile,
        Transport,
        Session
    };
});
