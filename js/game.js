(function() {
    'use strict';
    const M = GuitarMusic,
        library = GuitarExercises.data,
        $ = id => document.getElementById(id);
    const canvas = $('tabCanvas'),
        paint = canvas.getContext('2d');
    let exercise = library[0],
        events = [],
        session, clock, ctx, listener = null,
        source = null,
        gate = null;
    let running = false,
        demo = false,
        busy = false,
        token = 0,
        frame = null,
        timer = null,
        scheduled = new Set(),
        targetId = null,
        targetVersion = 0;
    let cursor = 0,
        displayCursor = 0,
        feedback = '',
        noiseFloor = .004,
        finished = false,
        calibration = null,
        repeatTimer = null;
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
        events = M.compile(exercise, values().swing);
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
        targetId = null;
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
        if (clock?.running) clock.pause();
        if ((running && values().mode === 'rhythm') || demo) cursor = clock?.position() || cursor;
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
        textScore();
        $('gameResults').hidden = true;
        setRunning(false);
        say(values().mode === 'learn' ? 'Pluck the highlighted note. The game will wait.' : 'One bar to settle in, then follow the playhead.');
        draw();
    }

    function textScore() {
        $('textScore').replaceChildren(...events.map(e => {
            const li = document.createElement('li');
            li.textContent = `Beat ${(e.tick/M.PPQ+1).toFixed(2).replace(/\.00$/,'')}: ${e.notes.length?e.notes.map(n=>`${n.tie?'hold':'play'} string ${n.string}, fret ${n.fret}${n.finger?' ('+n.finger+')':''}`).join(' + '):'rest'}; duration ${e.duration/M.PPQ} quarter beats.`;
            return li;
        }));
    }

    function choose(id) {
        const next = library.find(e => e.id === id);
        if (!next) return;
        exercise = next;
        pause('');
        $('gameTitle').textContent = exercise.title;
        $('gameLevel').textContent = `Level ${exercise.level} · ${GuitarExercises.levels[exercise.level-1].title}`;
        $('gameTip').textContent = exercise.tip;
        $('gameBpm').value = exercise.bpm;
        $('gameSwing').value = exercise.swing || 0;
        updateSummary();
        reset();
        window.dispatchEvent(new CustomEvent('guitar:exercise', {
            detail: {
                id: exercise.id
            }
        }));
    }

    function currentTick() {
        return running && (demo || values().mode === 'rhythm') ? clock.position() : cursor;
    }

    function expectedAt(tick) {
        const pending = events.filter(e => e.targets.length && !session.results.has(e.id));
        if (values().mode === 'learn') return pending[0];
        return pending.reduce((best, e) => !best || Math.abs(e.tick - tick) < Math.abs(best.tick - tick) ? e : best, null);
    }

    function target(tick) {
        const e = expectedAt(tick);
        if (e?.id !== targetId && listener) {
            targetId = e?.id;
            targetVersion = listener.target(e?.targets || []);
        }
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
        if (data.attack && data.version === targetVersion) {
            const v = values();
            const tick = v.mode === 'learn' ? (session.next()?.tick || 0) : clock.position(data.attack.time - v.latency / 1000);
            if (tick < 0) return;
            const result = session.input({
                tick,
                pitches: data.attack.pitches,
                confidence: data.attack.confidence
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
                const next = session.next();
                cursor = next ? next.tick : exercise.length;
                if (!next) {
                    complete();
                    return;
                }
            }
            target(currentTick());
            animate();
        }
    }

    function schedule() {
        if (!running) return;
        const tick = currentTick(),
            v = values(),
            now = ctx.currentTime;
        if (!demo && v.mode === 'rhythm') {
            const before = session.summary().missed;
            session.expire(tick, v.bpm);
            if (session.summary().missed > before) say('That note passed. Find the next one.');
        }
        target(tick);
        if (clock.running) {
            const ahead = clock.position(now + .11);
            const pulse = M.PPQ * 4 / exercise.meter[1];
            const first = Math.max(-exercise.meter[0], Math.floor(tick / pulse) - 1),
                last = Math.ceil(ahead / pulse);
            for (let beat = first; beat <= last; beat++) {
                const bt = beat * pulse,
                    key = 'beat' + beat,
                    time = clock.timeAt(bt);
                if (scheduled.has(key) || time < now - .015 || time > now + .11 || bt >= exercise.length) continue;
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
                        let end = e.tick + n.duration;
                        for (const later of events)
                            if (later.tick === end && later.notes.some(t => t.tie && t.midi === n.midi)) end = later.tick + later.notes.find(t => t.tie && t.midi === n.midi).duration;
                        GuitarAudio.pluck(ctx, Math.max(time, now), n.midi, (end - e.tick) / M.PPQ * 60 / v.bpm, gate);
                    }
                    scheduled.add(key);
                }
        }
        if (tick >= exercise.length + (demo ? 0 : v.tolerance * v.bpm / 60 * M.PPQ)) complete();
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
                listener = await GuitarAudio.listen(handle, receive);
                if (generation !== token) {
                    stopAnalysis();
                    return;
                }
                listener.floor(noiseFloor);
            } else await resumed;
            if (generation !== token) return;
            clock = new M.Transport(() => ctx.currentTime, values().bpm);
            gate = ctx.createGain();
            gate.connect(ctx.destination);
            targetId = null;
            scheduled.clear();
            if (demo || values().mode === 'rhythm') clock.start(cursor === 0 ? -M.barTicks(exercise.meter) : cursor);
            else clock.seek(cursor);
            setRunning(true);
            $('gameSettings').open = false;
            busy = false;
            say(demo ? 'Listen to the pattern. Join in when you feel ready.' : values().mode === 'learn' ? 'Play the note at the line. There’s no rush.' : `Count in: ${Array.from({length:exercise.meter[0]},(_,i)=>i+1).join(' · ')}`);
            target(currentTick());
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
        cursor = exercise.length;
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
        $('resultText').textContent = values().mode === 'learn' ? `${summary.hits} of ${summary.total} note groups played. Your best run was ${summary.best} in a row. ${summary.wrong?'You worked through '+summary.wrong+' pitch retries. ':''}${summary.uncertain?summary.uncertain+' pinches continued unscored. ':''}Ready for another pass?` : `${summary.hits} of ${summary.total} note groups played · ${summary.onTime} on time · ${summary.missed} missed. ${summary.wrong} wrong-pitch attempts; ${summary.extras} extra pitches. ${summary.uncertain?summary.uncertain+' pinch readings were uncertain and excluded from accuracy. ':''}${summary.accuracy===null?'':summary.accuracy+'% pitch coverage among judged groups. '}${summary.meanMs===null?'':'Average timing distance: '+summary.meanMs+' ms.'}`;
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
            const past = new Set([...scheduled].filter(key => key.startsWith('beat') ? Number(key.slice(4)) * M.PPQ * 4 / exercise.meter[1] <= position : events[Number(key.slice(4))]?.tick <= position));
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
        const x0 = Math.max(90, Math.min(180, w * .24)),
            spacing = Math.max(75, Math.min(125, (w - x0 - 28) / 4)),
            top = h < 200 ? 25 : 36,
            bottom = h - (h < 200 ? 16 : 24),
            dy = (bottom - top) / 5;
        const x = t => x0 + (t - displayCursor) / M.PPQ * spacing;
        paint.font = '12px system-ui';
        paint.textAlign = 'center';
        paint.textBaseline = 'middle';
        const pulse = M.PPQ * 4 / exercise.meter[1];
        const start = Math.max(0, Math.floor((displayCursor - x0 / spacing * M.PPQ) / pulse) - 1),
            end = Math.min(Math.ceil(exercise.length / pulse), Math.ceil((displayCursor + (w - x0) / spacing * M.PPQ) / pulse) + 1);
        const bar = M.barTicks(exercise.meter);
        for (let beat = start; beat <= end; beat++) {
            const bx = x(beat * pulse),
                isBar = (beat * pulse) % bar === 0;
            paint.strokeStyle = isBar ? '#51624f' : '#28382d';
            paint.lineWidth = isBar ? 1.5 : 1;
            paint.beginPath();
            paint.moveTo(bx, 25);
            paint.lineTo(bx, h - 10);
            paint.stroke();
            paint.fillStyle = '#b4c2b0';
            const label = beat % exercise.meter[0] + 1;
            paint.fillText(String(label), bx, 13);
            // Half-beat dots help distinguish the offbeat from a numbered beat.
            if (spacing >= 75 && exercise.meter[1] === 4) {
                paint.fillStyle = '#7d8d79';
                paint.fillText('·', bx + spacing / 2, 13);
            }
        }
        for (let s = 0; s < 6; s++) {
            const y = top + dy * s;
            paint.strokeStyle = '#6e7f6b';
            paint.lineWidth = 1 + s * .16;
            paint.beginPath();
            paint.moveTo(38, y);
            paint.lineTo(w, y);
            paint.stroke();
        }
        paint.fillStyle = '#e3ecd3';
        paint.fillRect(x0 - 1.5, 24, 3, h - 34);
        paint.beginPath();
        paint.moveTo(x0 - 6, 22);
        paint.lineTo(x0 + 6, 22);
        paint.lineTo(x0, 28);
        paint.fill();
        // Clip moving TAB so the fixed string labels always remain readable.
        paint.save();
        paint.beginPath();
        paint.rect(42, 22, w - 42, h - 22);
        paint.clip();
        const next = session.next();
        for (const e of events) {
            const nx = x(e.tick);
            if (nx < 28 || nx > w + 40) continue;
            const result = session.results.get(e.id),
                active = !demo && e.id === next?.id;
            if (!e.notes.length) {
                paint.fillStyle = '#abb8a7';
                paint.font = '14px system-ui';
                paint.fillText('rest', nx, top + dy * 2.5);
                continue;
            }
            for (const n of e.notes) {
                const y = top + dy * (n.string - 1);
                let fill = result ? result.kind === 'missed' ? '#6d7469' : result.kind === 'uncertain' ? '#9c957b' : '#c7dbb5' : active ? '#e3ecd3' : '#25382a';
                if (n.tie) fill = '#25382a';
                const noteHeight = Math.max(20, Math.min(29, dy * .86));
                const boxWidth = n.fret >= 10 ? 32 : 26;
                paint.fillStyle = '#101713';
                paint.fillRect(nx - boxWidth / 2 - 3, y - noteHeight / 2 - 2, boxWidth + 6, noteHeight + 4);
                paint.fillStyle = fill;
                paint.beginPath();
                paint.roundRect(nx - boxWidth / 2, y - noteHeight / 2, boxWidth, noteHeight, 5);
                paint.fill();
                paint.strokeStyle = result?.kind === 'missed' ? '#a1a594' : active ? '#eaf2dc' : '#7a9075';
                paint.lineWidth = active ? 2 : 1;
                paint.stroke();
                paint.fillStyle = result || active ? '#17231b' : '#f2f2e9';
                paint.font = `600 ${Math.max(14,Math.min(18,dy*.55))}px system-ui`;
                paint.fillText(String(n.fret), nx, y + .5);
                if (n.tie) {
                    paint.strokeStyle = '#d3dec4';
                    paint.beginPath();
                    paint.arc(nx - 20, y + 7, 20, 0, Math.PI);
                    paint.stroke();
                } else if (e.duration < M.PPQ && spacing * e.duration / M.PPQ < 48) {
                    paint.strokeStyle = '#7e9277';
                    paint.beginPath();
                    paint.moveTo(nx, y + noteHeight / 2);
                    paint.lineTo(nx, y + noteHeight / 2 + 5);
                    paint.stroke();
                }
                if ($('gameFingers').checked && dy >= 25) {
                    paint.fillStyle = '#abbda4';
                    paint.font = '9px system-ui';
                    paint.fillText(n.finger || '', nx, y - noteHeight / 2 - 7);
                } else if ($('gameFingers').checked && dy >= 18) {
                    paint.fillStyle = '#a8bca1';
                    paint.font = '8px system-ui';
                    paint.fillText(n.finger || '', nx + 20, y - 6);
                }
                if (e.accent) {
                    paint.fillStyle = '#f4c767';
                    paint.font = '11px system-ui';
                    paint.fillText('›', nx + boxWidth / 2 + 7, y);
                }
                if (result) {
                    paint.fillStyle = '#c7dbb5';
                    paint.font = '9px system-ui';
                    paint.fillText(result.kind === 'missed' ? '×' : result.kind === 'uncertain' ? '?' : '✓', nx, y + noteHeight / 2 + 7);
                }
                if (n.duration > M.PPQ && !n.tie) {
                    paint.strokeStyle = '#a1b494';
                    paint.lineWidth = 2;
                    paint.beginPath();
                    paint.moveTo(nx + boxWidth / 2 + 3, y);
                    paint.lineTo(Math.min(w, x(e.tick + n.duration) - 12), y);
                    paint.stroke();
                }
            }
        }
        paint.restore();
        paint.fillStyle = '#101713';
        paint.fillRect(0, 0, 38, h);
        paint.textAlign = 'left';
        ['e', 'B', 'G', 'D', 'A', 'E'].forEach((label, i) => {
            paint.fillStyle = '#d0dcca';
            paint.font = '600 13px system-ui';
            paint.fillText(label, 9, top + dy * i);
            paint.fillStyle = '#82957b';
            paint.font = '9px system-ui';
            paint.fillText(String(i + 1), 24, top + dy * i);
        });

        const count = Math.floor(Math.max(0, tick) / pulse),
            beatLabel = tick < 0 ? `Get ready · ${Math.max(1,Math.ceil(-tick/pulse))}` : values().mode === 'learn' && !demo ? 'Learn · at your pace' : `${exercise.meter.join('/')} · Beat ${count%exercise.meter[0]+1}`;
        if (beatLabel !== lastBeat) {
            $('gameBeat').textContent = lastBeat = beatLabel;
        }
        const stats = demo ? 'Listen · no scoring' : `${session.summary().hits} played · streak ${session.streak}`;
        if (stats !== lastStats) {
            $('gameStats').textContent = lastStats = stats;
        }
        const activeChord = exercise.chords.filter(c => c.tick <= Math.max(0, tick)).at(-1),
            upcoming = exercise.chords.find(c => c.tick > tick);
        const chord = activeChord ? `${activeChord.chord}${upcoming?' · next '+upcoming.chord:''}` : 'Open strings';
        if (chord !== lastChord) {
            $('gameChord').textContent = lastChord = chord;
        }
        const target = expectedAt(tick);
        const description = target ? target.notes.filter(n => !n.tie).map(n => `${M.noteName(n.midi)}, string ${n.string}, fret ${n.fret}`).join(' and ') : 'Exercise complete';
        if (canvas.getAttribute('data-target') !== description) {
            canvas.setAttribute('data-target', description);
            canvas.setAttribute('aria-label', `Guitar tablature. Current target: ${description}. High e at top, low E at bottom.`);
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
            listener = await GuitarAudio.listen(handle, receive);
            if (generation !== token) {
                stopAnalysis();
                return;
            }
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
        const next = session.next();
        cursor = next ? next.tick : exercise.length;
        if (!next) complete();
        else {
            say('Kept unscored. Try the next note.');
            target(cursor);
            animate();
        }
    });
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
        if (resume) start(wasDemo);
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
