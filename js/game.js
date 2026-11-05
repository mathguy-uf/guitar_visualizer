(function() {
    'use strict';
    const M = GuitarMusic,
        R = GuitarRhythm,
        library = GuitarExercises.data,
        $ = id => document.getElementById(id);
    const canvas = $('tabCanvas'),
        paint = canvas.getContext('2d');
    let exercise = library[0],
        events = [],
        session, timeline, clock, ctx, listener = null,
        source = null,
        gate = null;
    let running = false,
        demo = false,
        busy = false,
        token = 0,
        frame = null,
        timer = null,
        scheduled = new Set(),
        settledThrough = -Infinity,
        lastAnalysisAt = 0;
    let cursor = 0,
        displayCursor = 0,
        feedback = '',
        noiseFloor = .004,
        finished = false,
        calibration = null,
        repeatTimer = null;
    let loop = {
        enabled: false,
        first: 1,
        last: 1
    };
    let lastBeat = '',
        lastStats = '',
        lastChord = '',
        viewVisible = false;
    const values = () => ({
        mode: $('gameMode').value,
        bpm: Number($('gameBpm').value) || 55,
        swing: Number($('gameSwing').value),
        latency: Number($('gameLatency').value) || 0,
        tolerance: Number($('gameTolerance').value)
    });

    function say(text) {
        if (text !== feedback) {
            feedback = text;
            $('gameFeedback').textContent = text;
        }
    }

    function build() {
        timeline = new R.Timeline(exercise, {
            swing: values().swing,
            loop: loop.enabled,
            first: loop.enabled ? loop.first : 1,
            last: loop.enabled ? loop.last : null
        });
        events = timeline.events;
        session = new M.Session(events, values().mode, values().tolerance);
    }

    function updateSummary() {
        const v = values();
        $('setupSummary').textContent = `${v.mode==='learn'?'Learn':'Rhythm'} · ${v.bpm} BPM`;
        $('tempoReadout').textContent = v.bpm;
    }

    function setRunning(value) {
        running = value;
        document.body.classList.toggle('game-running', value);
        $('gameStart').textContent = value ? 'Ⅱ Pause' : finished ? '↺ Play again' : '▶ Start';
        $('gameStart').setAttribute('aria-pressed', String(value));
        $('gameListen').textContent = value && demo ? '■ Stop listening' : '♪ Listen';
        $('gameMode').disabled = value;
        $('gameSwing').disabled = value;
        $('gameTolerance').disabled = value;
        $('gameLatency').disabled = value;
        $('calibrateButton').disabled = value;
    }

    function killOutput() {
        if (gate) {
            gate.disconnect();
            gate = null;
        }
        scheduled.clear();
    }

    function stopAnalysis() {
        listener?.stop();
        listener = null;
        GuitarAudio.release('game');
        source = null;
    }

    function cancelRepeat() {
        if (repeatTimer !== null) clearTimeout(repeatTimer);
        repeatTimer = null;
    }

    function pause(message = 'Paused. Take your time.') {
        token++;
        busy = false;
        $('gameStart').removeAttribute('aria-busy');
        cancelRepeat();
        if (clock?.running) {
            const position = clock.position();
            // Revisit audio that was still in flight when playback stopped.
            // Releasing the microphone must not later turn that gap into misses.
            cursor = !demo && values().mode === 'rhythm' ?
                Math.min(position, Number.isFinite(settledThrough) ? clock.position(settledThrough) : (session.next()?.tick ?? position)) :
                position;
            clock.pause();
        }
        setRunning(false);
        if (timer) clearInterval(timer);
        timer = null;
        killOutput();
        stopAnalysis();
        if (message) say(message);
        draw();
    }

    function reset() {
        pause('');
        $('acceptPinch').hidden = true;
        finished = false;
        cursor = 0;
        displayCursor = 0;
        build();
        updateLoopLabel();
        textScore();
        $('gameResults').hidden = true;
        setRunning(false);
        say(loop.enabled ? `Looping ${loop.first===loop.last?'measure '+loop.first:'measures '+loop.first+'–'+loop.last}. Tap Start when you’re ready.` : values().mode === 'learn' ? 'Pluck the highlighted note. The game will wait.' : 'One bar to settle in, then follow the playhead.');
        draw();
    }

    function textScore() {
        $('textScore').replaceChildren(...timeline.template.map(e => {
            const li = document.createElement('li');
            const guide = timeline.counts.find(g => Math.abs(g.tick - e.tick) < 1e-6);
            li.textContent = `Measure ${timeline.first+Math.floor(e.tick/timeline.bar)}, count ${guide?.spoken||'1'}: ${e.notes.length?e.notes.map(n=>`${n.tie?'hold':'play'} string ${n.string}, fret ${n.fret}${n.finger?' ('+n.finger+')':''}`).join(' + '):'rest'}; duration ${e.duration/M.PPQ} quarter beats.`;
            return li;
        }));
    }

    function choose(id) {
        const next = library.find(e => e.id === id);
        if (!next) return;
        exercise = next;
        loop = {
            enabled: false,
            first: 1,
            last: 1
        };
        pause('');
        $('gameTitle').textContent = exercise.title;
        $('gameLevel').textContent = `Level ${exercise.level} · ${GuitarExercises.levels[exercise.level-1].title}`;
        $('gameTip').textContent = exercise.tip;
        $('rhythmNote').textContent = exercise.lesson || 'Round notes: bass · Square notes: treble · Stacked notes: play together.';
        $('gameBpm').value = exercise.bpm;
        $('gameSwing').value = exercise.swing || 0;
        updateSummary();
        configureLoop();
        reset();
        window.dispatchEvent(new CustomEvent('guitar:exercise', {
            detail: {
                id: exercise.id
            }
        }));
    }

    function updateLoopLabel() {
        $('loopButton').textContent = loop.enabled ? `↻ Loop ${loop.first}${loop.last===loop.first?'':'–'+loop.last}` : '↻ Loop measures';
        $('loopButton').setAttribute('aria-label', loop.enabled ? `Change loop: measures ${loop.first} to ${loop.last}` : 'Loop measures');
        $('loopFirst').value = String(loop.first);
        $('loopLast').value = String(loop.last);
        $('gameRepeat').disabled = loop.enabled;
    }

    function configureLoop() {
        const total = Math.ceil(exercise.length / M.barTicks(exercise.meter));
        for (const id of ['loopFirst', 'loopLast']) {
            $(id).replaceChildren(...Array.from({
                length: total
            }, (_, i) => {
                const option = document.createElement('option');
                option.value = String(i + 1);
                const chord = exercise.chords.filter(c => c.tick <= i * M.barTicks(exercise.meter)).at(-1)?.chord;
                option.textContent = `Measure ${i+1}${chord?' · '+chord:''}`;
                return option;
            }));
        }
        updateLoopLabel();
    }

    function setLoop(first, last, enabled = true) {
        const total = Math.ceil(exercise.length / M.barTicks(exercise.meter));
        first = Math.max(1, Math.min(total, Math.trunc(first) || 1));
        last = Math.max(first, Math.min(total, Math.trunc(last) || first));
        loop = {
            enabled: !!enabled,
            first,
            last
        };
        reset();
        window.dispatchEvent(new Event('guitar:settings'));
    }

    function currentTick() {
        return running && (demo || values().mode === 'rhythm') ? clock.position() : cursor;
    }

    function expectedAt(tick) {
        const pending = events.filter(e => e.targets.length && !session.results.has(e.id));
        if (values().mode === 'learn') return pending[0];
        return pending.reduce((best, e) => !best || Math.abs(e.tick - tick) < Math.abs(best.tick - tick) ? e : best, null);
    }

    function analysisTarget(time) {
        if (values().mode === 'learn' || !clock) {
            const e = session.next();
            return {
                expected: e?.targets || [],
                eventId: e?.id
            };
        }
        const playedAt = time - values().latency / 1000;
        // Include already-judged events here: their ringing audio still belongs
        // to the captured time, even after the screen advances to another note.
        const e = events.filter(e => e.targets.length).reduce((best, e) => !best ||
            Math.abs(clock.timeAt(e.tick) - playedAt) < Math.abs(clock.timeAt(best.tick) - playedAt) ? e : best, null);
        return {
            expected: e?.targets || [],
            eventId: e?.id
        };
    }

    function expireAnalysed() {
        if (!running || demo || values().mode !== 'rhythm' || !Number.isFinite(settledThrough)) return;
        const before = session.summary().missed;
        session.expire(clock.position(settledThrough), values().bpm, e => settledThrough - clock.timeAt(e.tick));
        if (session.summary().missed > before) say('That note passed. Find the next one.');
    }

    function receive(data) {
        if (data.type === 'error') {
            pause(data.message);
            if (calibration) endCalibration();
            return;
        }
        if (calibration) {
            calibrateInput(data);
            return;
        }
        if (!running || demo) return;
        lastAnalysisAt = ctx.currentTime;
        if (data.attack) {
            const v = values();
            const tick = v.mode === 'learn' ? (session.next()?.tick || 0) : clock.position(data.attack.time - v.latency / 1000);
            if (tick < 0 && data.attack.time - v.latency / 1000 < clock.timeAt(0) - v.tolerance) return;
            const result = session.input({
                tick,
                pitches: data.attack.pitches,
                confidence: data.attack.confidence,
                time: data.attack.time - v.latency / 1000,
                timeAt: tick => clock.timeAt(tick),
                eventId: data.eventId
            }, v.bpm);
            $('acceptPinch').hidden = !(result.kind === 'uncertain' && v.mode === 'learn' && result.event?.targets.length > 1);
            const text = {
                correct: '✓ Right there.',
                early: '✓ Right note · a little early',
                late: '✓ Right note · a little late',
                wrong: 'Try the highlighted pitch again.',
                uncertain: result.event?.targets.length > 1 ? 'Couldn’t judge that pinch. Keep going gently.' : 'Couldn’t hear a clear pitch. Try another gentle pluck.',
                extra: 'An extra note · settle into the pulse.'
            } [result.kind];
            say(result.extra ? text + ' Extra pitch heard.' : text);
            if (v.mode === 'learn' && ['correct', 'early', 'late'].includes(result.kind)) {
                if (loop.enabled) timeline.ensureThrough(tick + timeline.length);
                const next = session.next();
                cursor = next ? next.tick : timeline.length;
                if (!next) {
                    complete();
                    return;
                }
            }
            animate();
        }
        // Score the attack before advancing the analysed-audio deadline.
        const analysed = data.settledThrough ?? data.time;
        if (Number.isFinite(analysed)) settledThrough = Math.max(settledThrough, analysed - values().latency / 1000);
        expireAnalysed();
    }

    function schedule() {
        if (!running) return;
        const tick = currentTick(),
            v = values(),
            now = ctx.currentTime;
        if (!demo && now - lastAnalysisAt > 1) {
            pause('Listening fell behind. Tap Start to continue without losing your place.');
            return;
        }
        if (loop.enabled) {
            timeline.ensureThrough(tick + M.PPQ);
            const cutoff = tick - 2 * timeline.length;
            if (cutoff > 0) {
                session.archiveBefore(cutoff, demo);
                const ids = new Set(events.map(e => e.id));
                for (const key of scheduled) {
                    if (key.startsWith('beat') ? Number(key.slice(4)) * M.PPQ * 4 / exercise.meter[1] < cutoff : !ids.has(Number(key.slice(4)))) scheduled.delete(key);
                }
            }
        }
        expireAnalysed();
        if (clock.running) {
            const ahead = clock.position(now + .11);
            const pulse = M.PPQ * 4 / exercise.meter[1];
            const first = Math.max(-exercise.meter[0], Math.floor(tick / pulse) - 1),
                last = Math.ceil(ahead / pulse);
            for (let beat = first; beat <= last; beat++) {
                const bt = beat * pulse,
                    key = 'beat' + beat,
                    time = clock.timeAt(bt);
                if (scheduled.has(key) || time < now - .015 || time > now + .11 || (!loop.enabled && bt >= timeline.length)) continue;
                if (((beat < 0 || $('gameClick').checked) && values().mode === 'rhythm') || (demo && $('gameClick').checked)) {
                    GuitarAudio.click(ctx, Math.max(time, now), ((beat % exercise.meter[0]) + exercise.meter[0]) % exercise.meter[0] === 0 || (exercise.meter[0] === 6 && ((beat % 6) + 6) % 6 === 3), gate);
                }
                scheduled.add(key);
            }
            if (demo)
                for (const e of events) {
                    const key = 'note' + e.id,
                        time = clock.timeAt(e.tick);
                    if (scheduled.has(key) || time < now - .02 || time > now + .11) continue;
                    for (const n of e.notes.filter(n => !n.tie)) {
                        const end = R.sustainEnd(events, e, n, (e.cycle + 1) * timeline.length);
                        GuitarAudio.pluck(ctx, Math.max(time, now), n.midi, (end - e.tick) / M.PPQ * 60 / v.bpm, gate);
                    }
                    scheduled.add(key);
                }
        }
        const endTime = clock.timeAt(timeline.length) + v.tolerance;
        if (!loop.enabled && (demo ? tick >= timeline.length : v.mode === 'rhythm' && now >= endTime && settledThrough >= endTime)) complete();
    }
    async function start(listenOnly = false) {
        if (busy) {
            pause('Start cancelled.');
            return;
        }
        if (running) {
            pause();
            return;
        }
        if (finished || demo !== listenOnly) reset();
        if (calibration) endCalibration();
        stopMetronome();
        stopTuner();
        cancelRepeat();
        const generation = ++token;
        busy = true;
        demo = listenOnly;
        $('gameStart').textContent = 'Starting…';
        $('gameStart').setAttribute('aria-busy', 'true');
        $('gameResults').hidden = true;
        try {
            ctx = GuitarAudio.ensureContext();
            const resumed = ctx.resume();
            if (!demo) {
                say('Allow the microphone, then get comfortable.');
                const handle = await GuitarAudio.acquire('game', () => {
                    if (running) pause('Microphone stopped. Tap Start to continue.');
                });
                if (generation !== token) {
                    handle.source.disconnect();
                    return;
                }
                source = handle.source;
                const analysis = await GuitarAudio.listen(handle, data => {
                    if (generation === token) receive(data);
                }, analysisTarget);
                if (generation !== token) {
                    analysis.stop();
                    return;
                }
                listener = analysis;
                listener.floor(noiseFloor);
            } else await resumed;
            if (generation !== token) return;
            clock = new M.Transport(() => ctx.currentTime, values().bpm);
            gate = ctx.createGain();
            gate.connect(ctx.destination);
            settledThrough = -Infinity;
            lastAnalysisAt = ctx.currentTime;
            scheduled.clear();
            if (demo || values().mode === 'rhythm') clock.start(cursor === 0 ? -M.barTicks(exercise.meter) : cursor);
            else clock.seek(cursor);
            setRunning(true);
            $('gameSettings').open = false;
            busy = false;
            say(demo ? 'Listen to the pattern. Join in when you feel ready.' : values().mode === 'learn' ? 'Play the note at the line. There’s no rush.' : `Count in: ${Array.from({length:exercise.meter[0]},(_,i)=>i+1).join(' · ')}`);
            listener?.reset();
            schedule();
            timer = setInterval(schedule, 25);
            animate();
        } catch (error) {
            if (generation !== token) return;
            pause('');
            say(GuitarAudio.message(error));
        } finally {
            if (generation === token) {
                busy = false;
                $('gameStart').removeAttribute('aria-busy');
                if (!running) setRunning(false);
            }
        }
    }

    function complete() {
        if (finished) return;
        const wasDemo = demo;
        const summary = session.summary();
        pause('');
        $('acceptPinch').hidden = true;
        finished = true;
        setRunning(false);
        cursor = timeline.length;
        displayCursor = cursor;
        if (wasDemo) {
            say('That’s the pattern. Tap Start to try it yourself.');
            demo = false;
            finished = false;
            setRunning(false);
            cursor = 0;
            displayCursor = 0;
            build();
            draw();
            return;
        }
        $('gameResults').hidden = false;
        $('resultText').textContent = values().mode === 'learn' ? `${summary.hits} of ${summary.total} note groups verified. Your best run was ${summary.best} in a row. ${summary.wrong?'You worked through '+summary.wrong+' pitch retries. ':''}${summary.uncertain?summary.uncertain+' pinches continued unscored. ':''}Ready for another pass?` : `${summary.hits} of ${summary.total} note groups played · ${summary.onTime} on time · ${summary.missed} missed. ${summary.wrong} wrong-pitch attempts; ${summary.extras} extra pitches. ${summary.uncertain?summary.uncertain+' readings were uncertain and excluded from accuracy. ':''}${summary.accuracy===null?'':summary.accuracy+'% pitch coverage among judged groups. '}${summary.meanMs===null?'':'Average timing distance: '+summary.meanMs+' ms.'}`;
        say('Nice work. Repeat this one, or take the next small step.');
        window.dispatchEvent(new CustomEvent('guitar:complete', {
            detail: {
                id: exercise.id,
                summary
            }
        }));
        if ($('gameRepeat').checked) {
            $('gameResults').hidden = true;
            say('Take a breath. Repeating with a one-bar lead-in…');
            repeatTimer = setTimeout(() => {
                reset();
                start();
            }, 2000);
        }
        draw();
    }

    function tempo(value) {
        const old = values().bpm;
        const bpm = Math.max(30, Math.min(180, Math.round(Number(value) || exercise.bpm)));
        $('gameBpm').value = bpm;
        if (clock) {
            clock.setTempo(bpm);
            const position = clock.position();
            const past = new Set([...scheduled].filter(key => key.startsWith('beat') ? Number(key.slice(4)) * M.PPQ * 4 / exercise.meter[1] <= position : (!events.find(e => e.id === Number(key.slice(4)))) || events.find(e => e.id === Number(key.slice(4))).tick <= position));
            killOutput();
            scheduled = past;
            if (running) {
                gate = ctx.createGain();
                gate.connect(ctx.destination);
            }
        }
        updateSummary();
        if (old !== bpm) window.dispatchEvent(new Event('guitar:settings'));
        draw();
    }

    function draw() {
        if (!viewVisible) return;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2),
            w = rect.width,
            h = rect.height;
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
        }
        paint.setTransform(dpr, 0, 0, dpr, 0, 0);
        paint.clearRect(0, 0, w, h);
        const tick = currentTick();
        if (running && (demo || values().mode === 'rhythm')) displayCursor = tick;
        else displayCursor += (cursor - displayCursor) * .22;
        const counts = $('gameCounts').checked;
        const x0 = Math.max(90, Math.min(180, w * .24)),
            spacing = Math.max(75, Math.min(125, (w - x0 - 28) / 4));
        const top = counts ? (h < 185 ? 38 : 52) : h < 185 ? 20 : 32,
            bottom = h - (h < 185 ? 16 : 24),
            dy = (bottom - top) / 5;
        const x = t => R.xAt(t, displayCursor, spacing, x0);
        const visibleStart = displayCursor - x0 / spacing * M.PPQ,
            visibleEnd = displayCursor + (w - x0) / spacing * M.PPQ;
        const guides = timeline.guides(visibleStart - M.PPQ, visibleEnd + M.PPQ),
            currentCount = timeline.countAt(tick);
        paint.textAlign = 'center';
        paint.textBaseline = 'middle';
        for (const guide of guides) {
            const gx = x(guide.tick);
            if (gx < 40 || gx > w + 15) continue;
            if (guide.strong) {
                paint.strokeStyle = guide.barStart ? '#718269' : '#2e4031';
                paint.lineWidth = guide.barStart ? 1.4 : 1;
                paint.beginPath();
                paint.moveTo(gx, counts ? 26 : 8);
                paint.lineTo(gx, h - 8);
                paint.stroke();
            }
            if (counts) {
                const active = currentCount && Math.abs(guide.sourceTick - currentCount.sourceTick) < 1e-6 && guide.cycle === timeline.infoAt(tick).cycle && tick >= 0;
                if (active) {
                    paint.strokeStyle = '#d8e5cb';
                    paint.lineWidth = 1;
                    paint.beginPath();
                    paint.roundRect(gx - 15, 3, 30, 21, 5);
                    paint.stroke();
                }
                paint.fillStyle = active ? '#f1f5e8' : guide.strong ? '#c9d7c0' : '#92a68b';
                paint.font = `${guide.strong?'600 ':''}${timeline.style==='triplet'?10:11}px system-ui`;
                paint.fillText(guide.label, gx, 14);
                if (!guide.strong) {
                    paint.strokeStyle = '#52684b';
                    paint.setLineDash([2, 3]);
                    paint.beginPath();
                    paint.moveTo(gx, 25);
                    paint.lineTo(gx, 31);
                    paint.stroke();
                    paint.setLineDash([]);
                }
            }
        }
        for (let s = 0; s < 6; s++) {
            const y = top + dy * s;
            paint.strokeStyle = s >= 3 ? '#84917c' : '#61725c';
            paint.lineWidth = 1 + s * .16;
            paint.beginPath();
            paint.moveTo(38, y);
            paint.lineTo(w, y);
            paint.stroke();
        }
        const lineTop = counts ? 28 : 8;
        paint.fillStyle = '#e3ecd3';
        paint.fillRect(x0 - 1.5, lineTop, 3, h - lineTop - 10);
        paint.beginPath();
        paint.moveTo(x0 - 6, lineTop - 5);
        paint.lineTo(x0 + 6, lineTop - 5);
        paint.lineTo(x0, lineTop + 1);
        paint.fill();
        paint.save();
        paint.beginPath();
        paint.rect(42, lineTop, w - 42, h - lineTop);
        paint.clip();
        const next = session.next();
        for (const e of events) {
            const nx = x(e.tick);
            const visualEnd = Math.max(e.tick + e.duration, ...e.notes.map(n => R.sustainEnd(events, e, n, (e.cycle + 1) * timeline.length)));
            if (nx > w + 40 || x(visualEnd) < 25) continue;
            const result = session.results.get(e.id),
                active = !demo && e.id === next?.id;
            const attacks = e.notes.filter(n => !n.tie);
            // A single connector makes stacked notes read as one pinch.
            if (attacks.length > 1 && nx > 30) {
                paint.strokeStyle = active ? '#dce8cf' : '#6d8265';
                paint.lineWidth = 2;
                const rows = attacks.map(n => n.string - 1);
                paint.beginPath();
                paint.moveTo(nx, top + dy * Math.min(...rows));
                paint.lineTo(nx, top + dy * Math.max(...rows));
                paint.stroke();
            }
            for (const rest of e.rests || []) {
                const row = rest.voice === 'bass' ? 4.4 : rest.voice === 'treble' ? .8 : 2.5;
                paint.fillStyle = '#91a28b';
                paint.font = '10px system-ui';
                paint.fillText('rest', nx, top + dy * row);
            }
            for (const n of e.notes) {
                const y = top + dy * (n.string - 1),
                    end = R.sustainEnd(events, e, n, (e.cycle + 1) * timeline.length);
                const noteHeight = Math.max(18, Math.min(27, dy * .80)),
                    boxWidth = n.fret >= 10 ? 32 : 26;
                if (!n.tie && end > e.tick + M.PPQ * .99) {
                    paint.strokeStyle = '#a1b494';
                    paint.lineWidth = 1.5;
                    paint.beginPath();
                    paint.moveTo(Math.max(42, nx + boxWidth / 2 + 3), y);
                    paint.lineTo(Math.min(w, x(end) - 8), y);
                    paint.stroke();
                }
                if (nx < 28) continue;
                if (n.tie) {
                    paint.strokeStyle = '#a1b494';
                    paint.lineWidth = 1;
                    paint.beginPath();
                    paint.arc(nx - 8, y + 2, 10, Math.PI, 2 * Math.PI);
                    paint.stroke();
                    continue;
                }
                const bass = n.voice === 'bass';
                const fill = result ? result.kind === 'missed' ? '#6d7469' : result.kind === 'uncertain' ? '#9c957b' : '#c7dbb5' : active ? '#e3ecd3' : bass ? '#344b36' : '#203426';
                paint.fillStyle = '#101713';
                paint.fillRect(nx - boxWidth / 2 - 3, y - noteHeight / 2 - 2, boxWidth + 6, noteHeight + 4);
                paint.fillStyle = fill;
                paint.beginPath();
                paint.roundRect(nx - boxWidth / 2, y - noteHeight / 2, boxWidth, noteHeight, bass ? noteHeight / 2 : 4);
                paint.fill();
                paint.strokeStyle = active ? '#edf2df' : bass ? '#b3c5a6' : '#78916d';
                paint.lineWidth = active ? 2 : 1;
                paint.stroke();
                paint.fillStyle = result || active ? '#17231b' : '#f2f2e9';
                paint.font = `600 ${Math.max(13,Math.min(18,dy*.55))}px system-ui`;
                paint.fillText(String(n.fret), nx, y + .5);
                if ($('gameFingers').checked && dy >= 25) {
                    paint.fillStyle = '#aebfa5';
                    paint.font = '9px system-ui';
                    paint.fillText(n.finger || '', nx, y - noteHeight / 2 - 7);
                } else if ($('gameFingers').checked && dy >= 18) {
                    paint.fillStyle = '#a8bca1';
                    paint.font = '8px system-ui';
                    paint.fillText(n.finger || '', nx + 20, y - 6);
                }
                if (e.accent) {
                    paint.fillStyle = '#d4dca9';
                    paint.font = '11px system-ui';
                    paint.fillText('›', nx + boxWidth / 2 + 7, y);
                }
                if (result) {
                    paint.fillStyle = '#c7dbb5';
                    paint.font = '9px system-ui';
                    paint.fillText(result.kind === 'missed' ? '×' : result.kind === 'uncertain' ? '?' : '✓', nx, y + noteHeight / 2 + 6);
                }
            }
        }
        paint.restore();
        paint.fillStyle = '#101713';
        paint.fillRect(0, 0, 38, h);
        paint.textAlign = 'left';
        ['e', 'B', 'G', 'D', 'A', 'E'].forEach((label, i) => {
            paint.fillStyle = i >= 3 ? '#e0e7d7' : '#becdb6';
            paint.font = '600 13px system-ui';
            paint.fillText(label, 9, top + dy * i);
            paint.fillStyle = '#82957b';
            paint.font = '9px system-ui';
            paint.fillText(String(i + 1), 24, top + dy * i);
        });
        const pulse = M.PPQ * 4 / exercise.meter[1];
        const beatLabel = tick < 0 ? `Get ready · ${Math.max(1,Math.ceil(-tick/pulse))}` : values().mode === 'learn' && !demo ? 'Learn · at your pace' : `${exercise.meter.join('/')} · ${currentCount?.spoken||'1'}`;
        if (beatLabel !== lastBeat) $('gameBeat').textContent = lastBeat = beatLabel;
        const stats = loop.enabled ? `Pass ${timeline.infoAt(tick).pass} · ${demo?'Listen':session.summary().hits+' verified'}` : demo ? 'Listen · no scoring' : `${session.summary().hits} verified · streak ${session.streak}`;
        if (stats !== lastStats) $('gameStats').textContent = lastStats = stats;
        const chordInfo = timeline.chordAt(tick),
            chord = `${chordInfo.current}${chordInfo.next?' · next '+chordInfo.next:''}`;
        if (chord !== lastChord) $('gameChord').textContent = lastChord = chord;
        const target = expectedAt(tick),
            description = target ? target.notes.filter(n => !n.tie).map(n => `${M.noteName(n.midi)}, string ${n.string}, fret ${n.fret}`).join(' and ') : 'Exercise complete';
        const accessibleLabel = `Guitar tablature. Current target: ${description}. High e at top, low E at bottom. ${counts?'Count '+(currentCount?.spoken||'1')+'.':''}`;
        if (canvas.getAttribute('aria-label') !== accessibleLabel) {
            canvas.setAttribute('data-target', description);
            canvas.setAttribute('aria-label', accessibleLabel);
        }
    }

    function animate() {
        if (frame !== null) cancelAnimationFrame(frame);
        const render = () => {
            frame = null;
            draw();
            if (viewVisible && (running || Math.abs(cursor - displayCursor) > 1)) frame = requestAnimationFrame(render);
        };
        frame = requestAnimationFrame(render);
    }
    async function startCalibration() {
        endCalibration();
        pause('');
        stopTuner();
        stopMetronome();
        const generation = ++token;
        $('calibrationStart').disabled = true;
        try {
            ctx = GuitarAudio.ensureContext();
            const handle = await GuitarAudio.acquire('game', () => {
                if (calibration) endCalibration();
            });
            if (generation !== token) {
                handle.source.disconnect();
                return;
            }
            const analysis = await GuitarAudio.listen(handle, data => {
                if (generation === token) receive(data);
            });
            if (generation !== token) {
                analysis.stop();
                return;
            }
            listener = analysis;
            listener.target([]);
            listener.reset();
            calibration = {
                stage: 'room',
                start: ctx.currentTime,
                readings: [],
                offsets: [],
                beats: [],
                used: new Set()
            };
            $('calibrationMessage').textContent = 'Stay quiet for two seconds…';
            $('calibrationProgress').value = 0;
            timer = setInterval(calibrationTick, 25);
        } catch (error) {
            if (generation !== token) return;
            endCalibration();
            $('calibrationMessage').textContent = GuitarAudio.message(error);
        }
    }

    function calibrationTick() {
        if (!calibration) return;
        const c = calibration,
            now = ctx.currentTime;
        if (c.stage === 'room') {
            $('calibrationProgress').value = Math.min(2, now - c.start);
            if (now - c.start >= 2) {
                const samples = c.readings.sort((a, b) => a - b);
                noiseFloor = Math.max(.003, Math.min(.05, (samples[Math.floor(samples.length * .85)] || .001) * 3));
                listener.floor(noiseFloor);
                c.stage = 'timing';
                c.start = now + .5;
                c.beats = Array.from({
                    length: 8
                }, (_, i) => c.start + i);
                gate = ctx.createGain();
                gate.connect(ctx.destination);
                scheduled.clear();
                $('calibrationMessage').textContent = 'Pluck one open string with each click. Eight gentle, steady plucks.';
            }
        } else {
            $('calibrationProgress').value = 2 + Math.max(0, now - c.start);
            c.beats.forEach((time, i) => {
                if (!scheduled.has(i) && time >= now - .02 && time < now + .12) {
                    GuitarAudio.click(ctx, Math.max(time, now), i === 0, gate);
                    scheduled.add(i);
                }
            });
            if (now > c.start + 8) {
                const offsets = c.offsets.sort((a, b) => a - b);
                const offset = offsets.length >= 4 ? Math.max(-300, Math.min(400, Math.round(offsets[Math.floor(offsets.length / 2)] * 1000 / 5) * 5)) : null;
                if (offset !== null) $('gameLatency').value = offset;
                $('calibrationProgress').value = 10;
                const message = offset === null ? 'Room check saved. We didn’t hear four clear plucks, so the timing offset is unchanged. Try again with headphones, or adjust it in options.' : `Room check saved. Timing offset: ${offset} ms from ${offsets.length} plucks. Try a slow exercise and adjust if needed.`;
                endCalibration();
                $('calibrationMessage').textContent = message;
                window.dispatchEvent(new Event('guitar:settings'));
            }
        }
    }

    function calibrateInput(data) {
        const c = calibration;
        if (c.stage === 'room') {
            c.readings.push(data.rms);
            return;
        }
        if (!data.attack || !data.attack.pitches.length || data.attack.confidence < .6) return;
        const nearest = c.beats.reduce((best, time, i) => Math.abs(data.attack.time - time) < Math.abs(data.attack.time - c.beats[best]) ? i : best, 0);
        const offset = data.attack.time - c.beats[nearest];
        if (Math.abs(offset) < .4 && !c.used.has(nearest)) {
            c.used.add(nearest);
            c.offsets.push(offset);
        }
    }

    function endCalibration() {
        calibration = null;
        token++;
        if (timer) clearInterval(timer);
        timer = null;
        killOutput();
        stopAnalysis();
        $('calibrationStart').disabled = false;
    }
    $('acceptPinch').addEventListener('click', () => {
        const e = session.next();
        if (!e) return;
        session.results.set(e.id, {
            kind: 'uncertain'
        });
        $('acceptPinch').hidden = true;
        if (loop.enabled) timeline.ensureThrough(cursor + timeline.length);
        const next = session.next();
        cursor = next ? next.tick : timeline.length;
        if (!next) complete();
        else {
            say('Kept unscored. Try the next note.');
            animate();
        }
    });
    $('loopButton').addEventListener('click', () => {
        pause('Paused while you choose a loop.');
        configureLoop();
        $('loopDialog').showModal();
    });
    $('loopClose').addEventListener('click', () => $('loopDialog').close());
    $('loopFirst').addEventListener('change', () => {
        if (Number($('loopLast').value) < Number($('loopFirst').value)) $('loopLast').value = $('loopFirst').value;
    });
    $('loopLast').addEventListener('change', () => {
        if (Number($('loopLast').value) < Number($('loopFirst').value)) $('loopFirst').value = $('loopLast').value;
    });
    $('loopApply').addEventListener('click', () => {
        setLoop($('loopFirst').value, $('loopLast').value);
        $('loopDialog').close();
    });
    $('loopClear').addEventListener('click', () => {
        setLoop(1, 1, false);
        $('loopDialog').close();
    });
    $('loopHelp').addEventListener('click', () => {
        $('loopDialog').close();
        window.GuitarApp?.showHelp('loop');
    });
    $('gameCounts').addEventListener('change', draw);
    $('gameStart').addEventListener('click', () => start(false));
    $('gameListen').addEventListener('click', () => {
        if (running && demo) pause('Listening stopped.');
        else {
            if (running) pause('');
            return start(true);
        }
    });
    $('gameRestart').addEventListener('click', () => {
        const resume = running,
            wasDemo = demo;
        reset();
        if (resume) return start(wasDemo);
    });
    $('repeatExercise').addEventListener('click', () => {
        reset();
        start();
    });
    $('nextExercise').addEventListener('click', () => choose(library[(library.indexOf(exercise) + 1) % library.length].id));
    $('chooseExercise').addEventListener('click', () => window.GuitarApp?.navigate('practice'));
    $('gameBpm').addEventListener('change', () => tempo($('gameBpm').value));
    $('tempoDown').addEventListener('click', () => tempo(values().bpm - 5));
    $('tempoUp').addEventListener('click', () => tempo(values().bpm + 5));
    ['gameMode', 'gameSwing', 'gameTolerance'].forEach(id => $(id).addEventListener('change', () => {
        updateSummary();
        reset();
    }));
    $('gameLatency').addEventListener('change', () => {
        $('gameLatency').value = Math.max(-300, Math.min(400, Math.round(Number($('gameLatency').value) || 0)));
    });
    $('gameFingers').addEventListener('change', draw);
    $('calibrateButton').addEventListener('click', () => {
        pause();
        $('calibrationProgress').value = 0;
        $('calibrationMessage').textContent = 'Stay quiet for two seconds, then pluck an open string with each click. Use headphones for a useful timing check.';
        $('calibrationDialog').showModal();
    });
    $('calibrationStart').addEventListener('click', startCalibration);
    $('calibrationClose').addEventListener('click', () => {
        $('calibrationDialog').close();
        endCalibration();
    });
    $('calibrationDialog').addEventListener('close', endCalibration);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            pause('Paused while the app was away.');
            endCalibration();
        }
    });
    window.addEventListener('pagehide', () => {
        pause('');
        endCalibration();
    });
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => {
        draw();
    }).observe(canvas);
    else window.addEventListener('resize', draw);
    window.GuitarGame = {
        choose,
        setLoop,
        get loop() {
            return {
                ...loop,
                exercise: exercise.id
            };
        },
        pause,
        reset,
        show(visible) {
            viewVisible = visible;
            if (!visible) {
                pause('');
                endCalibration();
            } else {
                draw();
                animate();
            }
        },
        get exercise() {
            return exercise;
        },
        get running() {
            return running;
        },
        get noiseFloor() {
            return noiseFloor;
        },
        set noiseFloor(n) {
            if (n >= .003 && n <= .05) noiseFloor = n;
        }
    };
    choose(exercise.id);
})();
