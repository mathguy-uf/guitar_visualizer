/* E-major double-stops, voicings and picking data. String 1 is high e. */
(function(root, factory) {
    const api = factory(typeof module === 'object' && module.exports ? require('./music.js') : root.GuitarMusic);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.GuitarThirds = api;
})(globalThis, Music => {
    'use strict';
    const tuning = Music.tuning;
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
    // Keep the original recipes/API for the explorer's established lesson data.
    // The builder starts with only the two-note fragment, then adds distinct pitches.
    const roles = {0:['1','root'],2:['9','ninth'],3:['♭3','minor third'],4:['3','major third'],5:['4','perfect fourth'],6:['♭5','diminished fifth'],7:['5','perfect fifth'],8:['♯5','augmented fifth'],9:['6','sixth'],10:['♭7','minor seventh'],11:['7','major seventh']};
    const formulas = [
        [[0,4,7], '', 'major','triad'], [[0,3,7], 'm','minor','triad'],
        [[0,3,6], 'dim','diminished','triad'], [[0,4,8], 'aug','augmented','triad'],
        [[0,5,7], 'sus4','suspended','suspended harmony'],
        [[0,2,4,7], 'add9','major','added-note harmony'],
        [[0,4,7,10], '7','dominant','seventh chord'],
        [[0,3,7,10], 'm7','minor','seventh chord'],
        [[0,3,10], 'm7','minor','seventh chord (no fifth)'],
        [[0,4,7,9], '6','major','added-note harmony'],
        [[0,3,7,9], 'm6','minor','added-note harmony'],
        [[0,2,3,7], 'm(add9)','minor','added-note harmony']
    ];
    function identify(notes, root) {
        if(new Set(notes.map(n=>n.string)).size!==notes.length) throw Error('One pitch per string');
        const intervals=[...new Set(notes.map(n=>(n.midi-root+12)%12))].sort((a,b)=>a-b);
        const found=formulas.find(([f])=>f.join()===intervals.join());
        const bass=notes.reduce((a,b)=>a.midi<b.midi?a:b), slash=bass.midi%12===root?'':'/'+bass.name;
        return {root, intervals, bass, known:!!found, quality:found?.[2] || 'color',
            kind:found?.[3] || (intervals.length===2?'double-stop':'color combination'),
            name:found ? names[root]+found[1]+slash+(found[3].includes('no fifth')?' (no fifth)':'') : notes.map(n=>n.name).join(' + '),
            formula:intervals.map(i=>roles[i]?.[0] || '?').join('–')};
    }
    const lessonState = (index=0, variant=index===1?1:0) => ({index,variant,built:false,open:[],fourth:false,full:false});
    const lessonPair = s => s.fourth ? [note(4,2),note(3,2)] : harmonies[s.index].notes;
    const lessonRecipe = s => s.fourth ? v('Esus4',4,'suspended',[0,5,7],[[2,0]],'E–A is a perfect fourth. B adds the fifth. With A replacing G♯, there is no third: this is Esus4.') : harmonies[s.index].variants[s.variant];
    function completion(s) {
        const used = new Set(lessonPair(s).map(n=>n.midi%12));
        return lessonRecipe(s).extra.filter(n=>{if(used.has(n.midi%12))return false;used.add(n.midi%12);return true;});
    }
    function lessonNotes(s) {
        const notes=[...lessonPair(s),...(s.built?(s.full?lessonRecipe(s).extra:completion(s)):[])];
        for(const string of s.open) {
            if(notes.some(n=>n.string===string))throw Error('That string is already in use');
            notes.push(note(string,0));
        }
        return notes;
    }
    function lessonView(s) {
        const pair=lessonPair(s), recipe=lessonRecipe(s), notes=lessonNotes(s), chord=identify(notes,recipe.root);
        const semitones=pair[1].midi-pair[0].midi;
        return {pair,recipe,notes,completion:completion(s),chord,semitones,
            interval:({3:'Minor third',4:'Major third',5:'Perfect fourth'})[semitones],
            noteRoles:notes.map(n=>({...n,role:roles[(n.midi-recipe.root+12)%12]}))};
    }
    function explanation(s) {
        const v=lessonView(s), c=v.chord;
        if(!s.built)return 'A double-stop suggests a harmony. The note you add determines which chord you hear.';
        const unique=v.noteRoles.filter((n,i,all)=>all.findIndex(x=>x.midi%12===n.midi%12)===i);
        let result=unique.map(n=>`${n.name} is the ${n.role[1]}`).join('; ')+'. ';
        if(v.semitones===3&&c.quality==='major')result+='The double-stop is a minor third, but its notes are the third and fifth of this major chord. ';
        if(c.kind==='suspended harmony')result+='The fourth replaces the third, so this harmony is neither major nor minor. ';
        if(c.kind.includes('no fifth'))result+='The fifth is omitted; this is an incomplete seventh chord, not a triad. ';
        if(c.intervals.includes(2)&&!c.intervals.includes(10)&&!c.intervals.includes(11))result+='The added ninth is an extension of the triad; no seventh is present. ';
        if(c.bass.midi%12!==c.root)result+=`${c.bass.name} is the lowest sounding note, so it follows the slash in ${c.name}. `;
        else result+=`${c.bass.name} is the root and the lowest sounding note. `;
        return result.trim();
    }
    function openChoices(s) {
        const view=lessonView(s), target=s.built?view.notes:[...view.pair,...view.completion];
        return [6,5,4,3,2,1].map(string=>{
            const n=note(string,0), active=s.open.includes(string), used=target.find(x=>x.string===string);
            const interval=(n.midi-view.recipe.root+12)%12;
            let reason, allowed=false, result=null;
            if(active) {allowed=true;reason='Added · tap to remove';}
            else if(used) reason=used.fret?'Already fretted · cannot also ring open':'Already in the recipe';
            else if(!scale.includes(n.midi%12)) reason='Chromatic · outside E major';
            else {
                result=identify([...target,n],view.recipe.root);
                allowed=result.known;
                reason=target.some(x=>x.midi%12===n.midi%12)?'Chord tone':({10:'Minor seventh',2:'Ninth',9:'Sixth'}[interval] || 'Tension · changes the harmony');
                if(result.known)reason+=' → '+result.name;
                else reason+='; try a different recipe';
            }
            return {...n,active,allowed,reason,result};
        });
    }
    function addOpen(s,string) {
        const choice=openChoices(s).find(n=>n.string===string);
        if(!s.built || !choice?.allowed)return s;
        return {...s,open:choice.active?s.open.filter(x=>x!==string):[...s.open,string]};
    }
    function lessonEvents(s, mode='roll') {
        const view=lessonView(s), notes=view.notes;
        if(mode==='build') {
            // Pair together, then added notes individually: never ask one thumb to pinch two strings.
            const extra=notes.filter(n=>!view.pair.some(p=>p.string===n.string));
            return [{tick:0,duration:3840,notes:view.pair},
                ...extra.map((n,i)=>({tick:960+i*480,duration:2880-i*480,notes:[n]})),
                {tick:2880,duration:480,notes:[view.pair[0]]},
                {tick:3360,duration:480,notes:[view.pair[1]]}];
        }
        const bass=notes.filter(n=>n.string>=4).sort((a,b)=>a.midi-b.midi);
        const top=notes.filter(n=>n.string<=3).sort((a,b)=>b.string-a.string);
        const r=[top[0],top[1]||top[0],top[2]||top[0]];
        return [bass[0],...r,bass[1]||bass[0],...r.slice().reverse()].map((n,i)=>({tick:i*480,duration:3840-i*480,notes:[n]}));
    }
    const degrees=[['I','IV','V','I'],['I','V','vi','IV'],['I','ii','IV','V7','I']];
    function transition(p,k) {
        const steps=progressions[p].steps, next=steps[(k+1)%steps.length];
        const [,i,v]=steps[k], here=sounding(i,v), there=sounding(next[1],next[2]);
        const shared=[...new Set(here.filter(n=>there.some(x=>x.midi%12===n.midi%12)).map(n=>n.name))];
        return `Next: ${next[0]}. `+(shared.length?`The chords share ${shared.join(' and ')}. `:'No shared chord tones; prepare the next shape. ')+(next[0]==='E'?'Listen for the return home to E.':'Keep a steady pulse as you change shapes.');
    }
    return {tuning, scale, note, harmonies, progressions, sounding, openAdvice, picking,
        roles, identify, lessonState, lessonPair, lessonRecipe, completion, lessonNotes, lessonView, explanation, openChoices, addOpen, lessonEvents, degrees, transition};
});
