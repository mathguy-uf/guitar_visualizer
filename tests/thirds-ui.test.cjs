const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const M=require('../js/thirds.js');

// A small DOM boundary lets the real controller render and handle events without
// a browser dependency. Layout and pointer hit-testing are checked in-browser.
function lesson() {
    const elements=new Map(), played=[];
    const element=id=>{
        if(!elements.has(id))elements.set(id,{id,value:'',checked:true,hidden:false,disabled:false,
            innerHTML:'',textContent:'',dataset:{},listeners:{},scrollHeight:900,clientHeight:400,clientWidth:360,
            classList:{add(){},remove(){},toggle(){}},
            addEventListener(type,fn){this.listeners[type]=fn;},setAttribute(){},
            querySelector(){return {focus(){}};},scrollIntoView(){}});
        return elements.get(id);
    };
    for(const [,id] of fs.readFileSync(require.resolve('../index.html'),'utf8').matchAll(/id="([^"]+)"/g))element(id);
    element('thirdsQuality').value='all';element('thirdsLabels').value='notes';
    element('thirdsPattern').value='build';element('thirdsProgression').value='0';
    const ctx={currentTime:0,destination:{},resume:async()=>{},createGain:()=>({connect(){},disconnect(){}})};
    vm.runInNewContext(fs.readFileSync(require.resolve('../js/thirds-lesson.js'),'utf8'),{
        GuitarThirds:M,GuitarAudio:{ensureContext:()=>ctx,pluck:(_ctx,time,midi,duration)=>played.push({time,midi,duration}),message:e=>e.message},
        document:{getElementById:element,querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){}},
        setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:fn=>fn(),drawPatternOutlines(){}
    });
    const event=async(id,type='click',dataset={},key)=>{
        const target={dataset,hasAttribute:name=>name==='data-outline'&&'outline' in dataset,closest:()=>target};
        element(id).listeners[type]({type,key,target,preventDefault(){}});
        await Promise.resolve();await Promise.resolve();
    };
    const change=async(id,value)=>{element(id).value=value;await event(id,'change');};
    return {element,event,change,played};
}

test('all eight outline selections synchronize panel, neck, TAB and completed pitch playback',async()=>{
    const u=lesson();
    const pairs=['E + G♯','F♯ + A','G♯ + B','A + C♯','B + D♯','C♯ + E','D♯ + F♯','E + G♯'];
    const pitches=[[52,56,59],[54,57,61],[56,59,64],[57,61,64],[59,63,66],[61,64,68],[63,66,59],[64,68,59]];
    const names=['E','F♯m','E/G♯','A','B','C♯m','B','E/B'];
    for(let i=0;i<8;i++){
        await u.event('thirdsNeck','click',{third:String(i),outline:String(i)});
        assert.ok(u.element('thirdsPairTitle').textContent.startsWith(pairs[i]));
        assert.equal(u.element('thirdsHear').disabled,true);
        assert.match(u.element('thirdsNeck').innerHTML,new RegExp(`data-outline="${i}" aria-pressed="true"`));
        u.played.length=0;await u.event('thirdsBuild');
        assert.equal(u.element('thirdsChordName').textContent,names[i]);
        assert.deepEqual(u.played.map(n=>n.midi),pitches[i]);
        assert.match(u.element('thirdsTab').innerHTML,/P\+I/);
        assert.match(u.element('thirdsFormula').textContent,/triad/);
    }
});
test('keyboard selection, roles, reset and open-string additions stay synchronized',async()=>{
    const u=lesson();
    await u.event('thirdsNeck','keydown',{third:'2',outline:'2'},'Enter');await u.event('thirdsBuild');
    await u.change('thirdsLabels','roles');
    assert.equal(u.element('thirdsChordName').textContent,'E/G♯');
    assert.match(u.element('thirdsRoles').innerHTML,/G♯ · 3/);
    assert.match(u.element('thirdsWhy').textContent,/minor third.*major chord/);
    await u.event('thirdsOpenAdvice','click',{openString:'6'});
    assert.equal(u.element('thirdsChordName').textContent,'E');
    assert.match(u.element('thirdsSounding').textContent,/E \(low E open\)/);
    assert.match(u.element('thirdsTab').innerHTML,/low E open with P/);
    await u.event('thirdsReset');assert.equal(u.element('thirdsHear').disabled,true);
    assert.equal(u.element('thirdsRoles').innerHTML,'');
    await u.event('thirdsNeck','keydown',{third:'1',outline:'1'},' ');
    assert.match(u.element('thirdsPairTitle').textContent,/F♯ \+ A/);
});
test('fourth resolution and a filtered progression select accurate full harmonies',async()=>{
    const u=lesson();await u.event('thirdsFourth');await u.event('thirdsBuild');
    assert.equal(u.element('thirdsChordName').textContent,'Esus4');
    assert.match(u.element('thirdsFormula').textContent,/1–4–5/);
    u.played.length=0;await u.event('thirdsResolve');
    assert.deepEqual(u.played.map(n=>n.midi),[52,57,59,52,56,59]);
    assert.equal(u.element('thirdsChordName').textContent,'E');
    await u.change('thirdsQuality','minor');await u.change('thirdsProgression','2');
    await u.event('thirdsProgressionChords','click',{thirdStep:'3'});
    assert.equal(u.element('thirdsQuality').value,'all');
    assert.equal(u.element('thirdsChordName').textContent,'B7/A');
    assert.match(u.element('thirdsProgressionNote').textContent,/V7.*Next: E/);
});
test('guided practice gives retry feedback and builds its target even after browsing elsewhere',async()=>{
    const u=lesson();await u.event('thirdsPracticeStart');
    await u.event('thirdsNeck','click',{third:'3',outline:'3'});
    assert.equal(u.element('thirdsPracticeNext').disabled,true);
    await u.event('thirdsNeck','click',{third:'0',outline:'0'});await u.event('thirdsPracticeNext');
    await u.event('thirdsAnswers','click',{answer:'1'});
    assert.match(u.element('thirdsFeedback').textContent,/Try again/);
    await u.change('thirdsHarmony','5');await u.event('thirdsAnswers','click',{answer:'0'});
    assert.equal(u.element('thirdsChordName').textContent,'E');
    for(const answer of ['1','0','0']){await u.event('thirdsPracticeNext');await u.event('thirdsAnswers','click',{answer});}
    await u.event('thirdsPracticeNext');assert.equal(u.element('thirdsQuestion').textContent,'Five challenges complete.');
});
