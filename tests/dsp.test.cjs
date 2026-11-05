const {
    test
} = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/dsp.js');
const hz = m => 440 * 2 ** ((m - 69) / 12);

function signal(midis, rate = 48000, level = .08, offset = 0) {
    return Float32Array.from({
        length: 4096
    }, (_, i) => midis.reduce((s, m) => {
        const t = (i + offset) / rate,
            f = hz(m);
        return s + level * (Math.sin(2 * Math.PI * f * t) + .3 * Math.sin(4 * Math.PI * f * t) + .1 * Math.sin(6 * Math.PI * f * t));
    }, 0));
}
test('game identifies individual bass and treble notes with guitar harmonics', () => {
    for (const rate of [44100, 48000])
        for (const midi of [40, 45, 50, 55, 59, 64, 67, 71]) {
            const r = D.analyse(signal([midi], rate), rate, [midi]);
            assert.ok(r.confidence > .8);
            assert.ok(Math.abs(r.pitches[0] - midi) < .2, `${midi} at ${rate}`);
        }
});
test('silence and random noise do not produce confident musical pitches', () => {
    assert.deepEqual(D.analyse(new Float32Array(4096), 48000, [40]).pitches, []);
    let seed = 10;
    const noise = Float32Array.from({
        length: 4096
    }, () => {
        seed = (1664525 * seed + 1013904223) >>> 0;
        return (seed / 2 ** 32 - .5) * .1;
    });
    const r = D.analyse(noise, 48000, [40]);
    assert.ok(!r.pitches.length || r.confidence < .6);
});
test('expected non-octave two-note pinches need both fundamentals', () => {
    for (const midis of [
            [40, 55],
            [50, 59],
            [45, 62]
        ]) {
        const r = D.analyse(signal(midis), 48000, midis);
        assert.deepEqual(r.pitches, midis);
        assert.ok(r.confidence >= .72);
        const partial = D.analyse(signal([midis[0]]), 48000, midis);
        assert.ok(partial.confidence < .72);
    }
});
test('bass harmonics alone cannot impersonate an octave pinch', () => {
    for (const tones of [
            [40],
            [40, 64]
        ]) {
        const r = D.analyse(signal(tones), 48000, [40, 64]);
        assert.ok(r.confidence < .72);
    }
});
test('natural sustain is counted once; fresh repeated plucks can count again', () => {
    const gate = new D.AttackGate();
    let attacks = 0;
    for (let i = 0; i < 50; i++) {
        const r = D.analyse(signal([40], 48000, .08 * Math.exp(-i / 20), i * 1024), 48000, [40]);
        if (gate.process(r, i * 1024 / 48000)) attacks++;
    }
    assert.equal(attacks, 1);
    for (let i = 50; i < 60; i++) {
        const r = D.analyse(signal([40], 48000, .12 * Math.exp(-(i - 50) / 20), i * 1024), 48000, [40]);
        if (gate.process(r, i * 1024 / 48000)) attacks++;
    }
    assert.equal(attacks, 2);
});
test('rolls trigger new attacks when pitch changes while previous strings sustain', () => {
    const gate = new D.AttackGate();
    let attacks = 0;
    for (let note = 0; note < 4; note++)
        for (let frame = 0; frame < 10; frame++) {
            const midi = [40, 55, 59, 64][note],
                r = D.analyse(signal([midi], 48000, .08, frame * 1024), 48000, [midi]);
            if (gate.process(r, (note * 10 + frame) * 1024 / 48000)) attacks++;
        }
    assert.equal(attacks, 4);
});
test('expected-pitch attack evidence finds treble plucks over a ringing bass', () => {
    const gate = new D.AttackGate(),
        rate = 48000;
    let target = 40,
        attacks = [];
    for (let frame = 0; frame < 55; frame++) {
        const samples = signal([40], rate, .08 * Math.exp(-frame / 90), frame * 1024);
        if (frame >= 15) {
            target = 55;
            const treble = signal([55], rate, .085 * Math.exp(-(frame - 15) / 40), frame * 1024);
            for (let i = 0; i < samples.length; i++) samples[i] += treble[i];
        }
        if (frame >= 35) {
            target = 59;
            const treble = signal([59], rate, .10 * Math.exp(-(frame - 35) / 40), frame * 1024);
            for (let i = 0; i < samples.length; i++) samples[i] += treble[i];
        }
        const event = gate.process(D.analyse(samples, rate, [target]), frame * 1024 / rate);
        if (event) attacks.push(event);
    }
    assert.ok(attacks.some(e => e.pitches.some(m => Math.abs(m - 40) < .4)));
    assert.ok(attacks.some(e => e.pitches.some(m => Math.abs(m - 55) < .4)));
    assert.ok(attacks.some(e => e.pitches.some(m => Math.abs(m - 59) < .4)));
});

test('all authored pinch groups are distinguishable under the production harmonic rules', () => {
    const M = require('../js/music.js'),
        E = require('../js/exercises.js');
    for (const exercise of E.data)
        for (const event of M.compile(exercise))
            if (event.targets.length > 1) {
                for (const rate of [44100, 48000]) {
                    const r = D.analyse(signal(event.targets, rate), rate, event.targets);
                    assert.ok(r.confidence >= .72, `${exercise.id}, tick ${event.tick}, ${event.targets}, ${rate} Hz`);
                    assert.deepEqual(r.pitches, event.targets);
                }
            }
});
