const {
    test
} = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/music.js'),
    R = require('../js/rhythm.js'),
    E = require('../js/exercises.js');
const ex = id => E.data.find(e => e.id === id),
    Q = M.PPQ;

test('each exercise selects only its simplest useful counting guide', () => {
    for (const [id, style, labels] of [
            ['first-bass', 'quarter', ['1', '2', '3', '4']],
            ['forward', 'eighth', ['1', '&', '2', '&', '3', '&', '4', '&']],
            ['sixteenths', 'sixteenth', ['1', 'e', '&', 'a']],
            ['triplets', 'triplet', ['1', 'trip', 'let']],
            ['six-eight', 'compound', ['1', '2', '3', '4', '5', '6']]
        ]) {
        const t = new R.Timeline(ex(id));
        assert.equal(t.style, style);
        assert.deepEqual(t.counts.slice(0, labels.length).map(g => g.label), labels);
    }
    assert.equal(R.countStyle(ex('dotted')), 'eighth');
    assert.equal(R.countStyle(ex('sixteenth-answer')), 'sixteenth');
    assert.equal(R.countStyle(ex('space')), 'quarter');
});
test('swung counts move with swung notes; triplets and compound pulses stay even', () => {
    const t = new R.Timeline(ex('forward'), {
        swing: 1
    });
    assert.equal(t.counts[1].tick, 640);
    assert.equal(t.template[1].tick, 640);
    const triplets = new R.Timeline(ex('triplets'), {
        swing: 1
    });
    assert.deepEqual(triplets.counts.slice(0, 3).map(g => g.tick), [0, 320, 640]);
    const compound = new R.Timeline(ex('six-eight'), {
        swing: 1
    });
    assert.deepEqual(compound.counts.slice(0, 6).map(g => g.tick), [0, 480, 960, 1440, 1920, 2400]);
    assert.deepEqual(compound.counts.slice(0, 6).filter(g => g.strong).map(g => g.label), ['1', '4']);
});
test('every rhythm guide and note uses exactly the same projection at multiple tempos', () => {
    for (const id of ['forward', 'sixteenths', 'triplets', 'six-eight', 'blues', 'tied-melody'])
        for (const bpm of [40, 60, 95, 180]) {
            const t = new R.Timeline(ex(id), {
                swing: ex(id).swing || 0
            });
            let now = 10;
            const clock = new M.Transport(() => now, bpm);
            clock.start(0);
            for (const event of t.template) {
                const guide = t.counts.find(g => Math.abs(g.tick - event.tick) < 1e-6);
                assert.ok(guide, `${id} tick ${event.tick}`);
                now = clock.timeAt(event.tick);
                assert.ok(Math.abs(R.xAt(guide.tick, clock.position(), 120, 160) - 160) < 1e-7);
                assert.equal(R.xAt(event.tick, clock.position(), 120, 160), R.xAt(guide.tick, clock.position(), 120, 160));
            }
        }
});
test('bass/treble voices and simultaneous attacks survive compilation and ties retain their hold', () => {
    const t = new R.Timeline(ex('tied-melody'));
    const simultaneous = t.template.find(e => e.tick === 2 * Q);
    assert.ok(simultaneous.notes.some(n => n.voice === 'bass' && !n.tie));
    assert.ok(simultaneous.notes.some(n => n.voice === 'treble' && n.tie));
    assert.equal(simultaneous.targets.length, 1);
    const attack = t.template.find(e => e.tick === 1.5 * Q),
        n = attack.notes[0];
    assert.equal(R.sustainEnd(t.template, attack, n), 2.5 * Q);
});
test('new syncopation steps use valid chord tones and a progressively finer count', () => {
    const ids = ['one-offbeat', 'between-beats', 'folk-answer', 'sixteenth-answer', 'tied-melody'];
    const triad = {
        G: [7, 11, 2],
        C: [0, 4, 7],
        D: [2, 6, 9],
        Em: [4, 7, 11],
        Am: [9, 0, 4]
    };
    for (const id of ids) {
        const e = ex(id),
            t = new R.Timeline(e);
        assert.ok(e.lesson.includes('bass'));
        for (const event of t.template) {
            const chord = e.chords.filter(c => c.tick <= event.tick).at(-1).chord;
            for (const n of event.notes) assert.ok(triad[chord].includes(n.midi % 12), `${id} ${chord} ${n.midi}`);
        }
    }
});
