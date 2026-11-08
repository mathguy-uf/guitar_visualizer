/* The existing Learn lesson, extended with a two-note -> chord builder. */
(function() {
    'use strict';
    const M=GuitarThirds, $=id=>document.getElementById(id);
    let state=M.lessonState(), step=-1, challenge=-1, correct=false, audioGeneration=0, gain=null, timer=null, audioContext=null;
    const stopButtons=['thirdsStop','thirdsTabStop'];
    const visible=()=>M.harmonies.map((_,i)=>i).filter(i=>$('thirdsQuality').value==='all'||M.harmonies[i].quality===$('thirdsQuality').value);
    const label=i=>M.harmonies[i].notes.map(n=>n.name).join(' + ');
    const y=fret=>130+(fret-.5)*58, xs={6:48,5:92,4:136,3:180,2:224,1:268};
    const text=(x,y,value,cls='')=>`<text x="${x}" y="${y}" class="${cls}" text-anchor="middle" dominant-baseline="middle">${value}</text>`;
    const position=n=>`${['high e','B','G','D','A','low E'][n.string-1]} ${n.fret?'fret '+n.fret:'open'}`;
    const noteLabel=(n,active=true)=>$('thirdsLabels').value==='roles'&&state.built&&active ? M.roles[(n.midi-M.lessonRecipe(state).root+12)%12]?.[0]||n.name : n.name;
    const targetChord=s=>M.identify([...M.lessonPair(s),...M.completion(s)],M.lessonRecipe(s).root);
    const recipeChord=s=>s.full&&!s.fourth?M.identify(M.sounding(s.index,s.variant),M.lessonRecipe(s).root):targetChord(s);
    function neck() {
        $('thirdsNeck').classList.remove('just-built');
        const view=M.lessonView(state), show=$('thirdsShow').checked;
        const indices=state.fourth?[0]:visible();
        const pairFor=i=>state.fourth?view.pair:M.harmonies[i].notes;
        let header='<div class="thirds-neck-top"><svg viewBox="0 0 360 128" role="img" aria-label="Standard tuning and selected open strings"><rect class="thirds-headstock" x="30" y="8" width="256" height="70" rx="22"/>'+text(158,27,'STANDARD TUNING','thirds-small');
        let s='<svg viewBox="0 128 360 857" role="group" aria-labelledby="thirdsNeckTitle"><title id="thirdsNeckTitle">Double-stops on D and G, nut to fret fourteen. Tap a dashed shape or either note.</title>';
        s+='<rect class="thirds-wood" x="30" y="130" width="256" height="812" rx="4"/>';
        for(let f=1;f<=14;f++) {
            s+=`<path class="thirds-fret" d="M30 ${130+f*58}H286"/>`+text(13,y(f),f,'thirds-fret-label');
            for(const x of f===12?[114,202]:[3,5,7,9].includes(f)?[158]:[])s+=`<circle class="thirds-inlay" cx="${x}" cy="${y(f)}" r="5"/>`;
        }
        for(const string of [6,5,4,3,2,1]) {
            s+=`<path class="thirds-string" stroke-width="${1+(string-1)*.24}" d="M${xs[string]} 130V942"/>`;
            header+=`<path class="thirds-string" stroke-width="${1+(string-1)*.24}" d="M${xs[string]} 80V128"/>`+text(xs[string],54,{6:'E',5:'A',4:'D',3:'G',2:'B',1:'e'}[string],'thirds-string-name')+text(xs[string],73,string,'thirds-small');
            const used=view.notes.find(n=>n.string===string), pending=!state.built&&view.completion.find(n=>n.string===string&&n.fret===0);
            const symbol=used?(used.fret===0?noteLabel(used):''):(pending?'?':'X');
            header+=`<g class="${pending&&$('thirdsOpen').checked?'thirds-suggestion':''}">${symbol?`<circle class="thirds-open ${used?.fret===0?'is-open':''}" cx="${xs[string]}" cy="104" r="17"/>`:''}${text(xs[string],105,symbol,'thirds-open-number')}</g>`;
        }
        header+='</svg></div>';
        s+='<path class="thirds-nut" d="M30 130H286"/>'+text(319,139,'Nut','thirds-small');
        if(show&&$('thirdsOutlines').checked)for(const i of [...indices.filter(i=>i!==state.index),state.index].filter(i=>indices.includes(i))) {
            const [d,g]=pairFor(i), a=y(d.fret), b=y(g.fret), cy=(a+b)/2;
            const quality=state.fourth?'fourth':M.harmonies[i].quality;
            const attrs=`cx="158" cy="${cy}" rx="${Math.hypot(44,b-a)/2+25}" ry="26" transform="rotate(${Math.atan2(b-a,44)*180/Math.PI} 158 ${cy})"`;
            const name=`${d.name} + ${g.name}, ${state.fourth?'perfect fourth':quality+' third'}, D fret ${d.fret}, G fret ${g.fret}`;
            s+=`<g role="button" tabindex="0" data-third="${i}" data-outline="${i}" aria-pressed="${i===state.index}" aria-label="Select outline: ${name}" class="thirds-pair-target"><ellipse class="thirds-outline-hit" ${attrs}/><ellipse class="thirds-outline quality-${quality} ${i===state.index?'is-selected':''}" ${attrs}/></g>`;
        }
        for(const n of view.notes.filter(n=>n.fret>0&&!view.pair.some(p=>p.string===n.string)))s+=`<g class="thirds-extra"><circle cx="${xs[n.string]}" cy="${y(n.fret)}" r="17"/>${text(xs[n.string],y(n.fret),noteLabel(n))}</g>`;
        for(const i of indices) {
            const pair=pairFor(i), quality=state.fourth?'fourth':M.harmonies[i].quality;
            if(show)s+=text(321,y(pair[0].fret),state.fourth?'P4':quality==='major'?'Maj 3':'min 3',`thirds-interval quality-${quality}`);
            for(const n of pair.filter(n=>show||n.string===4))s+=`<g role="button" tabindex="0" data-third="${i}" data-note-string="${n.string}" aria-pressed="${i===state.index}" aria-label="Select ${pair.map(p=>p.name).join(' + ')}, D fret ${pair[0].fret}, G fret ${pair[1].fret}" class="thirds-note ${n.string===4?'is-scale':'is-third'} ${i===state.index?'is-selected':''}"><circle class="thirds-hit" cx="${xs[n.string]}" cy="${y(n.fret)}" r="26"/><circle class="thirds-dot" cx="${xs[n.string]}" cy="${y(n.fret)}" r="17"/>${text(xs[n.string],y(n.fret),noteLabel(n,i===state.index))}</g>`;
        }
        $('thirdsNeck').innerHTML=header+s+text(158,967,'Toward the guitar body ↓','thirds-small')+'</svg>';
    }
    function renderTab() {
        const events=M.lessonEvents(state,$('thirdsPattern').value), beats=['1','&amp;','2','&amp;','3','&amp;','4','&amp;'];
        const desc=events.map(e=>`Count ${['1','1 &amp;','2','2 &amp;','3','3 &amp;','4','4 &amp;'][e.tick/480]}: ${e.notes.map(n=>position(n)+' with '+n.finger).join(' together with ')}`).join('; ');
        let s='<svg viewBox="0 0 480 235" role="img" aria-labelledby="thirdsTabTitle"><title id="thirdsTabTitle">4/4. '+desc+'</title>';
        s+=text(24,18,'4/4');
        for(let i=0;i<8;i++)s+=`<g data-tab-slot="${i}">${text(75+i*52,18,beats[i],'thirds-tab-count')}</g>`;
        for(let string=1;string<=6;string++){const yy=50+(string-1)*26;s+=`<path class="thirds-tab-line" d="M49 ${yy}H462"/>`+text(25,yy,['e','B','G','D','A','E'][string-1]);}
        s+='<path class="thirds-tab-line" d="M49 45V185M462 45V185"/>';
        for(let slot=0;slot<8;slot++) {
            const e=events.find(e=>e.tick===slot*480), x=75+slot*52;
            if(!e){s+=text(x,211,'—','thirds-tab-finger');continue;}
            if(e.notes.length>1){const yy=e.notes.map(n=>50+(n.string-1)*26);s+=`<path class="thirds-pinch-line" d="M${x} ${Math.min(...yy)}V${Math.max(...yy)}"/>`;}
            for(const n of e.notes){const yy=50+(n.string-1)*26;s+=`<rect class="thirds-tab-number-bg" x="${x-13}" y="${yy-11}" width="26" height="22" rx="4"/>`+text(x,yy,n.fret,'thirds-tab-number');}
            s+=text(x,211,e.notes.map(n=>n.finger).join('+'),'thirds-tab-finger');
        }
        $('thirdsTab').innerHTML=s+'</svg>';
        $('thirdsPickingNotes').textContent=state.built?'Only the selected voicing is played. Let notes ring inside the bar; damp them before changing chords.':'You are hearing two notes only. Build the chord to add its missing pitch to this TAB.';
    }
    function rememberFocus() {
        const d=document.activeElement?.dataset;
        if(!d)return null;
        if(d.openString!==undefined)return ['thirdsOpenAdvice',`[data-open-string="${d.openString}"]`];
        if(d.thirdStep!==undefined)return ['thirdsProgressionChords',`[data-third-step="${d.thirdStep}"]`];
        if(d.third!==undefined)return ['thirdsNeck',d.outline!==undefined?`[data-outline="${d.third}"]`:`[data-third="${d.third}"][data-note-string="${d.noteString}"]`];
        return null;
    }
    function render() {
        const focus=rememberFocus(), v=M.lessonView(state), c=v.chord;
        $('thirdsHarmony').innerHTML=visible().map(i=>`<option value="${i}">${i+1}. ${label(i)}</option>`).join('');
        $('thirdsHarmony').value=String(state.index);
        $('thirdsVoicing').innerHTML=(state.fourth?[v.recipe]:M.harmonies[state.index].variants).map((_,i)=>`<option value="${i}">${recipeChord({...state,variant:i}).name}</option>`).join('');
        $('thirdsVoicing').value=String(state.fourth?0:state.variant);
        $('thirdsPairTitle').textContent=v.pair.map(n=>n.name).join(' + ')+' = '+v.interval;
        $('thirdsPairMeta').textContent=v.pair.map(position).join(' · ')+` · ${v.semitones} semitones`;
        const target=recipeChord(state);
        $('thirdsOffer').textContent=v.completion.map(n=>`Add ${n.name} (${position(n)}), the ${M.roles[(n.midi-v.recipe.root+12)%12][1]}`).join('; ')+` → ${target.name}.`;
        $('thirdsBuild').textContent=state.built?'✓ Chord built':`Add ${v.completion.map(n=>n.name).join(' + ')} → ${target.name}`;
        $('thirdsBuild').disabled=state.built;
        $('thirdsReset').disabled=!state.built;
        $('thirdsHear').disabled=!state.built;
        $('thirdsQuickTitle').textContent=state.built?`${c.name} · ${c.kind==='triad'?c.quality+' triad · ':''}${c.formula}`:v.pair.map(n=>n.name).join(' + ')+' · '+v.interval;
        $('thirdsQuickBuild').textContent=state.built?`♪ Hear ${c.name}`:`Add ${v.completion.map(n=>n.name).join(' + ')} → ${target.name}`;
        $('thirdsChordName').textContent=state.built?c.name:'Two notes — ready to build';
        $('thirdsChordName').className='thirds-chord-name quality-'+c.quality;
        $('thirdsFormula').textContent=state.built?`${c.formula} · ${c.kind==='triad'?c.quality+' ':''}${c.kind}`:'';
        $('thirdsWhy').textContent=M.explanation(state);
        $('thirdsRoles').innerHTML=state.built?v.noteRoles.map(n=>`<span><b>${n.name} · ${n.role?.[0]||'?'}</b><small>${n.role?.[1]||'color tone'} · ${position(n)}</small></span>`).join(''):'';
        $('thirdsSounding').textContent='Sounding: '+v.notes.map(n=>`${n.name} (${position(n)})`).join(' · ');
        $('thirdsOpenAdvice').innerHTML=M.openChoices(state).map(n=>`<button data-open-string="${n.string}" aria-pressed="${n.active}" ${!state.built||!n.allowed?'disabled':''}><b>${position(n)}</b><span>${n.reason}</span></button>`).join('');
        const p=Number($('thirdsProgression').value);
        $('thirdsProgressionChords').innerHTML=M.progressions[p].steps.map(([name,i,r],k)=>`<button data-third-step="${k}" class="quality-${M.harmonies[i].variants[r].quality}" aria-pressed="${step===k}">${name}<span>${M.degrees[p][k]}</span></button>`).join('');
        $('thirdsProgressionNote').textContent=step<0?'Tap a chord to build and hear its voicing.':`${M.degrees[p][step]} · ${c.name}. ${M.transition(p,step)}`;
        $('thirdsPrev').disabled=state.index===visible()[0];$('thirdsNext').disabled=state.index===visible().at(-1);
        neck();renderTab();
        if(focus)$(focus[0]).querySelector(focus[1])?.focus({preventScroll:true});
    }
    function stop() {
        if(!$('thirdsStop').hidden)$('thirdsAudioStatus').textContent='Sound stopped.';
        audioGeneration++;clearTimeout(timer);gain?.disconnect();gain=null;
        audioContext?.removeEventListener('statechange',interrupted);audioContext=null;
        stopButtons.forEach(id=>$(id).hidden=true);
        $('thirdsQuickHear').textContent='♪ Hear two notes';
        document.querySelectorAll('[data-tab-slot]').forEach(el=>el.classList.remove('is-playing'));
    }
    function interrupted() {
        if(audioContext?.state!=='running'){stop();$('thirdsAudioStatus').textContent='Audio paused. Tap Hear or Play to try again.';}
    }
    async function play(events, message, duration=1, showCount=false) {
        stop();const generation=audioGeneration;
        try {
            const ctx=GuitarAudio.ensureContext();await ctx.resume();if(generation!==audioGeneration)return;
            if(ctx.state!=='running')throw Error('Audio paused. Tap Hear or Play to try again.');
            audioContext=ctx;ctx.addEventListener('statechange',interrupted);
            gain=ctx.createGain();gain.connect(ctx.destination);const start=ctx.currentTime+.04;
            for(const e of events)for(const n of e.notes)GuitarAudio.pluck(ctx,start+e.time,n.midi,n.duration??e.duration??.7,gain);
            $('thirdsAudioStatus').textContent=message;stopButtons.forEach(id=>$(id).hidden=false);
            $('thirdsQuickHear').textContent='■ Stop sound';
            function update() {
                if(generation!==audioGeneration)return;
                const elapsed=ctx.currentTime-start;
                let frame;for(const e of events)if(e.state&&e.time<=elapsed)frame=e;
                if(frame&&state!==frame.state){state=frame.state;render();}
                if(showCount)document.querySelectorAll('[data-tab-slot]').forEach(el=>el.classList.toggle('is-playing',Number(el.dataset.tabSlot)===Math.floor(elapsed/(60/70/2))));
                if(elapsed>=duration){stop();$('thirdsAudioStatus').textContent='Finished. Try it on your guitar.';return;}
                timer=setTimeout(update,40);
            }
            update();
        }catch(e){if(generation!==audioGeneration)return;stop();$('thirdsAudioStatus').textContent=GuitarAudio.message(e);}
    }
    function hear(pair=false) {return play([{time:0,notes:pair?M.lessonPair(state):M.lessonNotes(state)}],pair?'Playing the two-note double-stop.':'Playing '+M.lessonView(state).chord.name+'.');}
    function select(i,variant,overrides={},progressionStep=-1) {
        stop();state={...M.lessonState(i,variant),...overrides};step=progressionStep;render();
        const neck=$('thirdsNeck'), pair=M.lessonPair(state);
        if(neck.scrollHeight>neck.clientHeight)neck.scrollTop=i===0?0:Math.max(0,(y(pair[0].fret)+y(pair[1].fret))/2*neck.clientWidth/360-(neck.clientHeight+128*neck.clientWidth/360)/2);
    }
    function reveal() {$('thirdsQuality').value='all';$('thirdsShow').checked=true;$('thirdsOutlines').checked=true;}
    function build() {state={...state,built:true};render();$('thirdsNeck').classList.remove('just-built');void $('thirdsNeck').offsetWidth;$('thirdsNeck').classList.add('just-built');hear();}
    for(const b of document.querySelectorAll('[data-learn-view]'))b.addEventListener('click',()=>{
        stop();const lesson=b.dataset.learnView==='thirds';$('learnExplorer').hidden=lesson;$('thirdsLesson').hidden=!lesson;
        document.querySelectorAll('[data-learn-view]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));
        if(!lesson)requestAnimationFrame(drawPatternOutlines);
    });
    $('thirdsHarmony').addEventListener('change',()=>select(Number($('thirdsHarmony').value)));
    $('thirdsVoicing').addEventListener('change',()=>{stop();state={...state,variant:Number($('thirdsVoicing').value),built:false,open:[],full:false};step=-1;render();});
    $('thirdsQuality').addEventListener('change',()=>select(visible().includes(state.index)?state.index:visible()[0]));
    for(const id of ['thirdsShow','thirdsOutlines','thirdsOpen','thirdsLabels'])$(id).addEventListener('change',render);
    $('thirdsPattern').addEventListener('change',()=>{stop();renderTab();});
    for(const [id,delta] of [['thirdsPrev',-1],['thirdsNext',1]])$(id).addEventListener('click',()=>select(visible()[visible().indexOf(state.index)+delta]));
    $('thirdsBuild').addEventListener('click',build);
    $('thirdsQuickBuild').addEventListener('click',()=>state.built?hear():build());
    $('thirdsQuickHear').addEventListener('click',()=>$('thirdsStop').hidden?hear(true):stop());
    $('thirdsReset').addEventListener('click',()=>{stop();state={...state,built:false,open:[],full:false};step=-1;render();});
    $('thirdsHearPair').addEventListener('click',()=>hear(true));$('thirdsHear').addEventListener('click',()=>hear());stopButtons.forEach(id=>$(id).addEventListener('click',stop));
    $('thirdsOpenAdvice').addEventListener('click',e=>{const b=e.target.closest('[data-open-string]');if(!b||b.disabled)return;stop();state=M.addOpen(state,Number(b.dataset.openString));step=-1;render();hear();});
    $('thirdsPlayTab').addEventListener('click',()=>{const events=M.lessonEvents(state,$('thirdsPattern').value);play(events.map(e=>({time:e.tick/960*60/70,notes:e.notes.map(n=>({...n,duration:n.duration/960*60/70}))})), 'Playing the bar at 70 BPM.',4*60/70,true);});
    $('thirdsProgression').addEventListener('change',()=>{step=-1;stop();render();});
    $('thirdsProgressionChords').addEventListener('click',e=>{
        const b=e.target.closest('[data-third-step]');if(!b)return;reveal();
        const k=Number(b.dataset.thirdStep), [,i,r]=M.progressions[Number($('thirdsProgression').value)].steps[k];
        select(i,r,{built:true,full:true},k);hear();
    });
    function activate(e) {
        const target=e.target.closest('[data-third]');if(!target)return;
        if(e.type==='keydown'&&!['Enter',' '].includes(e.key))return;
        e.preventDefault();const i=Number(target.dataset.third), fourth=state.fourth, isOutline=target.hasAttribute('data-outline'), string=target.dataset.noteString;
        select(i,undefined,{fourth});
        if(e.type==='keydown')$('thirdsNeck').querySelector(isOutline?`[data-outline="${i}"]`:`[data-third="${i}"][data-note-string="${string}"]`)?.focus({preventScroll:true});
        if(challenge===0){correct=i===0&&!fourth;feedback(correct?'Yes: E at D2 and G♯ at G1. That is a major third.':'Look near the nut: E is at D2 and G♯ at G1. Try their dashed outline.');if(correct){$('thirdsChallenge').scrollIntoView({block:'nearest'});$('thirdsPracticeNext').focus({preventScroll:true});}}
    }
    $('thirdsNeck').addEventListener('click',activate);$('thirdsNeck').addEventListener('keydown',activate);
    $('thirdsFourth').addEventListener('click',()=>{reveal();select(0,undefined,{fourth:true});$('thirdsPairTitle').scrollIntoView({block:'nearest'});hear(true);});
    $('thirdsResolve').addEventListener('click',()=>{
        reveal();select(0,undefined,{built:true,fourth:true});
        const sus=state, resolved={...state,fourth:false};
        play([{time:0,notes:M.lessonNotes(sus),state:sus,duration:.85},{time:1.1,notes:M.lessonNotes(resolved),state:resolved,duration:1}], 'Esus4 → E major: A moves down one fret to G♯.',2.2);
    });
    const questions=[
        ['Find E and G♯. Tap their outline or either note near the nut.',[],null],
        ['Which note completes E major from E–G♯?',['B','C','D'],'B'],
        ['F♯–A needs which note for F♯ minor?',['B','C♯','D♯'],'C♯'],
        ['Which note completes A major from A–C♯?',['E','F','G'],'E'],
        ['Why can the minor third G♯–B belong to E major?',['They are E’s third and fifth.','Every minor third makes a minor chord.','B changes to B♭.'],'They are E’s third and fifth.']
    ];
    const explanations=['','B is the perfect fifth: E–G♯–B = 1–3–5.','C♯ is the perfect fifth: F♯–A–C♯ = 1–♭3–5.','E is the perfect fifth: A–C♯–E = 1–3–5.','Exactly. Adding E reveals the root; G♯ is the major third and B the fifth.'];
    function feedback(message){
        $('thirdsFeedback').textContent=message;$('thirdsPracticeNext').disabled=!correct;
        $('thirdsFindHint').hidden=challenge!==0;
        $('thirdsFindHint').textContent=message||'Find E at D2 and G♯ at G1. Tap their outline or either note.';
    }
    function showChallenge() {
        correct=false;reveal();select([1,0,1,3,2][challenge]);
        $('thirdsChallenge').hidden=false;$('thirdsQuestion').textContent=`${challenge+1} / 5 · ${questions[challenge][0]}`;
        $('thirdsAnswers').innerHTML=questions[challenge][1].map((answer,i)=>`<button class="secondary-button" data-answer="${i}">${answer}</button>`).join('');
        $('thirdsPracticeNext').textContent=challenge===4?'Finish practice':'Next challenge →';feedback('');
        if(challenge===0){$('thirdsNeck').scrollIntoView({block:'center'});$('thirdsNeck').focus({preventScroll:true});}
    }
    $('thirdsPracticeStart').addEventListener('click',()=>{challenge=0;showChallenge();});
    $('thirdsAnswers').addEventListener('click',e=>{const b=e.target.closest('[data-answer]');if(!b||challenge<1)return;correct=questions[challenge][1][Number(b.dataset.answer)]===questions[challenge][2];feedback(correct?explanations[challenge]:'Try again. Think of the root, third and fifth of the target chord.');if(correct){reveal();select([1,0,1,3,2][challenge]);build();}});
    $('thirdsPracticeNext').addEventListener('click',()=>{if(!correct)return;if(challenge===4){challenge=-1;$('thirdsAnswers').innerHTML='';$('thirdsQuestion').textContent='Five challenges complete.';feedback('You can now turn two-note fragments into chords. Try your own progression.');$('thirdsPracticeNext').disabled=true;}else{challenge++;showChallenge();}});
    document.querySelectorAll('.primary-nav button,[data-help],[data-go],.brand').forEach(b=>b.addEventListener('click',stop));
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',stop);
    if(!visible().includes(state.index))state=M.lessonState(visible()[0]);
    render();
    document.querySelectorAll('[data-learn-view]').forEach(button=>button.disabled=false);
})();
