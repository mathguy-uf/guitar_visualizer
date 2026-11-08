const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const M=require('../js/thirds.js');

// A small DOM boundary lets the real controller render and handle events without
// a browser dependency. Layout and pointer hit-testing are checked in-browser.
function lesson({pending=false}={}) {
    const elements=new Map(), played=[], gains=[], timers=new Map(), windowEvents={}, documentEvents={};
    let nextTimer=0, finishResume, failResume, doc;
    const element=id=>{
        if(!elements.has(id))elements.set(id,{id,value:'',checked:true,hidden:false,disabled:false,
            innerHTML:'',textContent:'',dataset:{},listeners:{},scrollHeight:900,clientHeight:400,clientWidth:360,
            classList:{add(){},remove(){},toggle(){}},
            addEventListener(type,fn){this.listeners[type]=fn;},setAttribute(){},
            querySelector(selector){
                const e=element(this.id+selector);
                e.dataset=Object.fromEntries([...selector.matchAll(/data-([a-z-]+)="([^"\n]+)"/g)].map(([,k,v])=>[k.replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v]));
                return e;
            },focus(){doc.activeElement=this;},scrollIntoView(){this.scrolled=true;}});
        return elements.get(id);
    };
    for(const [,id] of fs.readFileSync(require.resolve('../index.html'),'utf8').matchAll(/id="([^"]+)"/g))element(id);
    element('thirdsQuality').value='all';element('thirdsLabels').value='notes';
    element('thirdsPattern').value='build';element('thirdsProgression').value='0';
    const ctx={currentTime:0,state:'suspended',destination:{},listeners:{},
        resume(){
            if(pending)return new Promise((resolve,reject)=>{finishResume=()=>{this.state='running';resolve();};failResume=reject;});
            this.state='running';return Promise.resolve();
        },
        addEventListener(type,fn){this.listeners[type]=fn;},removeEventListener(type){delete this.listeners[type];},
        createGain(){const g={connect(){},disconnect(){this.disconnected=true;}};gains.push(g);return g;}};
    doc={getElementById:element,querySelectorAll:()=>[],addEventListener:(type,fn)=>documentEvents[type]=fn};
    vm.runInNewContext(fs.readFileSync(require.resolve('../js/thirds-lesson.js'),'utf8'),{
        GuitarThirds:M,GuitarAudio:{ensureContext:()=>ctx,pluck:(_ctx,time,midi,duration)=>played.push({time,midi,duration}),message:e=>e.message},
        document:doc,window:{addEventListener:(type,fn)=>windowEvents[type]=fn},
        setTimeout:fn=>{timers.set(++nextTimer,fn);return nextTimer;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>fn(),drawPatternOutlines(){}
    });
    const event=async(id,type='click',dataset={},key)=>{
        const target={dataset,hasAttribute:name=>name==='data-outline'&&'outline' in dataset,closest:()=>target};
        doc.activeElement=target;
        element(id).listeners[type]({type,key,target,preventDefault(){}});
        await Promise.resolve();await Promise.resolve();
    };
    const change=async(id,value)=>{element(id).value=value;await event(id,'change');};
    const advance=seconds=>{ctx.currentTime=seconds;const callbacks=[...timers.values()];timers.clear();callbacks.forEach(fn=>fn());};
    const settle=async()=>{await Promise.resolve();await Promise.resolve();};
    return {element,event,change,played,ctx,doc,gains,timers,advance,windowEvents,documentEvents,settle,
        finishResume:()=>finishResume(),failResume:error=>failResume(error)};
}

test('all eight outline selections synchronize panel, neck, TAB and completed pitch playback',async()=>{
    const u=lesson();
    const pairs=['E + G♯','F♯ + A','G♯ + B','A + C♯','B + D♯','C♯ + E','D♯ + F♯','E + G♯'];
    const pitches=[[52,56,59],[54,57,61],[56,59,64],[57,61,64],[59,63,66],[61,64,68],[63,66,59],[64,68,59]];
    const names=['E','F♯m','E/G♯','A','B','C♯m','B','E/B'];
    for(let i=0;i<8;i++){
        for(const string of ['4','3']){
            await u.event('thirdsNeck','click',{third:String(i),noteString:string});
            assert.ok(u.element('thirdsPairTitle').textContent.startsWith(pairs[i]));
        }
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
    assert.equal(u.element('thirdsChordName').textContent,'Esus4');
    u.advance(1.2);assert.equal(u.element('thirdsChordName').textContent,'E');
    await u.change('thirdsQuality','minor');await u.change('thirdsProgression','2');
    await u.event('thirdsProgressionChords','click',{thirdStep:'3'});
    assert.equal(u.element('thirdsQuality').value,'all');
    assert.equal(u.element('thirdsChordName').textContent,'B7/A');
    assert.match(u.element('thirdsProgressionNote').textContent,/V7.*Next: E/);
    await u.event('thirdsProgressionChords','click',{thirdStep:'4'});
    assert.equal(u.element('thirdsChordName').textContent,'E');
    assert.match(u.element('thirdsVoicing').innerHTML,/>E</);
    assert.doesNotMatch(u.element('thirdsOffer').textContent,/E\/B/,'the fuller progression voicing includes low E');
});
test('guided practice gives retry feedback and builds its target even after browsing elsewhere',async()=>{
    const u=lesson();await u.event('thirdsPracticeStart');
    assert.equal(u.element('thirdsFindHint').hidden,false);assert.equal(u.doc.activeElement.id,'thirdsNeck');
    await u.event('thirdsNeck','click',{third:'3',outline:'3'});
    assert.equal(u.element('thirdsPracticeNext').disabled,true);
    await u.event('thirdsNeck','click',{third:'0',outline:'0'});
    assert.equal(u.doc.activeElement.id,'thirdsPracticeNext');await u.event('thirdsPracticeNext');
    assert.equal(u.element('thirdsFindHint').hidden,true);
    await u.event('thirdsAnswers','click',{answer:'1'});
    assert.match(u.element('thirdsFeedback').textContent,/Try again/);
    await u.change('thirdsHarmony','5');await u.event('thirdsAnswers','click',{answer:'0'});
    assert.equal(u.element('thirdsChordName').textContent,'E');
    for(const answer of ['1','0','0']){await u.event('thirdsPracticeNext');await u.event('thirdsAnswers','click',{answer});}
    await u.event('thirdsPracticeNext');assert.equal(u.element('thirdsQuestion').textContent,'Five challenges complete.');
});

test('resolution changes diagram, explanation and TAB at the sounding chord change, and is cancellable',async()=>{
    const u=lesson();await u.event('thirdsResolve');
    assert.match(u.element('thirdsPairTitle').textContent,/Perfect fourth/);
    assert.match(u.element('thirdsTab').innerHTML,/G fret 2/);
    u.advance(.9);assert.equal(u.element('thirdsChordName').textContent,'Esus4');
    u.advance(1.2);
    assert.match(u.element('thirdsPairTitle').textContent,/Major third/);
    assert.match(u.element('thirdsTab').innerHTML,/G fret 1/);
    assert.match(u.element('thirdsWhy').textContent,/G♯ is the major third/);
    await u.event('thirdsResolve');await u.change('thirdsHarmony','3');u.advance(5);
    assert.match(u.element('thirdsPairTitle').textContent,/A \+ C♯/);
    assert.ok(u.gains.every(g=>g.disconnected));
});
test('interruption and failed or cancelled startup stop audio without a stale Playing indicator',async()=>{
    const u=lesson();await u.event('thirdsHearPair');
    u.ctx.state='interrupted';u.ctx.listeners.statechange();
    assert.equal(u.element('thirdsTabStop').hidden,true);
    assert.match(u.element('thirdsAudioStatus').textContent,/Audio paused/);
    assert.equal(u.timers.size,0);assert.ok(u.gains[0].disconnected);
    await u.event('thirdsHearPair');assert.match(u.element('thirdsAudioStatus').textContent,/Playing/);
    u.windowEvents.pagehide();assert.ok(u.gains[1].disconnected);
    const late=lesson({pending:true});await late.event('thirdsHearPair');await late.event('thirdsTabStop');
    late.finishResume();await late.settle();assert.equal(late.played.length,0);
    const failed=lesson({pending:true});await failed.event('thirdsHearPair');failed.failResume(Error('Could not resume'));await failed.settle();
    assert.equal(failed.played.length,0);assert.equal(failed.element('thirdsAudioStatus').textContent,'Could not resume');
    const stale=lesson({pending:true});await stale.event('thirdsHearPair');await stale.change('thirdsHarmony','3');
    stale.element('thirdsAudioStatus').textContent='A new selection';stale.failResume(Error('Old failure'));await stale.settle();
    assert.equal(stale.element('thirdsAudioStatus').textContent,'A new selection');
});
test('dynamic open-string and progression controls retain keyboard focus after rendering',async()=>{
    const u=lesson();await u.event('thirdsBuild');await u.event('thirdsOpenAdvice','click',{openString:'6'});
    assert.equal(u.doc.activeElement.dataset.openString,'6');
    await u.event('thirdsProgressionChords','click',{thirdStep:'1'});
    assert.equal(u.doc.activeElement.dataset.thirdStep,'1');
    await u.change('thirdsHarmony','7');assert.match(u.element('thirdsVoicing').innerHTML,/>E\/B</);
    await u.event('thirdsQuickBuild');assert.equal(u.element('thirdsChordName').textContent,'E/B');
});
test('TAB audio schedules exact strings and sustains, with a reachable Stop control',async()=>{
    const u=lesson();await u.event('thirdsBuild');await u.event('thirdsOpenAdvice','click',{openString:'6'});
    await u.change('thirdsPattern','roll');u.played.length=0;await u.event('thirdsPlayTab');
    assert.deepEqual(u.played.map(n=>n.midi),[40,56,59,56,52,56,59,56]);
    assert.deepEqual(u.played.map(n=>Math.round((n.time-.04)*70/60*960)),[0,480,960,1440,1920,2400,2880,3360]);
    assert.equal(u.element('thirdsTabStop').hidden,false);
    assert.match(u.element('thirdsTab').innerHTML,/Count 4 &amp;: G fret 1 with I/);
    for(let i=0;i<8;i++){
        const midi=u.played[i].midi,next=u.played.slice(i+1).find(n=>n.midi===midi);
        const end=next?next.time:4*60/70+.04;
        assert.ok(Math.abs(u.played[i].duration-(end-u.played[i].time))<1e-9);
    }
    await u.event('thirdsTabStop');assert.equal(u.element('thirdsTabStop').hidden,true);assert.ok(u.gains.at(-1).disconnected);
});


test('rendered pairs retain their actual independent D/G fret positions and diagonal outlines',async()=>{
    const u=lesson(),d=[217,333,449,507,623,739,855,913],g=[159,217,333,449,565,623,739,855];
    const svg=u.element('thirdsNeck').innerHTML;
    const notes=[...svg.matchAll(/<g [^>]*data-third="(\d+)" data-note-string="(\d+)"[^>]*>(.*?)<\/g>/gs)];
    assert.equal(notes.length,16);
    for(const [,i,string,content] of notes){
        assert.match(content,new RegExp(`cx="${string==='4'?136:180}" cy="${string==='4'?d[i]:g[i]}"`));
    }
    const outlines=[...svg.matchAll(/<ellipse class="thirds-outline quality-[^"]+" ([^>]+)\/>/g)];
    assert.equal(outlines.length,8);
    for(const [,attrs] of outlines)assert.match(attrs,/transform="rotate\(-/,'every third ascends toward the nut on G');
});
