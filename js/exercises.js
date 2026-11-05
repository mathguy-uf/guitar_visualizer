(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.GuitarExercises = api;
})(globalThis, () => {
    'use strict';
    const Q = 960,
        E = 480,
        S = 240,
        T = 320;
    const shapes = {
        G: [3, 0, 0, 0, 2, 3],
        C: [0, 1, 0, 2, 3, null],
        D: [2, 3, 2, 0, null, null],
        Em: [0, 0, 0, 2, 2, 0],
        Am: [0, 1, 2, 2, 0, null]
    };
    const fingers = s => s >= 4 ? 'P' : s === 3 ? 'I' : s === 2 ? 'M' : 'A';
    const n = (s, f = 0) => ({
        string: s,
        fret: f,
        finger: fingers(s)
    });

    function exercise(id, level, title, description, tip, bpm, events, length = 8 * Q, meter = [4, 4], chords = []) {
        return {
            id,
            level,
            title,
            description,
            tip,
            bpm,
            events,
            length,
            meter,
            chords
        };
    }

    function singles(strings, step = Q, bars = 2) {
        return Array.from({
            length: bars * 4 * Q / step
        }, (_, i) => ({
            tick: i * step,
            duration: step,
            notes: [n(strings[i % strings.length])],
            voice: strings[i % strings.length] >= 4 ? 'bass' : 'treble',
            accent: i % (4 * Q / step) === 0
        }));
    }

    function rolls(chords, pattern) {
        const events = [],
            changes = [];
        chords.forEach((chord, bar) => {
            changes.push({
                tick: bar * 4 * Q,
                chord
            });
            pattern.forEach((s, i) => {
                const string = s === 0 ? (chord === 'C' || chord === 'Am' ? 5 : chord === 'D' ? 4 : 6) : s;
                events.push({
                    tick: bar * 4 * Q + i * E,
                    duration: E,
                    notes: [n(string, shapes[chord][string - 1])],
                    voice: string >= 4 ? 'bass' : 'treble',
                    accent: i === 0
                });
            });
        });
        return {
            events,
            changes
        };
    }
    const forward = [6, 3, 2, 1, 4, 3, 2, 1],
        backward = [6, 1, 2, 3, 4, 1, 2, 3],
        combined = [6, 3, 2, 1, 4, 1, 2, 3];
    const data = [
        exercise('first-bass', 1, 'One steady bass', 'Open low E, one note on each beat.', 'Use your thumb. Let your hand stay relaxed.', 55, singles([6])),
        exercise('open-bass', 1, 'Meet the bass strings', 'Open E, A, and D in quarter notes.', 'P means thumb. Follow the string labels at the left.', 55, singles([6, 5, 4, 5])),
        exercise('alternate', 1, 'Alternating bass', 'Move your thumb between low E and D.', 'Keep the same volume and spacing on both strings.', 60, singles([6, 4])),
        exercise('forward', 2, 'Forward roll', 'Thumb → index → middle → ring.', 'P on bass, I on G, M on B, A on high e. All strings open.', 60, singles(forward, E)),
        exercise('backward', 2, 'Backward roll', 'Thumb → ring → middle → index.', 'Let the treble notes fall evenly after the thumb.', 60, singles(backward, E)),
        exercise('combined', 2, 'There and back', 'Combine forward and backward rolls.', 'Keep the eighth notes flowing as the direction changes.', 65, singles(combined, E)),
    ];
    for (const [id, title, chords] of [
            ['g-c-d', 'G → C → D', ['G', 'C', 'D', 'G']],
            ['minor-colors', 'G → Em → Am → D', ['G', 'Em', 'Am', 'D']],
            ['home', 'G → D → Em → C', ['G', 'D', 'Em', 'C']]
        ]) {
        const {
            events,
            changes
        } = rolls(chords, [0, 3, 2, 1, 4, 3, 2, 1]);
        data.push(exercise(id, 3, title, 'Keep a forward roll through four chord changes.', 'Form the next chord just before the bar line. Start slowly.', 60, events, 16 * Q, [4, 4], changes));
    }
    data.push(exercise('two-pinch', 4, 'Bass + treble', 'Pinch open bass and G strings together.', 'Pinches are experimental. An uncertain reading is kept separate from mistakes.', 55, Array.from({
        length: 8
    }, (_, i) => ({
        tick: i * Q,
        duration: Q,
        notes: [n(i % 2 ? 4 : 6), n(3)],
        accent: i % 4 === 0
    }))));
    data.push(exercise('three-pinch', 4, 'Three strings together', 'Thumb, middle, and ring on open D, B, e.', 'Keep the three attacks together. Use a quiet room.', 50, Array.from({
        length: 4
    }, (_, i) => ({
        tick: i * 2 * Q,
        duration: 2 * Q,
        notes: [n(4), n(2), n(1)]
    }))));
    const pinchRoll = singles([6, 3, 2, 1, 4, 3, 2, 1], E);
    pinchRoll.forEach((e, i) => {
        if (i % 4 === 0) e.notes.push(n(i % 8 === 0 ? 3 : 1));
    });
    data.push(exercise('pinch-roll', 4, 'Pinch into a roll', 'A bass-and-treble pinch starts each half bar.', 'Release into the roll without rushing the next note.', 55, pinchRoll));
    const sync = [];
    for (let bar = 0; bar < 2; bar++) {
        for (const b of [0, 2]) sync.push({
            tick: bar * 4 * Q + b * Q,
            duration: Q,
            notes: [n(b ? 4 : 6)],
            voice: 'bass',
            accent: true
        });
        for (const b of [1.5, 3.5]) sync.push({
            tick: bar * 4 * Q + b * Q,
            duration: E,
            notes: [n(2)],
            voice: 'treble',
            accent: true
        });
        for (const b of [1, 3]) sync.push({
            tick: bar * 4 * Q + b * Q,
            duration: E,
            notes: [],
            voice: 'treble'
        });
    }
    data.push(exercise('offbeat', 5, 'Steady bass, offbeat melody', 'Bass on 1 and 3; B string on the & of 2 and 4.', 'Count 1 & 2 & 3 & 4 &. Keep your thumb independent.', 55, sync));
    data.push(exercise('sixteenths', 5, 'A little quicker', 'Four notes per beat: 1 e & a.', 'Lower the tempo before adding these smaller subdivisions.', 40, singles([6, 3, 2, 1], S)));
    const dotted = [];
    for (let i = 0; i < 4; i++) {
        dotted.push({
            tick: i * 2 * Q,
            duration: Q + E,
            notes: [n(6)],
            voice: 'bass',
            accent: true
        }, {
            tick: i * 2 * Q + Q + E,
            duration: E,
            notes: [n(2)]
        });
    }
    data.push(exercise('dotted', 5, 'Long, then short', 'Dotted quarters followed by eighth notes.', 'Let the bass ring for one-and-a-half beats.', 55, dotted));
    data.push(exercise('triplets', 5, 'Three in a beat', 'Even triplet rolls: 1 trip let.', 'Three evenly spaced notes fit in each quarter-note beat.', 50, singles([6, 3, 2], T).map(e => ({
        ...e,
        straight: true
    }))));
    const ties = [{
        tick: 0,
        duration: Q,
        notes: [n(6)]
    }, {
        tick: Q,
        duration: Q,
        notes: [n(6)],
        tie: true,
        voice: 'bass'
    }, {
        tick: 2 * Q,
        duration: Q,
        notes: []
    }, {
        tick: 3 * Q,
        duration: Q,
        notes: [n(2)]
    }, {
        tick: 4 * Q,
        duration: 2 * Q,
        notes: [n(4)]
    }, {
        tick: 6 * Q,
        duration: Q,
        notes: []
    }, {
        tick: 7 * Q,
        duration: Q,
        notes: [n(1)]
    }];
    data.push(exercise('space', 5, 'Let it ring', 'Ties hold a note; rests leave room.', 'The curved tie means keep ringing. Do not pluck the tied note again.', 55, ties));
    const compound = Array.from({
        length: 12
    }, (_, i) => ({
        tick: i * E,
        duration: E,
        notes: [n([6, 3, 2, 4, 2, 1][i % 6])],
        accent: i % 3 === 0,
        straight: true
    }));
    data.push(exercise('six-eight', 5, 'A gentle 6/8', 'Two groups of three eighth notes.', 'Feel ONE two three FOUR five six. BPM counts quarter notes.', 50, compound, 6 * Q, [6, 8]));
    const blues = [];
    for (let b = 0; b < 2; b++) {
        [0, 1, 2, 3].forEach((beat) => blues.push({
            tick: (b * 4 + beat) * Q,
            duration: Q,
            notes: [n(beat % 2 ? 5 : 6)],
            voice: 'bass',
            accent: beat === 0
        }));
        [.5, 1.5, 2.5, 3.5].forEach((beat, i) => blues.push({
            tick: (b * 4 + beat) * Q,
            duration: E,
            notes: [n(i % 2 ? 1 : 2)],
            voice: 'treble'
        }));
    }
    data.push({
        ...exercise('blues', 5, 'Front porch blues', 'A steady thumb with answering treble notes.', 'Try a little swing in Mode & options. Keep the bass unhurried.', 55, blues),
        swing: .6
    });
    // Short answering phrases develop independence before adding denser rhythm.
    function independent(id, title, description, tip, chords, trebleBeats, bpm = 55) {
        const events = [],
            changes = [];
        chords.forEach((chord, bar) => {
            changes.push({
                tick: bar * 4 * Q,
                chord
            });
            const root = chord === 'C' || chord === 'Am' ? 5 : chord === 'D' ? 4 : 6;
            const alternate = chord === 'D' ? 5 : chord === 'Em' ? 5 : 4;
            for (const [index, beat] of [0, 2].entries()) {
                const string = index ? alternate : root;
                events.push({
                    tick: (bar * 4 + beat) * Q,
                    duration: Q,
                    notes: [n(string, chord === 'D' && string === 5 ? 0 : shapes[chord][string - 1])],
                    voice: 'bass',
                    accent: true
                });
            }
            trebleBeats.forEach((beat, i) => {
                const string = i % 2 ? 1 : 2;
                const duration = (beat * 4) % 2 ? S : E;
                events.push({
                    tick: (bar * 4 + beat) * Q,
                    duration,
                    notes: [n(string, shapes[chord][string - 1])],
                    voice: 'treble'
                });
            });
        });
        return {
            ...exercise(id, 5, title, description, tip, bpm, events, chords.length * 4 * Q, [4, 4], changes),
            lesson: 'Keep the round bass notes steady. The square melody notes answer between the beats.'
        };
    }
    const firstOffbeat = independent('one-offbeat', 'One note between beats', 'G bass on 1 and 3; one B-string answer on the & of 4.', 'Count aloud. Let your thumb keep its own quiet pulse.', ['G', 'G'], [3.5]);
    const between = independent('between-beats', 'Melody between the beats', 'G → Em → Am → D, with a melody note on each &.', 'Keep the same relaxed bass pulse while your fingers answer.', ['G', 'Em', 'Am', 'D'], [.5, 1.5, 2.5, 3.5]);
    const small = independent('sixteenth-answer', 'The last little sixteenth', 'A steady bass with melody on the a of 2 and 4.', 'Count 1 e & a. Place each melody note just before the next beat.', ['G', 'C', 'D', 'G'], [1.75, 3.75], 40);
    const folk = independent('folk-answer', 'A folk-style answer', 'A short melody answers an alternating bass through G, D, Em, C.', 'Try looping one measure until your hand can play it without rushing.', ['G', 'D', 'Em', 'C'], [.5, 1.5], 55);
    const tied = independent('tied-melody', 'Melody across a bass beat', 'A melody note on the & of 2 rings through the next bass note.', 'Let the melody ring while your thumb plays beat 3. Do not pick the tied note again.', ['G', 'C'], [1.5, 3.5], 50);
    tied.events.filter(e => e.voice === 'treble' && e.tick % (4 * Q) === 1.5 * Q).forEach(e => {
        tied.events.push({
            tick: e.tick + E,
            duration: E,
            notes: e.notes.map(note => ({
                ...note
            })),
            voice: 'treble',
            tie: true
        });
    });
    data.splice(data.findIndex(e => e.id === 'offbeat'), 0, firstOffbeat);
    data.splice(data.findIndex(e => e.id === 'sixteenths'), 0, between, folk);
    data.splice(data.findIndex(e => e.id === 'dotted'), 0, small);
    data.splice(data.findIndex(e => e.id === 'triplets'), 0, tied);
    return {
        data,
        shapes,
        levels: [{
            title: 'Bass notes',
            detail: 'Find a relaxed, steady thumb.'
        }, {
            title: 'Basic rolls',
            detail: 'Let your fingers follow the pulse.'
        }, {
            title: 'Chord changes',
            detail: 'Keep the roll moving through a change.'
        }, {
            title: 'Pinches',
            detail: 'Bring strings together. Experimental listening.'
        }, {
            title: 'Rhythm & independence',
            detail: 'Leave space, play off the beat, and find a groove.'
        }]
    };
});
