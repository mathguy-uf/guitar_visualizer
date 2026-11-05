const {
    test
} = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/dsp.js');
const hz = m => 440 * 2 ** ((m - 69) / 12);

// A deterministic plucked-string fixture: finite attack, harmonic partials,
// frequency-dependent decay, pick noise, detuning, and overlapping sustain.
function plucks(notes, rate = 48000, start = 0, length = 4096) {
    return Float32Array.from({
        length
    }, (_, i) => {
        const time = start + i / rate;
        let sample = 0;
        for (const note of notes) {
            const t = time - note.time;
            if (t < 0) continue;
            const f = hz(note.midi) * 2 ** ((note.cents || 0) / 1200);
            const envelope = (1 - Math.exp(-t / .0015)) * Math.exp(-t / (note.decay || .32));
            for (let harmonic = 1; harmonic <= 6; harmonic++) {
                const weight = [1, .4, .24, .15, .08, .05][harmonic - 1];
                sample += (note.level || .07) * envelope * weight * Math.exp(-t * harmonic * .7) * Math.sin(2 * Math.PI * f * harmonic * t + (note.phase || 0));
            }
            sample += (note.level || .07) * .08 * Math.exp(-t / .007) * Math.sin(t * 27931);
        }
        return sample + .00015 * Math.sin(time * 48271);
    });
}

function listen(notes, expectedAt, {
    rate = 48000,
    duration = 1.4
} = {}) {
    const gate = new D.AttackGate(),
        attacks = [];
    for (let frame = 4096; frame / rate <= duration; frame += 1024) {
        const start = (frame - 4096) / rate,
            time = (frame - 2048) / rate;
        const result = D.analyse(plucks(notes, rate, start), rate, expectedAt(time));
        const attack = gate.process(result, time);
        if (attack) attacks.push(attack);
    }
    return attacks;
}

test('detuned, decaying two- and three-string simultaneous attacks are confirmed once', () => {
    for (const rate of [44100, 48000])
        for (const midis of [
                [40, 55],
                [50, 59, 64]
            ]) {
            const notes = midis.map((midi, i) => ({
                midi,
                time: .2 + i * .005,
                cents: [-6, 7, -4][i],
                level: .07 - i * .008
            }));
            const attacks = listen(notes, () => midis, {
                rate
            });
            const confirmed = attacks.filter(a => a.confidence >= .72 && midis.every(m => a.pitches.includes(m)));
            assert.equal(confirmed.length, 1, `${midis} at ${rate}`);
        }
});

test('a ringing bass plus newly plucked treble strings is not a fresh three-string pinch', () => {
    const notes = [{
        midi: 50,
        time: .1,
        decay: 1.2
    }, {
        midi: 59,
        time: .4
    }, {
        midi: 64,
        time: .407
    }];
    const attacks = listen(notes, () => [50, 59, 64]);
    assert.ok(attacks.length > 0);
    assert.ok(attacks.every(a => a.confidence < .72 || a.pitches.length < 3));
});

test('an unexpected lower string cannot supply a phantom octave in a pinch', () => {
    const notes = [{
        midi: 43,
        time: .1
    }, {
        midi: 59,
        time: .1
    }];
    const result = D.analyse(plucks(notes, 48000, .12), 48000, [55, 59]);
    assert.ok(result.confidence < .72);
});

test('natural third and fourth harmonics never confirm the ambiguous E2 B3 E4 pinch', () => {
    const attacks = listen([{
        midi: 40,
        time: .1,
        decay: .8
    }], () => [40, 59, 64]);
    assert.ok(attacks.length > 0);
    assert.ok(attacks.every(a => a.confidence < .72));
});

test('rapid consecutive plucks over decaying strings are not lost or counted twice', () => {
    const pitches = [55, 59, 64, 55, 59, 64],
        notes = pitches.map((midi, i) => ({
            midi,
            time: .2 + i * .1,
            decay: .18
        }));
    const attacks = listen(notes, time => [pitches[Math.min(pitches.length - 1, Math.max(0, Math.round((time - .2) / .1)))]], {
        duration: .95
    });
    const confident = attacks.filter(a => a.confidence >= .6);
    assert.equal(confident.length, pitches.length);
    confident.forEach((a, i) => assert.ok(a.pitches.some(m => Math.abs(m - pitches[i]) < .45), `${i}: ${a.pitches}`));
});

test('a single decaying pluck does not repeatedly score while it rings', () => {
    const attacks = listen([{
        midi: 40,
        time: .15,
        decay: .8
    }], () => [40], {
        duration: 2
    });
    assert.equal(attacks.filter(a => a.confidence >= .6).length, 1);
});

test('rapid repeated pitches are separate plucks rather than sustain duplicates', () => {
    const notes = Array.from({
        length: 5
    }, (_, i) => ({
        midi: 55,
        time: .2 + i * .08,
        decay: .15
    }));
    const attacks = listen(notes, () => [55], {
        duration: .8
    });
    assert.equal(attacks.filter(a => a.confidence >= .6).length, notes.length);
});
