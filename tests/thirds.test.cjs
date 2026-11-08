const {test}=require('node:test');
const assert=require('node:assert/strict');
const T=require('../js/thirds.js');

test('E-major thirds match standard tuning, spelling, and the diatonic interval sequence',()=>{
    const lower=['E','F♯','G♯','A','B','C♯','D♯','E'];
    const upper=['G♯','A','B','C♯','D♯','E','F♯','G♯'];
    assert.deepEqual(T.harmonies.map(h=>h.d),[2,4,6,7,9,11,13,14]);
    assert.deepEqual(T.harmonies.map(h=>h.g),[1,2,4,6,8,9,11,13]);
    assert.deepEqual(T.harmonies.map(h=>h.notes[1].midi-h.notes[0].midi),[4,3,3,4,4,3,3,4]);
    T.harmonies.forEach((h,i)=>{
        assert.equal(h.notes[0].name,lower[i]);assert.equal(h.notes[1].name,upper[i]);
        assert.equal(h.notes[0].midi,50+h.d);assert.equal(h.notes[1].midi,55+h.g);
        for(const n of h.notes)assert.ok(T.scale.includes(n.midi%12));
    });
});

test('every chord label matches independently specified pitches, bass and omitted fifth',()=>{
    const expected={E:[4,8,11],'F♯m7 (no fifth)':[6,9,4],'F♯m':[6,9,1],
        'E/G♯':[4,8,11],A:[9,1,4],Aadd9:[9,1,4,11],B:[11,3,6],
        'B7/A':[11,3,6,9],'C♯m':[1,4,8],'C♯m7/B (no fifth)':[1,4,11],'D♯dim/A':[3,6,9]};
    const basses={'E/G♯':8,'B7/A':9,'C♯m7/B (no fifth)':11,'D♯dim/A':9};
    T.harmonies.forEach((h,i)=>h.variants.forEach((v,j)=>{
        const notes=T.sounding(i,j), pitches=[...new Set(notes.map(n=>n.midi%12))].sort((a,b)=>a-b);
        assert.deepEqual(pitches,expected[v.name].slice().sort((a,b)=>a-b),v.name);
        assert.equal(Math.min(...notes.map(n=>n.midi))%12,basses[v.name]??v.root,v.name+' bass');
        assert.equal(new Set(notes.map(n=>n.string)).size,notes.length,'one fret per string');
        const frets=notes.map(n=>n.fret).filter(f=>f>0);
        assert.ok(Math.max(...frets)-Math.min(...frets)<=2,v.name+' practical hand span');
    }));
});

test('drone suggestions never recommend occupied strings or chromatic D and G',()=>{
    T.harmonies.forEach((h,i)=>h.variants.forEach((v,j)=>{
        const advice=T.openAdvice(i,j), notes=T.sounding(i,j);
        for(const a of advice){
            if(a.stable){assert.ok(T.scale.includes(a.midi%12));assert.ok(v.intervals.includes((a.midi%12-v.root+12)%12));assert.ok(!notes.some(n=>n.string===a.string&&n.fret>0));}
            if([4,3].includes(a.string)){assert.equal(a.stable,false);assert.match(a.role,/chromatic/);}
        }
    }));
    assert.match(T.openAdvice(4)[5].role,/11th.*clash/);
    assert.match(T.openAdvice(5)[4].role,/minor 7th.*changes/);
});

test('every roll has eight eighth notes using only the named voicing and the taught picking fingers',()=>{
    T.harmonies.forEach((h,i)=>h.variants.forEach((v,j)=>{
        const roll=T.picking(i,j), notes=T.sounding(i,j);
        assert.equal(roll.length,8);
        assert.equal(roll[0].finger,'P');assert.equal(roll[4].finger,'P');
        for(const n of roll){assert.ok(notes.some(x=>x.string===n.string&&x.fret===n.fret));assert.equal(n.finger,{6:'P',5:'P',4:'P',3:'I',2:'M',1:'A'}[n.string]);}
        assert.deepEqual([...new Set(roll.map(n=>n.midi%12))].sort((a,b)=>a-b),[...new Set(notes.map(n=>n.midi%12))].sort((a,b)=>a-b),'roll preserves all harmony pitches');
    }));
    assert.equal(T.picking(0).map(n=>n.finger).join(''),'PIMAPAMI');
    assert.deepEqual(T.picking(0).filter(n=>n.finger==='P').map(n=>[n.string,n.fret]),[[6,0],[4,2]]);
});

