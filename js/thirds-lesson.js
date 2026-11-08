/* Isolated Learn lesson: it never changes the explorer or game settings. */
(function() {
    'use strict';
    const M = GuitarThirds, $ = id => document.getElementById(id);
    let selected = 0, variant = 0, step = -1;
    const visible = () => M.harmonies.map((h,i) => i).filter(i => $('thirdsQuality').value === 'all' || M.harmonies[i].quality === $('thirdsQuality').value);
    const qualityName = q => q === 'major' ? 'Major third' : 'Minor third';
    const label = i => M.harmonies[i].notes.map(n => n.name).join(' + ');
    const chord = () => M.harmonies[selected].variants[variant];
    const y = fret => 130 + (fret - .5) * 58;
    const xs = {6:48,5:92,4:136,3:180,2:224,1:268};
    const text = (x,y,value,cls = '') => `<text x="${x}" y="${y}" class="${cls}" text-anchor="middle" dominant-baseline="middle">${value}</text>`;
    function neck() {
        const showThirds = $('thirdsShow').checked, outlines = $('thirdsOutlines').checked;
        const indices = visible();
        let s = '<svg viewBox="0 0 360 985" aria-labelledby="thirdsNeckTitle thirdsNeckDesc" role="group"><title id="thirdsNeckTitle">E major harmonized thirds, nut to fret fourteen</title><desc id="thirdsNeckDesc">Vertical fretboard, low E at left and high e at right. Blue notes on D, cream notes on G. Tap either note to select its pair. Fret numbers run down toward the guitar body.</desc>';
        s += '<rect class="thirds-headstock" x="30" y="8" width="256" height="70" rx="22"/>' + text(158,27,'STANDARD TUNING','thirds-small');
        s += '<rect class="thirds-wood" x="30" y="130" width="256" height="812" rx="4"/>';
        for (let f=1; f<=14; f++) {
            s += `<path class="thirds-fret" d="M30 ${130+f*58}H286"/>` + text(13,y(f),f,'thirds-fret-label');
            if ([3,5,7,9].includes(f)) s += `<circle class="thirds-inlay" cx="158" cy="${y(f)}" r="5"/>`;
            if (f===12) s += [114,202].map(x => `<circle class="thirds-inlay" cx="${x}" cy="${y(f)}" r="5"/>`).join('');
        }
        for (const string of [6,5,4,3,2,1]) {
            s += `<path class="thirds-string" stroke-width="${1+(string-1)*.24}" d="M${xs[string]} 80V942"/>`;
            s += text(xs[string],54,`${{6:'E',5:'A',4:'D',3:'G',2:'B',1:'e'}[string]}`,'thirds-string-name');
            s += text(xs[string],73,string,'thirds-small');
        }
        s += '<path class="thirds-nut" d="M30 130H286"/>' + text(319,130,'Nut','thirds-small');
        const advice = M.openAdvice(selected,variant);
        for (const a of advice) {
            const used = M.sounding(selected,variant).find(n=>n.string===a.string);
            const lit = $('thirdsOpen').checked && a.stable && used?.fret===0;
            const symbol = used ? (used.fret===0?'O':'') : 'X';
            s += (symbol ? `<circle class="thirds-open ${lit?'is-open':''}" cx="${xs[a.string]}" cy="104" r="16"/>` : '') + text(xs[a.string],105,symbol,'thirds-open-number');
        }
        if (showThirds && outlines) for (const i of [...indices.filter(i=>i!==selected), selected].filter(i=>indices.includes(i))) {
            const h=M.harmonies[i], a=y(h.d), b=y(h.g), cx=158, cy=(a+b)/2;
            const angle = Math.atan2(b-a,44)*180/Math.PI, radius=Math.hypot(44,b-a)/2+25;
            s += `<ellipse class="thirds-outline quality-${h.quality} ${i===selected?'is-selected':''}" cx="${cx}" cy="${cy}" rx="${radius}" ry="26" transform="rotate(${angle} ${cx} ${cy})"/>`;
        }
        // Extra fretted tones complete B / C♯m / F♯m, where open strings cannot.
        for (const n of chord().extra.filter(n=>n.fret>0)) {
            s += `<g class="thirds-extra"><circle cx="${xs[n.string]}" cy="${y(n.fret)}" r="17"/>${text(xs[n.string],y(n.fret),n.name)}</g>`;
        }
        for (const i of indices) {
            const h = M.harmonies[i];
            if (showThirds) s += text(321,y(h.d),h.quality==='major'?'Maj 3':'min 3',`thirds-interval quality-${h.quality}`);
            for (const n of h.notes.filter(n=>showThirds || n.string===4)) {
                s += `<g role="button" tabindex="0" data-third="${i}" aria-pressed="${i===selected}" aria-label="${label(i)}, ${qualityName(h.quality)}, D fret ${h.d}, G fret ${h.g}" class="thirds-note ${n.string===4?'is-scale':'is-third'} ${i===selected?'is-selected':''}"><circle class="thirds-hit" cx="${xs[n.string]}" cy="${y(n.fret)}" r="26"/><circle class="thirds-dot" cx="${xs[n.string]}" cy="${y(n.fret)}" r="17"/>${text(xs[n.string],y(n.fret),n.name)}</g>`;
            }
        }
        s += text(158,967,'Toward the guitar body ↓','thirds-small') + '</svg>';
        $('thirdsNeck').innerHTML=s;
    }
    function options() {
        $('thirdsHarmony').innerHTML = visible().map(i=>`<option value="${i}">${i+1}. ${label(i)} · ${qualityName(M.harmonies[i].quality)}</option>`).join('');
        $('thirdsHarmony').value=String(selected);
        $('thirdsVoicing').innerHTML=M.harmonies[selected].variants.map((v,i)=>`<option value="${i}">${v.name}</option>`).join('');
        $('thirdsVoicing').value=String(variant);
    }
    function tab() {
        const events=M.picking(selected,variant), beats=['1','&amp;','2','&amp;','3','&amp;','4','&amp;'];
        let s = '<svg viewBox="0 0 480 230" role="img" aria-labelledby="thirdsTabTitle"><title id="thirdsTabTitle">4/4 eighth-note roll for '+chord().name+'. '+events.map((n,i)=>`${i%2===0?(i/2+1):'and'}: string ${n.string} fret ${n.fret} with ${n.finger}`).join('; ')+'</title>';
        s += text(25,18,'4/4','thirds-tab-meter');
        for(let i=0;i<8;i++) s+=text(75+i*52,18,beats[i],'thirds-tab-count');
        for(let string=1;string<=6;string++) {
            const yy=50+(string-1)*26;
            s+=`<path class="thirds-tab-line" d="M49 ${yy}H462"/>`+text(25,yy,['e','B','G','D','A','E'][string-1]);
        }
        s+='<path class="thirds-tab-line" d="M49 45V185M462 45V185"/>';
        events.forEach((n,i)=>{const x=75+i*52, yy=50+(n.string-1)*26;
            s+=`<rect class="thirds-tab-number-bg" x="${x-13}" y="${yy-11}" width="26" height="22" rx="4"/>`+text(x,yy,n.fret,'thirds-tab-number')+text(x,211,n.finger,'thirds-tab-finger');});
        $('thirdsTab').innerHTML=s+'</svg>';
        $('thirdsPickingNotes').textContent = 'Pluck only the numbered strings. Let notes ring within the bar; damp them before changing harmony. ' + (events[0].string!==events[4].string?'The thumb alternates two bass strings on beats 1 and 3.':'Keep the same thumb bass on beats 1 and 3 for this voicing.');
    }
    function render() {
        options(); neck(); tab();
        const h=M.harmonies[selected], c=chord();
        $('thirdsPairTitle').textContent=label(selected);
        $('thirdsPairMeta').textContent=`D string fret ${h.d} · G string fret ${h.g} · ${qualityName(h.quality)} (${h.quality==='major'?4:3} semitones)`;
        $('thirdsChordName').textContent=c.name;
        $('thirdsChordName').className='thirds-chord-name quality-'+c.quality;
        $('thirdsWhy').textContent=c.why;
        $('thirdsSounding').textContent='Sounding notes: '+M.sounding(selected,variant).map(n=>`${n.name} (${n.fret===0?'open':`fret ${n.fret}`} ${['e','B','G','D','A','E'][n.string-1]})`).join(' · ');
        $('thirdsOpenAdvice').innerHTML=M.openAdvice(selected,variant).map(a=>`<li class="${$('thirdsOpen').checked&&a.stable?'is-compatible':''}"><b>${a.string===1?'High e':a.string===6?'Low E':a.name}</b><span>${a.role}</span></li>`).join('');
        const progression=$('thirdsProgression').value;
        $('thirdsProgressionChords').innerHTML=progression===''?'':M.progressions[Number(progression)].steps.map(([name,i,v],k)=>`<button type="button" data-third-step="${k}" class="quality-${M.harmonies[i].variants[v].quality}" aria-pressed="${k===step}">${name}<span>${k+1}</span></button>`).join('');
        $('thirdsProgressionNote').textContent=progression===''?'Choose a progression, then tap a chord to find its harmony.':step<0?'Tap a chord to follow this progression.':`Chord ${step+1}: ${M.progressions[Number(progression)].steps[step][0]} · sounding voicing: ${c.name}.`;
        $('thirdsPrev').disabled=selected===visible()[0];
        $('thirdsNext').disabled=selected===visible().at(-1);
    }
    function select(i, v=0) {
        selected=i; variant=v; render();
        const neck=$('thirdsNeck');
        if(neck.scrollHeight>neck.clientHeight) {
            const center=(y(M.harmonies[i].d)+y(M.harmonies[i].g))/2*neck.clientWidth/360;
            neck.scrollTop=i===0?0:Math.max(0,center-neck.clientHeight/2);
        }
    }
    for(const b of document.querySelectorAll('[data-learn-view]')) b.addEventListener('click',()=>{
        const lesson=b.dataset.learnView==='thirds';
        $('learnExplorer').hidden=lesson; $('thirdsLesson').hidden=!lesson;
        document.querySelectorAll('[data-learn-view]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));
        if(!lesson) requestAnimationFrame(drawPatternOutlines);
    });
    $('thirdsHarmony').addEventListener('change',()=>{step=-1;select(Number($('thirdsHarmony').value));});
    $('thirdsVoicing').addEventListener('change',()=>{step=-1;variant=Number($('thirdsVoicing').value);render();});
    $('thirdsQuality').addEventListener('change',()=>{step=-1;if(!visible().includes(selected)){selected=visible()[0];variant=0;}render();});
    for(const id of ['thirdsShow','thirdsOutlines','thirdsOpen']) $(id).addEventListener('change',render);
    for(const [id,delta] of [['thirdsPrev',-1],['thirdsNext',1]]) $(id).addEventListener('click',()=>{step=-1;select(visible()[visible().indexOf(selected)+delta]);});
    $('thirdsProgression').addEventListener('change',()=>{step=-1;render();});
    $('thirdsProgressionChords').addEventListener('click',e=>{
        const b=e.target.closest('[data-third-step]');if(!b)return;
        step=Number(b.dataset.thirdStep);
        const [,i,v]=M.progressions[Number($('thirdsProgression').value)].steps[step];
        // A progression must reveal its selected notes, even after a restrictive filter.
        $('thirdsQuality').value='all';$('thirdsShow').checked=true;$('thirdsOutlines').checked=true;
        select(i,v);
    });
    function activate(e) {
        const target=e.target.closest('[data-third]');if(!target)return;
        if(e.type==='keydown'&&!['Enter',' '].includes(e.key))return;
        if(e.type==='keydown')e.preventDefault();
        step=-1;const i=Number(target.dataset.third);select(i);
        if(e.type==='keydown') $('thirdsNeck').querySelector(`[data-third="${i}"]`).focus();
    }
    $('thirdsNeck').addEventListener('click',activate);$('thirdsNeck').addEventListener('keydown',activate);
    async function hear(pairOnly) {
        try {
            const ctx=GuitarAudio.ensureContext();await ctx.resume();
            (pairOnly?M.harmonies[selected].notes:M.sounding(selected,variant)).forEach(n=>GuitarAudio.pluck(ctx,ctx.currentTime+.02,n.midi,.8));
            $('thirdsAudioStatus').textContent='Played '+(pairOnly?label(selected):chord().name)+'.';
        }catch(e){$('thirdsAudioStatus').textContent=GuitarAudio.message(e);}
    }
    $('thirdsHear').addEventListener('click',()=>hear(false));
    $('thirdsHearPair').addEventListener('click',()=>hear(true));
    // These controls belong to the lesson, rather than the explorer's restored settings.
    // Initialize after app.js has restored its controls so its saved state is honored.
    if(!visible().includes(selected))selected=visible()[0];
    render();
})();
