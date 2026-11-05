const {
    test
} = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/music.js'),
    R = require('../js/rhythm.js'),
    E = require('../js/exercises.js');
const Q = M.PPQ;
const ex = id => E.data.find(e => e.id === id);

test('a multi-measure selection repeats end-exclusively with unique scoring event IDs', () => {
    const t = new R.Timeline(ex('g-c-d'), {
        loop: true,
        first: 2,
        last: 3
    });
    assert.equal(t.length, 8 * Q);
    assert.equal(t.template.length, 16);
    assert.equal(t.template[0].notes[0].midi, 48); // C3 on A string, fret 3.
    t.ensureThrough(20 * Q);
    assert.equal(new Set(t.events.map(e => e.id)).size, t.events.length);
    assert.equal(t.events.filter(e => e.tick === t.length).length, 1);
    assert.deepEqual(t.events.filter(e => e.cycle === 1).map(e => e.tick - t.length), t.template.map(e => e.tick));
    assert.equal(t.chordAt(0).current, 'C');
    assert.equal(t.chordAt(4 * Q).current, 'D');
    assert.equal(t.chordAt(7 * Q).next, 'C');
    assert.equal(t.chordAt(8 * Q).current, 'C');
    assert.equal(t.infoAt(8 * Q).measure, 2);
    assert.equal(t.infoAt(8 * Q).pass, 2);
});
test('the loop boundary has one downbeat and no duplicated counting labels', () => {
    const t = new R.Timeline(ex('forward'), {
        loop: true,
        first: 1,
        last: 1
    });
    const guides = t.guides(3.5 * Q, 4.5 * Q);
    assert.deepEqual(guides.map(g => [g.tick / Q, g.label]), [
        [3.5, '&'],
        [4, '1'],
        [4.5, '&']
    ]);
});
test('a tied or sustained note entering the selection is rearticulated once', () => {
    const e = {
        meter: [4, 4],
        length: 8 * Q,
        chords: [],
        events: [{
            tick: 3 * Q,
            duration: Q,
            notes: [{
                string: 6,
                fret: 3
            }]
        }, {
            tick: 4 * Q,
            duration: 2 * Q,
            notes: [{
                string: 6,
                fret: 3
            }],
            tie: true
        }, {
            tick: 7 * Q,
            duration: Q,
            notes: [{
                string: 2,
                fret: 0
            }]
        }]
    };
    const t = new R.Timeline(e, {
        loop: true,
        first: 2,
        last: 2
    });
    assert.equal(t.template[0].tick, 0);
    assert.equal(t.template[0].notes[0].tie, false);
    assert.deepEqual(t.template[0].targets, [43]);
    assert.equal(t.events.filter(e => e.tick === 4 * Q).length, 1);
    assert.equal(t.events.find(e => e.tick === 4 * Q).targets[0], 43);
    const carry = new R.Timeline({
        ...e,
        events: [{
            tick: 2 * Q,
            duration: 5 * Q,
            notes: [{
                string: 2,
                fret: 0
            }]
        }]
    }, {
        loop: true,
        first: 2,
        last: 2
    });
    assert.equal(carry.template[0].tick, 0);
    assert.equal(carry.template[0].notes[0].duration, 3 * Q);
});
test('sustains are clipped at the selected boundary, without a second tied attack', () => {
    const t = new R.Timeline(ex('tied-melody'), {
        loop: true,
        first: 1,
        last: 1
    });
    for (const e of t.template)
        for (const n of e.notes) assert.ok(e.tick + n.duration <= t.length);
    const custom = {
        meter: [4, 4],
        length: 8 * Q,
        chords: [],
        events: [{
            tick: 3 * Q,
            duration: 3 * Q,
            notes: [{
                string: 6,
                fret: 0
            }]
        }]
    };
    const clip = new R.Timeline(custom, {
        loop: true,
        first: 1,
        last: 1
    });
    assert.equal(clip.template[0].notes[0].duration, Q);
});
test('late previous-pass and early next-pass attacks retain their correct scoring events', () => {
    const t = new R.Timeline(ex('first-bass'), {
        loop: true,
        first: 1,
        last: 1
    });
    const s = new M.Session(t.events, 'rhythm', .22);
    t.ensureThrough(5 * Q);
    const late = s.input({
            tick: 3.1 * Q,
            pitches: [40]
        }, 60),
        early = s.input({
            tick: 3.9 * Q,
            pitches: [40]
        }, 60);
    assert.equal(late.event.cycle, 0);
    assert.equal(late.kind, 'late');
    assert.equal(early.event.cycle, 1);
    assert.equal(early.kind, 'early');
    s.expire(4.3 * Q, 60);
    assert.notEqual(s.results.get(late.event.id).kind, 'missed');
    assert.notEqual(s.results.get(early.event.id).kind, 'missed');
    assert.equal(s.summary().hits, 2);
});
test('a tempo change at the loop boundary preserves continuous time and note projection', () => {
    let now = 10;
    const clock = new M.Transport(() => now, 60);
    clock.start(0);
    const t = new R.Timeline(ex('triplets'), {
        loop: true,
        first: 1,
        last: 1
    });
    now = 14;
    assert.equal(clock.position(), t.length);
    clock.setTempo(120);
    assert.equal(clock.timeAt(t.length), 14);
    assert.ok(Math.abs(clock.timeAt(t.length + 320) - (14 + 1 / 6)) < 1e-9);
    now = 14 + 1 / 6;
    assert.ok(Math.abs(R.xAt(t.length + 320, clock.position(), 120, 160) - 160) < 1e-7);
    clock.pause();
    now = 100;
    assert.ok(Math.abs(clock.position() - (t.length + 320)) < 1e-6);
    clock.start();
    now += .5;
    assert.ok(Math.abs(clock.position() - (t.length + 320 + Q)) < 1e-6);
});
test('long loop practice bounds stored events while retaining scoring totals and pending attacks', () => {
    const t = new R.Timeline(ex('first-bass'), {
            loop: true,
            first: 1,
            last: 1
        }),
        s = new M.Session(t.events, 'rhythm');
    const shared = t.events;
    for (let pass = 0; pass < 500; pass++) {
        t.ensureThrough((pass + 1) * t.length);
        for (let beat = 0; beat < 4; beat++) s.input({
            tick: pass * t.length + beat * Q,
            pitches: [40]
        }, 60);
        s.expire((pass + 1) * t.length - .5 * Q, 60);
        s.archiveBefore((pass - 2) * t.length);
        assert.ok(t.events.length < 32);
    }
    assert.equal(t.events, shared);
    assert.equal(s.summary().hits, 2000);
    assert.equal(s.wrong, 0);
    assert.equal(s.extras, 0);
    assert.equal(s.next().cycle, 500);
});

