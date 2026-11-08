/* E-major double-stops, voicings and picking data. String 1 is high e. */
(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.GuitarThirds = api;
})(globalThis, () => {
    'use strict';
    const tuning = [64, 59, 55, 50, 45, 40];
    const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
    const scale = [4, 6, 8, 9, 11, 1, 3];
    const note = (string, fret) => ({string, fret, midi: tuning[string - 1] + fret,
        name: names[(tuning[string - 1] + fret) % 12], finger: ['A', 'M', 'I', 'P', 'P', 'P'][string - 1]});
    const harmony = (d, g, quality, variants) => ({d, g, quality, notes: [note(4, d), note(3, g)], variants});
    const v = (name, root, quality, intervals, extra, why) => ({name, root, quality, intervals,
        extra: extra.map(([s, f]) => note(s, f)), why});
    const major = [0, 4, 7], minor = [0, 3, 7], seventh = [0, 4, 7, 10];
    const eVoicings = () => [v('E', 4, 'major', major, [[2,0],[1,0],[6,0]],
        'E–G♯ is a major third. Open B supplies the fifth; low and high E reinforce the root. Alternate low E with the fretted D-string E.')];
    const harmonies = [
        harmony(2, 1, 'major', eVoicings()),
        harmony(4, 2, 'minor', [
            v('F♯m7 (no fifth)', 6, 'minor', [0,3,10], [[1,0]], 'F♯–A establishes minor quality. High open E adds the minor seventh; C♯, the fifth, is absent. Use high E so F♯ remains the bass.'),
            v('F♯m', 6, 'minor', minor, [[2,2]], 'F♯–A is a minor third. B string fret 2 supplies C♯ to complete the F♯ minor triad. Open E would change this to F♯m7.')]),
        harmony(6, 4, 'minor', [v('E/G♯', 4, 'major', major, [[1,0]], 'G♯–B is a minor third, but these are the third and fifth of E major. High open E completes E major with G♯ in the bass. Low open E would put E back in the bass.')]),
        harmony(7, 6, 'major', [
            v('A', 9, 'major', major, [[1,0],[5,0]], 'A–C♯ is a major third. Open E supplies the fifth; open A reinforces the root.'),
            v('Aadd9', 9, 'major', [0,4,7,2], [[1,0],[2,0],[5,0]], 'A–C♯–E completes A major. Open B adds the ninth. There is no seventh: this is Aadd9, not A9.')]),
        harmony(9, 8, 'major', [
            v('B', 11, 'major', major, [[2,7]], 'B–D♯ is a major third. B string fret 7 supplies F♯, the fifth, close to this double-stop. The equivalent high e fret 2 is a wide stretch here; use the nearby B-string note. Open E is an 11th that can clash with D♯.'),
            v('B7/A', 11, 'dominant', seventh, [[2,7],[5,0]], 'B–D♯ supplies the root and major third. Fretted F♯ supplies the fifth; open A is the minor seventh. With low A sounding, the complete B7 chord has A in the bass.')]),
        harmony(11, 9, 'minor', [
            v('C♯m', 1, 'minor', minor, [[2,9]], 'C♯–E is a minor third. B string fret 9 supplies G♯, the fifth, completing C♯ minor. It is the same pitch as high e fret 4, without the wide stretch.'),
            v('C♯m7 (no fifth)', 1, 'minor', [0,3,10], [[2,0]], 'C♯–E plus open B gives root, minor third and minor seventh, with no G♯ fifth. Open B is below the fretted C♯, so this voicing has B in the bass.')]),
        harmony(13, 11, 'minor', [
            v('B', 11, 'major', major, [[2,0]], 'D♯–F♯ is a minor third, but it is the third and fifth of B major. Open B completes the major triad and is the lowest note.'),
            v('D♯dim/A', 3, 'diminished', [0,3,6], [[5,0]], 'D♯–F♯ plus open A makes a diminished triad: root, minor third and diminished fifth. The low open A is in the bass.'),
            v('B7/A', 11, 'dominant', seventh, [[5,0],[2,0]], 'D♯–F♯ does not establish B major by itself. Open B supplies the root and open A the minor seventh: a complete B7 with A in the bass.')]),
        harmony(14, 13, 'major', eVoicings())
    ];
    // State the bass explicitly when an added open string is lower than the root.
    harmonies[5].variants[1].name = 'C♯m7/B (no fifth)';
    const progressions = [
        {name:'E – A – B – E', steps:[['E',0,0],['A',3,0],['B',4,0],['E',7,0]]},
        {name:'E – B – C♯m – A', steps:[['E',0,0],['B',4,0],['C♯m',5,0],['A',3,0]]},
        {name:'E – F♯m – A – B7 – E', steps:[['E',0,0],['F♯m',1,1],['A',3,0],['B7',4,1],['E',7,0]]}
    ];
    const sounding = (index, variant = 0) => [...harmonies[index].notes, ...harmonies[index].variants[variant].extra];
    function openAdvice(index, variant = 0) {
        const chord = harmonies[index].variants[variant];
        return [6,5,4,3,2,1].map(string => {
            const n = note(string, 0), interval = (n.midi % 12 - chord.root + 12) % 12;
            const occupied = string === 4 || string === 3 || chord.extra.some(x => x.string === string && x.fret > 0);
            const stable = chord.intervals.includes(interval);
            let role = stable ? 'chord tone' : ({2:'9th · extension',5:'11th · may clash with the third',10:'minor 7th · changes the chord',9:'6th / 13th · extension',8:'♭6 · tense against the fifth',1:'♭9 · strong tension',6:'♯11 / ♭5 · tension'}[interval] || 'color tone · listen for tension');
            if (!scale.includes(n.midi % 12)) role = 'chromatic · outside E major';
            if (occupied) role += ' · string is fretted';
            else if (stable && n.midi < Math.min(...sounding(index,variant).map(x=>x.midi))) role += ' · may change the bass';
            return {...n, role, stable:stable && !occupied, available:!occupied};
        });
    }
    function picking(index, variant = 0) {
        const notes = sounding(index, variant);
        const bass = notes.filter(n => n.string >= 4).sort((a,b) => a.midi - b.midi);
        const treble = notes.filter(n => n.string <= 3).sort((a,b) => b.string - a.string);
        // Two half-bar rolls; only use pitches actually present in the chosen voicing.
        const roll = [treble[0], treble[1] || treble[0], treble[2] || treble[0]];
        return [bass[0], ...roll, bass[1] || bass[0], ...roll.slice().reverse()];
    }
    return {tuning, scale, note, harmonies, progressions, sounding, openAdvice, picking};
});
