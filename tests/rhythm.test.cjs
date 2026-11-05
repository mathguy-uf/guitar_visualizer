const {
    test
} = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/music.js');
const E = require('../js/exercises.js');

test('every exercise compiles to valid TAB, integral timing, and standard-tuning pitches', () => {
    assert.equal(new Set(E.data.map(e => e.id)).size, E.data.length);
    for (const e of E.data) {
        const timeline = M.compile(e);
        assert.ok(timeline.length > 0, e.id);
        assert.equal(e.length % M.barTicks(e.meter), 0, e.id);
        for (const event of timeline) {
            assert.ok(Number.isInteger(event.tick));
            assert.ok(event.duration > 0);
            for (const n of event.notes) {
                assert.ok(Number.isInteger(n.fret), e.id);
                assert.equal(n.midi, M.tuning[n.string - 1] + n.fret);
            }
        }
    }
    for (let level = 1; level <= 5; level++) assert.ok(E.data.filter(e => e.level === level).length >= 3);
});
test('independent bass and offbeat treble share a timeline, while simultaneous voices merge', () => {
    const events = M.compile(E.data.find(e => e.id === 'offbeat'));
    assert.deepEqual(events.filter(e => e.notes.some(n => n.voice === 'bass')).map(e => e.tick / M.PPQ), [0, 2, 4, 6]);
    assert.deepEqual(events.filter(e => e.notes.some(n => n.voice === 'treble')).map(e => e.tick / M.PPQ), [1.5, 3.5, 5.5, 7.5]);
    const merged = M.compile({
        length: 960,
        events: [{
            tick: 0,
            duration: 960,
            notes: [{
                string: 6,
                fret: 0
            }],
            voice: 'bass'
        }, {
            tick: 0,
            duration: 480,
            notes: [{
                string: 2,
                fret: 0
            }],
            voice: 'treble'
        }]
    });
    assert.equal(merged.length, 1);
    assert.deepEqual(merged[0].targets, [40, 59]);
});
test('rests and tied continuations require no new attack; triplets stay straight under swing', () => {
    const space = M.compile(E.data.find(e => e.id === 'space'));
    assert.equal(space[1].targets.length, 0);
    assert.equal(space[2].targets.length, 0);
    const e = E.data.find(e => e.id === 'triplets');
    assert.deepEqual(M.compile(e, 1).map(e => e.tick), M.compile(e).map(e => e.tick));
    assert.equal(M.swungTick(480, 1), 640);
    assert.equal(M.swungTick(960, 1), 960);
    const d = M.compile(E.data.find(e => e.id === 'dotted'));
    assert.equal(d[0].duration, 1440);
});
test('tempo changes and pause/resume preserve musical position without drift', () => {
    let now = 10;
    const t = new M.Transport(() => now, 60);
    t.start(-3840);
    now += 2;
    assert.equal(t.position(), -1920);
    t.setTempo(120);
    assert.equal(t.position(), -1920);
    now++;
    assert.equal(t.position(), 0);
    assert.equal(t.timeAt(960), 13.5);
    now += .25;
    t.pause();
    const paused = t.position();
    now += 100;
    assert.equal(t.position(), paused);
    t.start();
    now += .5;
    assert.equal(t.position(), paused + 960);
});
test('Learn mode waits indefinitely, allows retries, and never scores a tied note', () => {
    const s = new M.Session(M.compile(E.data.find(e => e.id === 'space')), 'learn');
    s.expire(1e9, 60);
    assert.equal(s.next().tick, 0);
    assert.equal(s.input({
        tick: 0,
        pitches: [41]
    }, 60).kind, 'wrong');
    assert.equal(s.next().tick, 0);
    assert.equal(s.input({
        tick: 0,
        pitches: [40]
    }, 60).kind, 'correct');
    assert.equal(s.next().tick, 2880);
});
test('Rhythm separates early, late, wrong, missed, and extra attacks', () => {
    const s = new M.Session(M.compile(E.data[0]), 'rhythm', .2);
    assert.equal(s.input({
        tick: -100,
        pitches: [40]
    }, 60).kind, 'early');
    assert.equal(s.input({
        tick: 1060,
        pitches: [40]
    }, 60).kind, 'late');
    assert.equal(s.input({
        tick: 1920,
        pitches: [45]
    }, 60).kind, 'wrong');
    assert.equal(s.input({
        tick: 1920,
        pitches: [40]
    }, 60).kind, 'correct');
    assert.equal(s.input({
        tick: 2400,
        pitches: [40]
    }, 60).kind, 'extra');
    s.expire(8000, 60);
    const summary = s.summary();
    assert.equal(summary.hits, 3);
    assert.equal(summary.missed, 5);
    assert.equal(summary.wrong, 1);
    assert.equal(summary.extras, 1);
});
test('uncertain pinches never become wrong pitches and are excluded from accuracy', () => {
    const e = M.compile(E.data.find(e => e.id === 'two-pinch'));
    const s = new M.Session(e, 'rhythm');
    assert.equal(s.input({
        tick: 0,
        pitches: [40],
        confidence: .8
    }, 60).kind, 'uncertain');
    assert.equal(s.summary().wrong, 0);
    assert.equal(s.summary().accuracy, null);
    assert.equal(s.input({
        tick: 960,
        pitches: [50, 55],
        confidence: .8
    }, 60).kind, 'correct');
    assert.equal(s.summary().accuracy, 100);
    const learn = new M.Session(e, 'learn');
    learn.input({
        tick: 0,
        pitches: [40],
        confidence: .2
    }, 60);
    assert.equal(learn.next().tick, 0);
});

