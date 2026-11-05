const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../js/music.js'),E=require('../js/exercises.js');
const ex=id=>E.data.find(e=>e.id===id);

test('every authored note follows thumb E A D / index G / middle B / ring high e',()=>{
    for(const exercise of E.data)for(const event of M.compile(exercise))for(const n of event.notes){
        assert.equal(n.finger,{6:'P',5:'P',4:'P',3:'I',2:'M',1:'A'}[n.string],`${exercise.id} string ${n.string}`);
        assert.equal(n.voice,n.string>=4?'bass':'treble',`${exercise.id} string ${n.string}`);
    }
});
test('every labeled chord contains the played pitches and starts on its root',()=>{
    const chordTones={G:[7,11,2],C:[0,4,7],D:[2,6,9],Em:[4,7,11],Am:[9,0,4],E5:[4,11]};
    for(const exercise of E.data){
        const events=M.compile(exercise);
        for(const c of exercise.chords){
            const bass=events.find(e=>e.tick===c.tick)?.notes.find(n=>n.string>=4&&!n.tie);
            assert.ok(bass,`${exercise.id} ${c.chord} root bass`);
            assert.equal(bass.midi%12,chordTones[c.chord][0]);
        }
        for(const e of events){
            const c=exercise.chords.filter(c=>c.tick<=e.tick).at(-1);
            if(c)for(const n of e.notes)assert.ok(chordTones[c.chord].includes(n.midi%12),`${exercise.id}: ${n.midi} over ${c.chord}`);
        }
    }
});
test('guitar roll order, bass changes, and combined reversals match their finger instructions',()=>{
    for(const [id,expected] of [['forward','PIMAPIMA'],['backward','PAMIPAMI'],['combined','PIMAPAMI']]){
        const first=M.compile(ex(id)).slice(0,8);
        assert.equal(first.map(e=>e.notes[0].finger).join(''),expected);
        assert.deepEqual(first.filter(e=>e.notes[0].finger==='P').map(e=>e.notes[0].string),[6,4]);
        assert.deepEqual(first.map(e=>e.tick),Array.from({length:8},(_,i)=>i*480));
    }
});
test('pinches use separate picking digits and three-string drill is D3 B3 E4, not an E triad',()=>{
    for(const exercise of E.data)for(const e of M.compile(exercise)){
        const attacks=e.notes.filter(n=>!n.tie);
        assert.equal(new Set(attacks.map(n=>n.finger)).size,attacks.length,exercise.id);
    }
    assert.deepEqual(M.compile(ex('three-pinch'))[0].targets,[50,59,64]);
});
test('blues foundation alternates root and fifth E2 B2 with an independent treble voice',()=>{
    const bass=M.compile(ex('blues')).flatMap(e=>e.notes.filter(n=>n.voice==='bass'));
    assert.deepEqual(bass.map(n=>n.midi),[40,47,40,47,40,47,40,47]);
    const t=M.compile(ex('blues'),1);
    assert.equal(t[1].tick,640); // Swung treble, steady quarter-note bass.
    assert.equal(t[2].tick,960);
});