test('progressions select complete major/minor chords and a real dominant seventh',()=>{
    const expected={'E':[4,8,11],'A':[9,1,4],'B':[11,3,6],'C♯m':[1,4,8],'F♯m':[6,9,1],'B7':[11,3,6,9]};
    for(const p of T.progressions)for(const [name,i,v] of p.steps){
        assert.deepEqual([...new Set(T.sounding(i,v).map(n=>n.midi%12))].sort((a,b)=>a-b),expected[name].slice().sort((a,b)=>a-b));
    }
    assert.equal(T.harmonies[2].quality,'minor');assert.equal(T.harmonies[2].variants[0].quality,'major');
    assert.equal(T.harmonies[6].quality,'minor');assert.equal(T.harmonies[6].variants[0].quality,'major');
});

test('builder starts with two notes, then completes each practical triad and recalculates the bass',()=>{
    const expected=[[52,56,59,'E'],[54,57,61,'F♯m'],[56,59,64,'E/G♯'],[57,61,64,'A'],[59,63,66,'B'],[61,64,68,'C♯m'],[63,66,59,'B'],[64,68,59,'E/B']];
    expected.forEach(([a,b,c,name],i)=>{
        const s=T.lessonState(i);assert.equal(T.lessonNotes(s).length,2);
        assert.deepEqual(T.lessonNotes({...s,built:true}).map(n=>n.midi),[a,b,c]);
        const view=T.lessonView({...s,built:true});assert.equal(view.chord.name,name);assert.equal(view.chord.kind,'triad');
    });
    const dim=T.lessonView({...T.lessonState(6,1),built:true});
    assert.equal(dim.chord.name,'D♯dim/A');assert.equal(dim.chord.formula,'1–♭3–♭5');assert.equal(dim.chord.bass.midi,45);
});
test('note roles are relative to the complete chord, not the double-stop root',()=>{
    const s={...T.lessonState(2),built:true},v=T.lessonView(s);
    assert.equal(v.semitones,3);assert.equal(v.chord.quality,'major');
    assert.deepEqual(v.noteRoles.map(n=>n.role[0]),['3','5','1']);
    assert.deepEqual(T.lessonView({...T.lessonState(1),built:true}).noteRoles.map(n=>n.role[0]),['1','♭3','5']);
});
test('open drones preserve a physical voicing and update chord type and inversion',()=>{
    const eg={...T.lessonState(2),built:true};
    assert.equal(T.lessonView(T.addOpen(eg,6)).chord.name,'E');
    const am={...T.lessonState(3),built:true};
    assert.equal(T.lessonView(T.addOpen(am,2)).chord.name,'Aadd9');
    const fm={...T.lessonState(1),built:true};
    assert.equal(T.lessonView(T.addOpen(fm,1)).chord.name,'F♯m7');
    assert.equal(T.lessonView(T.addOpen(fm,6)).chord.name,'F♯m7/E');
    assert.equal(T.addOpen(fm,2),fm,'B string is occupied at fret 2');
    for(const s of [eg,am,fm])for(const n of T.openChoices(s))if(n.allowed){
        const added=T.addOpen(s,n.string);assert.equal(new Set(T.lessonNotes(added).map(n=>n.string)).size,T.lessonNotes(added).length);
        assert.deepEqual(T.addOpen(added,n.string),s);
    }
    assert.equal(T.addOpen(T.lessonState(),6).built,false,'build first');
});
test('perfect fourth comparison resolves the fourth to a major third',()=>{
    const sus={...T.lessonState(),fourth:true,built:true},e={...T.lessonState(),built:true};
    assert.equal(T.lessonView(sus).semitones,5);assert.equal(T.lessonView(sus).chord.name,'Esus4');
    assert.equal(T.lessonView(sus).chord.formula,'1–4–5');
    assert.deepEqual(T.lessonNotes(sus).map(n=>n.midi),[52,57,59]);
    assert.deepEqual(T.lessonNotes(e).map(n=>n.midi),[52,56,59]);
});
test('pinch and roll events use only selected notes, unique fingers, and one bar',()=>{
    for(let i=0;i<8;i++)for(let j=0;j<T.harmonies[i].variants.length;j++)for(const built of [false,true])for(const full of [false,true]){
        const s={...T.lessonState(i,j),built,full};
        for(const mode of ['build','roll']){
            const events=T.lessonEvents(s,mode);assert.equal(new Set(events.map(e=>e.tick)).size,events.length);
            for(const e of events){assert.ok(e.tick+e.duration<=3840);assert.equal(new Set(e.notes.map(n=>n.finger)).size,e.notes.length);for(const n of e.notes)assert.ok(T.lessonNotes(s).some(x=>x.midi===n.midi&&x.string===n.string));}
            if(mode==='build'){assert.equal(events[0].notes.length,2);assert.equal(events[0].tick,0);}
            else{assert.equal(events.length,8);assert.ok(events.every(e=>e.notes.length===1));}
        }
    }
});
