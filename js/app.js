(function() {
    'use strict';
    const $ = id => document.getElementById(id),
        KEY = 'guitar-practice-v1';
    let current = 'learn',
        tool = 'tuner',
        tourStep = 0,
        saved = {},
        opener = null,
        restoring = true;
    try {
        saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch {}
    const controls = [...document.querySelectorAll('select[id],input[id]')];
    let completed = new Set(Array.isArray(saved.completed) ? saved.completed : []);

    function persist() {
        if (restoring) return;
        try {
            const settings = Object.fromEntries(controls.map(c => [c.id, c.type === 'checkbox' ? c.checked : c.value]));
            localStorage.setItem(KEY, JSON.stringify({
                version: 1,
                loop: GuitarGame.loop,
                section: current,
                tool,
                exercise: GuitarGame.exercise.id,
                learnMode: currentMode,
                settings,
                completed: [...completed],
                welcomed: $('welcome').hidden,
                noiseFloor: GuitarGame.noiseFloor,
                patterns: [...metronomePatterns]
            }));
        } catch {}
    }

    function navigate(section, focus = true) {
        if (!['learn', 'practice', 'play', 'tools'].includes(section)) section = 'learn';
        if (section !== current) {
            GuitarGame.show(false);
            stopTuner();
            stopMetronome();
        }
        current = section;
        $('resumePractice').textContent = 'Return to ' + GuitarGame.exercise.title;
        document.body.dataset.section = section;
        document.querySelectorAll('.app-view').forEach(v => {
            v.hidden = v.id !== 'view-' + section;
        });
        document.querySelectorAll('.primary-nav [data-section]').forEach(b => {
            if (b.dataset.section === section) b.setAttribute('aria-current', 'page');
            else b.removeAttribute('aria-current');
        });
        GuitarGame.show(section === 'play');
        if (section === 'learn') requestAnimationFrame(drawPatternOutlines);
        if (focus) {
            $('view-' + section).querySelector('h1')?.focus({
                preventScroll: true
            });
            window.scrollTo({
                top: 0,
                behavior: 'instant'
            });
        }
        persist();
    }

    function selectTool(next) {
        if (next !== tool) {
            stopTuner();
            stopMetronome();
        }
        tool = next;
        $('tunerPanel').hidden = next !== 'tuner';
        $('metronomePanel').hidden = next !== 'metronome';
        document.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === next)));
        persist();
    }

    function library() {
        $('exerciseLibrary').replaceChildren();
        const query = $('exerciseSearch').value.trim().toLowerCase();
        let found = 0;
        GuitarExercises.levels.forEach((level, index) => {
            const exercises = GuitarExercises.data.filter(e => e.level === index + 1 && (!query || [e.title, e.description, e.tip, level.title].join(' ').toLowerCase().includes(query)));
            if (!exercises.length) return;
            found += exercises.length;
            const details = document.createElement('details');
            details.className = 'lesson-level';
            details.open = !!query || index === 0;
            const summary = document.createElement('summary');
            summary.innerHTML = `<span class="level-number">${index+1}</span><span><strong class="level-name">${level.title}</strong><span class="level-detail">${level.detail}</span></span><span class="level-expand" aria-hidden="true">＋</span>`;
            details.append(summary);
            exercises.forEach(e => {
                const row = document.createElement('article');
                row.className = 'exercise-row';
                const text = document.createElement('div'),
                    heading = document.createElement('h3');
                heading.textContent = e.title;
                if (completed.has(e.id)) {
                    const done = document.createElement('span');
                    done.className = 'completed-label';
                    done.textContent = '✓ Practiced';
                    heading.append(done);
                }
                const desc = document.createElement('p');
                desc.textContent = e.description;
                const meta = document.createElement('span');
                meta.className = 'exercise-meta';
                meta.textContent = `${e.bpm} BPM · ${e.meter.join('/')} · ${e.length/GuitarMusic.barTicks(e.meter)} bars${e.level===4?' · pinch listening is experimental':''}`;
                text.append(heading, desc, meta);
                const actions = document.createElement('div');
                actions.className = 'exercise-actions';
                const listen = document.createElement('button');
                listen.className = 'text-button';
                listen.textContent = '♪ Listen';
                listen.setAttribute('aria-label', 'Listen to ' + e.title);
                listen.addEventListener('click', () => {
                    GuitarGame.choose(e.id);
                    navigate('play');
                    $('gameListen').click();
                });
                const play = document.createElement('button');
                play.className = 'secondary-button';
                play.textContent = 'Practice →';
                play.setAttribute('aria-label', 'Practice ' + e.title);
                play.addEventListener('click', () => {
                    GuitarGame.choose(e.id);
                    navigate('play');
                });
                actions.append(listen, play);
                row.append(text, actions);
                details.append(row);
            });
            $('exerciseLibrary').append(details);
        });
        $('exerciseSearchStatus').hidden = !query;
        $('exerciseSearchStatus').textContent = found ? `${found} exercise${found===1?'':'s'} found` : 'No matches. Try bass, roll, pinch, or blues.';
    }
    $('exerciseSearch').addEventListener('input', library);
    $('exerciseSearch').addEventListener('search', library);
    $('resumePractice').addEventListener('click', () => navigate('play'));
    document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
        if (b.dataset.go === 'tune') {
            selectTool('tuner');
            navigate('tools');
        } else navigate(b.dataset.go);
    }));
    const tabDiagram = `<svg viewBox="0 0 460 160" role="img" aria-label="Six TAB lines: high e, B, G, D, A, low E. Zero on low E means play it open; three on B means fret three. A vertical line marks now."><g fill="none" stroke="#83947b">${[28,48,68,88,108,128].map(y=>`<path d="M55 ${y}H440"/>`).join('')}<path d="M180 12V144" stroke="#e6edd8" stroke-width="3"/></g><g fill="#e6edd8" font-family="system-ui" font-size="14">${['e','B','G','D','A','E'].map((n,i)=>`<text x="20" y="${33+i*20}">${n}</text>`).join('')}<rect x="167" y="117" width="26" height="22" rx="4" fill="#c7dbb5"/><text x="175" y="133" fill="#17231b">0</text><rect x="287" y="37" width="26" height="22" rx="4" fill="#263c2a"/><text x="295" y="53">3</text><text x="155" y="157" font-size="11">play now</text><text x="280" y="82" font-size="11">coming up</text></g></svg>`;
    const topics = [{
        id: 'start',
        title: 'Quick Start',
        body: `<p><b>Learn</b> lets you explore shapes and tap notes to hear them. <b>Practice</b> helps you choose a short exercise.</p><p>For your first game: tap <b>Practice → Tune first</b>, then <b>Choose an exercise</b>. Pick <b>One steady bass</b> or search for <b>forward</b>, turn your phone sideways, and tap <b>Start</b>. Allow microphone access when asked. Learn mode waits while you find each note.</p><p>Try <b>Listen</b> before you play. No microphone is needed. Change to Rhythm mode when the pattern feels comfortable.</p>`
    }, {
        id: 'tab',
        title: 'Reading Tablature',
        body: tabDiagram + `<p>Six lines are your six strings. The thin, high <b>e</b> is at the top; the thick, low <b>E</b> is at the bottom. A number tells you the fret: <b>0 = open string</b>.</p><p>Notes approach the bright vertical line. Play when they reach it. Round markers are bass notes; square markers are treble. Numbers joined in a vertical stack are one pinch: play them together. A line after a number means let it ring; a small curved tie means keep holding without plucking again. There is no new fret-number attack on that tie. “Rest” means leave space.</p><p>The guitar must use standard tuning for the game. The tuner also offers Drop D.</p>`
    }, {
        id: 'fingers',
        title: 'Fingerpicking Basics',
        body: `<div class="finger-guide"><div><b>P</b>Thumb</div><div><b>I</b>Index</div><div><b>M</b>Middle</div><div><b>A</b>Ring</div></div><p>Rest your thumb near the bass strings. I usually plays G, M plays B, and A plays high e. These are helpful suggestions; keep your hand relaxed.</p><p>The microphone hears pitches. It cannot know which physical string or finger made a pitch. Use the tablature as your fingering guide.</p>`
    }, {
        id: 'rolls',
        title: 'Roll Patterns',
        body: `<p><b>Forward:</b> P → I → M → A. Travel from bass toward the thin strings.</p><p><b>Backward:</b> P → A → M → I. Return through the thin strings.</p><p><b>Combined:</b> P I M A · P A M I.</p><p>Give every note the same amount of time. Start slowly enough that your hand can stay loose. The exercises use a bass note at the start of each half bar.</p>`
    }, {
        id: 'bass',
        title: 'Bass Patterns & Chord Changes',
        body: `<div class="count-guide" aria-label="Bass plays on beats one and three"><span class="accent">1 bass</span><span>2</span><span class="accent">3 bass</span><span>4</span></div><p>Let P, your thumb, keep the pulse. An alternating bass moves between two low strings; the TAB tells you which ones.</p><p>Watch the current chord and “next” cue above the TAB. Prepare the next shape while keeping your thumb relaxed. Try the G–C–D roll slowly, or loop the two measures around a difficult change.</p>`
    }, {
        id: 'pinches',
        title: 'Playing Pinches',
        body: `<p><b>P + M</b> means thumb and middle finger together. A vertical connector between fret numbers shows one simultaneous pluck, not a fast roll.</p><p>Start with two strings and a loose hand. Pinch listening is experimental: harmonics can hide a correctly played note. An uncertain reading is unscored; in Learn, use <b>Continue unscored</b> when needed.</p>`
    }, {
        id: 'rhythm',
        title: 'Understanding Rhythm',
        body: `<div class="count-guide" aria-label="Eighth-note count: 1 and 2 and 3 and 4 and"><span class="accent">1</span><span>&amp;</span><span>2</span><span>&amp;</span><span>3</span><span>&amp;</span><span>4</span><span>&amp;</span></div><p><b>Quarter notes:</b> one on each numbered beat. <b>Eighth notes:</b> add the “&amp;” halfway between beats. <b>Sixteenths:</b> count “1 e &amp; a”. <b>Triplets:</b> three even notes in one beat: “1 trip let”.</p><p>The count above the TAB automatically matches the exercise. It shows one useful subdivision, not every possible count. Hide it with <b>Mode &amp; options → Show rhythm counting</b>. The bright count follows the same clock as the notes; swing moves the “&amp;” later.</p><p>In 6/8, count <b>ONE two three FOUR five six</b> as two groups of three eighth notes.</p><p><b>Syncopation</b> puts notes or accents between the strong beats. Try keeping bass on 1 and 3 while playing treble on the &amp; of 2 and 4.</p><p>A dotted note lasts half as long again. Swing makes paired eighths long-short. Triplet and compound exercises keep their own even subdivisions. Game BPM always counts quarter notes; the standalone metronome labels its 6/8 pulse convention.</p><p>In Rhythm mode, early and late mean the pitch was right but the timing was off. The relaxed window gives you room to learn.</p>`
    }, {
        id: 'loop',
        title: 'Looping a Measure',
        body: `<p>Tap <b>Loop measures</b> beside the exercise title. Choose the first and last measure, then tap <b>Loop selection</b>. Choose the same measure twice to practise just that measure.</p><p>Tap <b>Start</b> to play or <b>Listen</b> to hear it. After one count-in, the phrase repeats without stopping. Use the large <b>− / + BPM</b> controls to slow it down or build speed. Learn mode still waits for each note.</p><p>The bass can keep a steady pulse while melody answers between beats. Start with “One note between beats”, then try “Melody between the beats”. Loop one measure until it feels comfortable.</p><p>Notes already ringing into the first measure are <b>plucked again</b> when the loop begins. Holds stop at the selected boundary; the next pass has its own fresh attack. Return to <b>Loop measures → Play whole exercise</b> when you are ready.</p>`
    }, {
        id: 'microphone',
        title: 'Using the Microphone',
        body: `<p>Tap Start to request permission. Your guitar audio is processed here in the browser and is never uploaded or recorded.</p><p>Place the phone near your guitar, away from fans or other music. Open <b>Mode &amp; options → Check microphone &amp; timing</b>. Stay quiet for the room check, then pluck along with eight clicks using headphones.</p><p>The measured offset includes both your device delay and your playing. If notes consistently read late, increase the input timing offset a little. If they read early, reduce it.</p><p>Tuner and game take turns using the microphone. Pausing, changing sections, or leaving the app turns listening off. Tap Start to resume.</p>`
    }, {
        id: 'trouble',
        title: 'Troubleshooting',
        body: `<p><b>No notes heard?</b> Check the site’s microphone permission in Safari, move the phone closer, and recalibrate in a quieter room. Tune first and pluck clearly. Use Listen if microphone access is unavailable.</p><p><b>A note counted twice?</b> Let it decay, keep the room quiet, and stop nearby speakers. The detector looks for a fresh attack; a ringing string should not advance another note.</p><p><b>Pinches seem uncertain?</b> Harmonics and sustain can overlap. Some octave combinations cannot be separated reliably. In Learn mode, “Continue unscored” lets you move on after an uncertain pinch. Rhythm mode leaves uncertain readings unscored and allows a clearer reading before the note’s timing window closes. These are not marked wrong.</p><p><b>The screen is small?</b> Turn your phone sideways. Close the options before playing. Safari’s address bar and your phone’s text size can change the available space.</p><p><b>Audio stopped?</b> Returning from a call, locking the phone, or changing apps pauses the exercise. Tap Start again. Lower the tempo if consecutive notes aren’t clear.</p>`
    }];

    function showHelp(which = 'context') {
        GuitarGame.pause('Paused while you look at help.');
        opener = document.activeElement;
        if (which === 'context') which = current === 'tools' ? (tool === 'tuner' ? 'microphone' : 'rhythm') : current === 'practice' ? 'fingers' : current === 'play' ? 'tab' : 'start';
        $('helpTitle').textContent = 'A little help';
        $('helpContent').replaceChildren();
        for (const topic of topics) {
            const details = document.createElement('details');
            details.className = 'help-topic';
            details.open = topic.id === which;
            details.innerHTML = `<summary>${topic.title}</summary><div>${topic.body}</div>`;
            $('helpContent').append(details);
        }
        if (!$('helpDialog').open) $('helpDialog').showModal();
    }
    const tour = [{
        title: 'A place to get comfortable',
        text: 'Explore the neck in Learn. Choose a key and scale, then tap a note to hear it. Scale & triad settings opens the finer details.',
        diagram: ''
    }, {
        title: 'One small exercise at a time',
        text: 'Practice starts with your thumb and builds toward rolls, chord changes, pinches, and syncopation. Listen first. When you’re ready, choose Practice →.',
        diagram: '<div class="finger-guide"><div><b>P</b>Thumb</div><div><b>I</b>Index</div><div><b>M</b>Middle</div><div><b>A</b>Ring</div></div>'
    }, {
        title: 'Your guitar, your pace',
        text: 'In Play, Learn mode waits for your note. Rhythm mode keeps moving. Turn your phone sideways and use the big Start/Pause button. Tools has the tuner and metronome. The ? is always here.',
        diagram: tabDiagram
    }];

    function tourPage() {
        const step = tour[tourStep];
        $('helpTitle').textContent = step.title;
        $('helpContent').innerHTML = `<p class="tour-step">${tourStep+1} of ${tour.length}</p><p>${step.text}</p>${step.diagram}<div class="tour-actions"><button id="tourSkip" class="text-button">Skip tour</button><button id="tourNext" class="primary-button">${tourStep===tour.length-1?'Let’s play':'Next →'}</button></div>`;
        $('tourSkip').addEventListener('click', finishTour);
        $('tourNext').addEventListener('click', () => {
            if (tourStep === tour.length - 1) finishTour();
            else {
                tourStep++;
                tourPage();
            }
        });
    }

    function startTour() {
        GuitarGame.pause('');
        opener = document.activeElement;
        tourStep = 0;
        tourPage();
        if (!$('helpDialog').open) $('helpDialog').showModal();
    }

    function finishTour() {
        $('welcome').hidden = true;
        $('helpDialog').close();
        persist();
    }
    document.querySelectorAll('.primary-nav [data-section]').forEach(b => b.addEventListener('click', () => navigate(b.dataset.section)));
    document.querySelector('.brand').addEventListener('click', e => {
        e.preventDefault();
        navigate('learn');
    });
    document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => selectTool(b.dataset.tool)));
    document.querySelectorAll('[data-help]').forEach(b => b.addEventListener('click', () => showHelp(b.dataset.help)));
    document.querySelectorAll('[data-exercise]').forEach(b => b.addEventListener('click', () => {
        GuitarGame.choose(b.dataset.exercise);
        navigate('play');
    }));
    $('helpClose').addEventListener('click', () => $('helpDialog').close());
    $('helpDialog').addEventListener('close', () => opener?.focus({
        preventScroll: true
    }));
    $('walkthroughStart').addEventListener('click', startTour);
    $('tourAgain').addEventListener('click', startTour);
    $('welcomeSkip').addEventListener('click', () => {
        $('welcome').hidden = true;
        persist();
    });
    document.addEventListener('change', () => setTimeout(persist, 0));
    document.addEventListener('click', e => {
        if (e.target.closest('#metronomeCount,[data-mode],#resetButton,#loadProgressionButton,#previousChordButton,#nextChordButton,#progressionChips')) setTimeout(persist, 0);
    });
    window.addEventListener('guitar:settings', persist);
    window.addEventListener('guitar:exercise', persist);
    window.addEventListener('guitar:complete', e => {
        completed.add(e.detail.id);
        persist();
        library();
    });
    // Restore selections only. Audio never starts on load.
    if (saved.exercise) GuitarGame.choose(saved.exercise);

    function restoreControls() {
        for (const c of controls)
            if (saved.settings && Object.hasOwn(saved.settings, c.id)) {
                const v = saved.settings[c.id];
                if (c.type === 'checkbox') c.checked = !!v;
                else if (c.tagName === 'SELECT') {
                    if ([...c.options].some(o => o.value === String(v))) c.value = v;
                } else c.value = v;
            }
    }
    restoreControls();
    if (['explore', 'triads', 'solo'].includes(saved.learnMode)) setMode(saved.learnMode);
    restoreControls();
    if (progressionInput.value.trim() && progressionToggle.checked) loadProgression();
    render();
    if (Array.isArray(saved.patterns))
        for (const [key, pattern] of saved.patterns)
            if (Array.isArray(pattern) && pattern.length <= 32) metronomePatterns.set(key, pattern.map(Boolean));
    updateMetronomeDisplay();
    metronomeSlider.value = metronomeBpm.value;
    populateTunerStrings();
    resetTunerDisplay();
    if (saved.noiseFloor) GuitarGame.noiseFloor = saved.noiseFloor;
    if (saved.loop?.exercise === GuitarGame.exercise.id && saved.loop.enabled) GuitarGame.setLoop(saved.loop.first, saved.loop.last);
    GuitarGame.reset();
    $('gameBpm').dispatchEvent(new Event('change'));
    $('welcome').hidden = !!saved.welcomed;
    library();
    selectTool(saved.tool === 'metronome' ? 'metronome' : 'tuner');
    navigate(saved.section || 'learn', false);
    restoring = false;
    window.GuitarApp = {
        navigate,
        persist,
        showHelp
    };
})();
