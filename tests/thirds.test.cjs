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