test('an uncertain pinch remains open for a clearer reading in the same timing window', () => {
    const s = new M.Session(M.compile(E.data.find(e => e.id === 'three-pinch')), 'rhythm', .22);
    const e = s.next();
    assert.equal(s.input({
        tick: 0,
        pitches: [e.targets[0]],
        confidence: .35
    }, 60).kind, 'uncertain');
    assert.equal(s.next().id, e.id);
    assert.equal(s.input({
        tick: 60,
        pitches: e.targets,
        confidence: .8
    }, 60).kind, 'correct');
    assert.equal(s.summary().hits, 1);
    assert.equal(s.summary().uncertain, 0);
});

test('overlapping timing windows match a correct pitch before the nearest different note', () => {
    const events = M.compile({
        length: 960,
        events: [{
            tick: 0,
            duration: 240,
            notes: [{
                string: 6,
                fret: 0
            }]
        }, {
            tick: 240,
            duration: 240,
            notes: [{
                string: 3,
                fret: 0
            }]
        }]
    });
    const s = new M.Session(events, 'rhythm', .22);
    const result = s.input({
        tick: 140,
        pitches: [40],
        confidence: 1
    }, 120);
    assert.equal(result.kind, 'late');
    assert.equal(result.event.id, events[0].id);
    assert.equal(s.summary().wrong, 0);
});

test('a low-confidence reading remains uncertain instead of becoming a miss or an extra', () => {
    const s = new M.Session(M.compile(E.data[0]), 'rhythm', .22);
    s.input({
        tick: 0,
        pitches: [],
        confidence: .1
    }, 60);
    s.expire(300, 60);
    assert.equal(s.summary().uncertain, 1);
    assert.equal(s.summary().missed, 0);
    s.input({
        tick: 480,
        pitches: [],
        confidence: .1
    }, 60);
    assert.equal(s.summary().extras, 0);
});

test('historical onset positions remain correct after a live tempo change', () => {
    let now = 10;
    const clock = new M.Transport(() => now, 60);
    clock.start(0);
    now = 11;
    clock.setTempo(120);
    assert.ok(Math.abs(clock.position(10.9) - 864) < 1e-6);
    assert.ok(Math.abs(clock.position(11.1) - 1152) < 1e-6);
});

test('tempo changes cannot stretch a fixed timing window around an earlier note', () => {
    let now = 10;
    const clock = new M.Transport(() => now, 60);
    clock.start(0);
    const event = {
        id: 0,
        tick: 960,
        targets: [40]
    };
    const s = new M.Session([event], 'rhythm', .22);
    now = 11.2;
    clock.setTempo(180);
    const result = s.input({
        tick: clock.position(11.25),
        time: 11.25,
        timeAt: tick => clock.timeAt(tick),
        pitches: [40],
        confidence: 1
    }, 180);
    assert.equal(result.kind, 'extra');
});