test('straight, triplet, and swung loops keep notes aligned to counts over repeated passes', () => {
    for (const id of ['forward', 'triplets', 'blues']) {
        const t = new R.Timeline(ex(id), {
            loop: true,
            first: 1,
            last: 1,
            swing: ex(id).swing || 0
        });
        for (const cycle of [0, 1, 9, 99]) {
            const start = cycle * t.length,
                guides = t.guides(start, start + t.length - 1e-6);
            for (const e of t.template) assert.ok(guides.some(g => Math.abs(g.tick - (start + e.tick)) < 1e-6));
            assert.equal(guides.filter(g => g.barStart).length, 1);
        }
    }
});

test('chord cues anticipate actual changes rather than repeating the same chord name', () => {
    const single = new R.Timeline(ex('sixteenth-answer'), {
        loop: true,
        first: 1,
        last: 1
    });
    assert.equal(single.chordAt(Q).current, 'G');
    assert.equal(single.chordAt(Q).next, null);
    const phrase = new R.Timeline(ex('g-c-d'), {
        loop: true
    });
    assert.equal(phrase.chordAt(15 * Q).current, 'G');
    assert.equal(phrase.chordAt(15 * Q).next, 'C');
    assert.equal(phrase.chordAt(15 * Q).nextTick, 20 * Q);
});
