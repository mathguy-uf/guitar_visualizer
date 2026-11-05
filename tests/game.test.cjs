const {
    test
} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const R = require('../js/rhythm.js');
const M = require('../js/music.js'),
    E = require('../js/exercises.js');

function fixture() {
    let time = 10,
        receive, acquired = 0,
        released = 0,
        interval, targetForFrame = null,
        denyNext = false;
    const windowEvents = {},
        documentEvents = {};
    const plucks = [];
    let slowNextListen = false,
        resolveSlowListen = null,
        enteredSlowListen = null;
    class Element {
        constructor() {
            this.value = '';
            this.checked = false;
            this.listeners = {};
            this.hidden = false;
            this.style = {};
            this.dataset = {};
            this.classList = {
                toggle() {}
            };
            this.attributes = {};
            this.textContent = '';
        }
        addEventListener(n, fn) {
            this.listeners[n] = fn;
        }
        setAttribute(k, v) {
            this.attributes[k] = v;
        }
        getAttribute(k) {
            return this.attributes[k];
        }
        removeAttribute(k) {
            delete this.attributes[k];
        }
        replaceChildren() {}
        getBoundingClientRect() {
            return {
                width: 800,
                height: 200
            };
        }
        showModal() {
            this.open = true;
        }
        close() {
            this.open = false;
        }
    }
    const elements = new Proxy({}, {
        get: (all, id) => all[id] ||= (new Element())
    });
    const ctx = {
        get currentTime() {
            return time;
        },
        destination: {},
        resume() {
            return Promise.resolve();
        },
        createGain() {
            return {
                connect() {},
                disconnect() {}
            };
        }
    };
    const audio = {
        ensureContext: () => ctx,
        async acquire() {
            acquired++;
            if (denyNext) {
                denyNext = false;
                throw new DOMException('Permission denied', 'NotAllowedError');
            }
            return {
                source: {
                    disconnect() {}
                }
            };
        },
        async listen(_handle, fn, target) {
            if (slowNextListen) {
                slowNextListen = false;
                await new Promise(resolve => {
                    resolveSlowListen = resolve;
                    enteredSlowListen();
                });
            }
            receive = fn;
            targetForFrame = target;
            return {
                target() {
                    return 1;
                },
                floor() {},
                reset() {},
                stop() {}
            };
        },
        release() {
            released++;
        },
        click() {},
        pluck(_ctx, time, midi, duration, destination) {
            plucks.push({
                time,
                midi,
                duration,
                destination
            });
        },
        message: e => e.message
    };
    const brush = new Proxy({}, {
        get: (o, p) => o[p] || (() => {})
    });
    elements.tabCanvas.getContext = () => brush;
    elements.gameCounts.checked = true;
    const defaults = {
        gameMode: 'learn',
        gameBpm: '55',
        gameSwing: '0',
        gameLatency: '0',
        gameTolerance: '.22'
    };
    Object.entries(defaults).forEach(([id, v]) => elements[id].value = v);
    const window = {
        GuitarAudio: audio,
        addEventListener(name, callback) {
            windowEvents[name] = callback;
        },
        dispatchEvent() {},
        devicePixelRatio: 1
    };
    const context = {
        GuitarMusic: M,
        GuitarRhythm: R,
        GuitarExercises: E,
        GuitarAudio: audio,
        window,
        document: {
            getElementById: id => elements[id],
            body: {
                classList: {
                    toggle() {}
                }
            },
            createElement: () => new Element(),
            hidden: false,
            addEventListener(name, callback) {
                documentEvents[name] = callback;
            }
        },
        CustomEvent: class {},
        Event: class {},
        ResizeObserver: class {
            observe() {}
        },
        setInterval(fn) {
            interval = fn;
            return 1;
        },
        clearInterval() {
            interval = null;
        },
        setTimeout() {},
        clearTimeout() {},
        requestAnimationFrame() {
            return 1;
        },
        cancelAnimationFrame() {},
        stopMetronome() {},
        stopTuner() {}
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync('js/game.js', 'utf8'), context);
    return {
        game: window.GuitarGame,
        elements,
        advance(dt, {
            analysis = true
        } = {}) {
            // Model the real continuous stream, separately from detected attacks.
            const end = time + dt;
            while (time < end - 1e-8) {
                time = Math.min(end, time + .02);
                if (analysis && receive) receive({
                    type: 'analysis',
                    rms: .001,
                    time: time - .045,
                    settledThrough: time - .045
                });
                interval?.();
            }
        },
        frame(data) {
            receive(data);
        },
        receiver() {
            return receive;
        },
        delayListen() {
            slowNextListen = true;
            return new Promise(resolve => {
                enteredSlowListen = resolve;
            });
        },
        finishDelayedListen() {
            resolveSlowListen();
        },
        denyNext() {
            denyNext = true;
        },
        background() {
            context.document.hidden = true;
            documentEvents.visibilitychange();
        },
        foreground() {
            context.document.hidden = false;
            documentEvents.visibilitychange();
        },
        targetAt(time) {
            return targetForFrame?.(time);
        },
        click: async id => elements[id].listeners.click(),
        change: id => elements[id].listeners.change(),
        attack(pitches, options = {}) {
            receive({
                type: 'analysis',
                version: options.version ?? 1,
                time: options.time ?? time,
                settledThrough: options.settledThrough ?? options.time ?? time,
                attack: {
                    pitches,
                    confidence: options.confidence ?? 1,
                    time: options.time ?? time
                }
            });
        },
        get plucks() {
            return plucks;
        },
        get acquired() {
            return acquired;
        },
        get released() {
            return released;
        }
    };
}
test('Learn waits for correct fresh attacks, advances, completes, and releases listening', async () => {
    const f = fixture();
    await f.click('gameStart');
    assert.ok(f.game.running);
    f.advance(100);
    f.attack([45]);
    assert.match(f.elements.gameFeedback.textContent, /highlighted pitch/);
    for (let i = 0; i < 8; i++) f.attack([40]);
    assert.equal(f.game.running, false);
    assert.equal(f.elements.gameResults.hidden, false);
    assert.match(f.elements.resultText.textContent, /8 of 8/);
    assert.ok(f.released > 0);
});
test('Rhythm count-in, mid-exercise tempo changes, pause, and resume use one musical clock', async () => {
    const f = fixture();
    f.elements.gameMode.value = 'rhythm';
    f.elements.gameBpm.value = '60';
    f.change('gameMode');
    await f.click('gameStart');
    f.advance(4);
    f.attack([40]);
    f.elements.gameBpm.value = '120';
    f.change('gameBpm');
    f.advance(.5);
    f.attack([40]);
    await f.click('gameStart');
    assert.equal(f.game.running, false);
    f.advance(100);
    await f.click('gameStart');
    assert.equal(f.game.running, true);
    f.advance(.5);
    f.attack([40]);
    f.game.pause();
    // Missed count stays zero if resumption keeps the musical position.
    assert.doesNotMatch(f.elements.gameFeedback.textContent, /passed/);
    assert.equal(f.acquired, 2);
});
test('Listen plays without a microphone and hiding the screen stops it', async () => {
    const f = fixture();
    await f.click('gameListen');
    assert.equal(f.acquired, 0);
    assert.ok(f.game.running);
    f.game.show(false);
    assert.equal(f.game.running, false);
});
test('uncertain Learn pinches offer an explicit unscored continuation', async () => {
    const f = fixture();
    f.game.choose('three-pinch');
    await f.click('gameStart');
    f.attack([40]);
    assert.equal(f.elements.acceptPinch.hidden, false);
    await f.click('acceptPinch');
    assert.equal(f.elements.acceptPinch.hidden, true);
    assert.match(f.elements.gameFeedback.textContent, /unscored/);
});

test('Listen completion restores the Start label and switching from playing starts the demo directly', async () => {
    const f = fixture();
    await f.click('gameStart');
    await f.click('gameListen');
    assert.ok(f.game.running);
    assert.equal(f.acquired, 1);
    assert.match(f.elements.gameListen.textContent, /Stop listening/);
    f.advance(20);
    assert.equal(f.game.running, false);
    assert.equal(f.elements.gameStart.textContent, '▶ Start');
});


test('a slightly early first note inside the timing window is accepted', async () => {
    const f = fixture();
    f.elements.gameMode.value = 'rhythm';
    f.elements.gameBpm.value = '60';
    f.change('gameMode');
    await f.click('gameStart');
    f.advance(3.9);
    f.attack([40]);
    assert.match(f.elements.gameFeedback.textContent, /Right note.*early/);
});

test('analysis delivery delay cannot turn an in-window attack into a miss', async () => {
    const f = fixture();
    f.elements.gameMode.value = 'rhythm';
    f.elements.gameBpm.value = '60';
    f.change('gameMode');
    await f.click('gameStart');
    f.advance(3.9);
    f.advance(.4, {
        analysis: false
    });
    f.attack([40], {
        time: 14.1
    });
    assert.match(f.elements.gameFeedback.textContent, /Right note.*late/);
});

test('an attack from the preceding analysis target is not discarded at a target change', async () => {
    const f = fixture();
    f.elements.gameMode.value = 'rhythm';
    f.elements.gameBpm.value = '60';
    f.change('gameMode');
    await f.click('gameStart');
    f.advance(4);
    f.attack([40], {
        version: 0
    });
    assert.match(f.elements.gameFeedback.textContent, /Right there/);
});

test('late worker delivery at the end of an exercise is scored before results close', async () => {
    const f = fixture();
    f.game.choose('sixteenths');
    f.elements.gameMode.value = 'rhythm';
    f.elements.gameBpm.value = '60';
    f.change('gameMode');
    await f.click('gameStart');
    f.advance(11.7);
    f.advance(.6, {
        analysis: false
    });
    assert.ok(f.game.running);
    f.attack([64], {
        time: 21.94
    });
    f.frame({
        type: 'analysis',
        time: 22.31,
        settledThrough: 22.31
    });
    f.advance(.02);
    assert.equal(f.game.running, false);
    assert.match(f.elements.resultText.textContent, /1 of 32/);
});

test('pausing during pending audio rewinds the unanalysed gap for a fair retry', async () => {
    const f = fixture();
    f.elements.gameMode.value = 'rhythm';
    f.elements.gameBpm.value = '60';
    f.change('gameMode');
    await f.click('gameStart');
    f.advance(3.9);
    f.advance(.3, {
        analysis: false
    });
    await f.click('gameStart');
    f.advance(5);
    await f.click('gameStart');
    f.advance(.2);
    f.attack([40]);
    assert.match(f.elements.gameFeedback.textContent, /Right/);
});

test('a prolonged analysis stall pauses without recording a new miss', async () => {
    const f = fixture();
    f.elements.gameMode.value = 'rhythm';
    f.elements.gameBpm.value = '60';
    f.change('gameMode');
    await f.click('gameStart');
    f.advance(3.9);
    f.advance(1.2, {
        analysis: false
    });
    assert.equal(f.game.running, false);
    assert.match(f.elements.gameFeedback.textContent, /fell behind/);
});

test('analysis targets follow captured time rather than worker delivery time', async () => {
    const f = fixture();
    f.game.choose('forward');
    f.elements.gameMode.value = 'rhythm';
    f.elements.gameBpm.value = '60';
    f.change('gameMode');
    await f.click('gameStart');
    f.advance(4.7);
    assert.deepEqual(Array.from(f.targetAt(14).expected), [40]);
    assert.deepEqual(Array.from(f.targetAt(14.5).expected), [55]);
});


test('calibration stays independent of pinch targets and preserves its room/timing workflow', async () => {
    const f = fixture();
    f.game.choose('three-pinch');
    await f.click('calibrateButton');
    await f.click('calibrationStart');
    assert.equal(f.targetAt(10), undefined);
    f.advance(2.52);
    for (let i = 0; i < 8; i++) {
        if (i) f.advance(1);
        f.attack([40]);
    }
    f.advance(1.1);
    assert.match(f.elements.calibrationMessage.textContent, /Room check saved/);
    assert.match(f.elements.calibrationMessage.textContent, /Timing offset/);
    assert.ok(Math.abs(Number(f.elements.gameLatency.value)) <= 10);
});


test('restart discards the previous worker session without counting its late attack', async () => {
    const f = fixture();
    f.elements.gameMode.value = 'rhythm';
    f.elements.gameBpm.value = '60';
    f.change('gameMode');
    await f.click('gameStart');
    f.advance(3.9);
    const oldWorker = f.receiver();
    await f.click('gameRestart');
    oldWorker({
        type: 'analysis',
        time: 14,
        settledThrough: 14,
        attack: {
            time: 14,
            pitches: [40],
            confidence: 1
        }
    });
    assert.match(f.elements.gameFeedback.textContent, /Count in/);
    f.advance(4);
    f.attack([40]);
    assert.match(f.elements.gameFeedback.textContent, /Right there/);
});

test('backgrounding stops listening and foregrounding does not resume automatically', async () => {
    const f = fixture();
    await f.click('gameStart');
    f.background();
    assert.equal(f.game.running, false);
    f.advance(3);
    f.foreground();
    assert.equal(f.game.running, false);
    await f.click('gameStart');
    assert.equal(f.game.running, true);
    assert.equal(f.acquired, 2);
});

test('a denied microphone request leaves the exercise retryable', async () => {
    const f = fixture();
    f.denyNext();
    await f.click('gameStart');
    assert.equal(f.game.running, false);
    assert.match(f.elements.gameFeedback.textContent, /Permission denied/);
    await f.click('gameStart');
    assert.equal(f.game.running, true);
});


test('a cancelled slow microphone startup cannot release the newer game session', async () => {
    const f = fixture();
    const waiting = f.delayListen();
    const cancelled = f.click('gameStart');
    await waiting;
    await f.click('gameRestart');
    await f.click('gameStart');
    assert.ok(f.game.running);
    const releases = f.released;
    f.finishDelayedListen();
    await cancelled;
    assert.equal(f.released, releases);
    assert.ok(f.game.running);
});


test('measure looping keeps one microphone session across passes and preserves delayed boundary notes', async () => {
    const f = fixture();
    f.elements.gameMode.value = 'rhythm';
    f.elements.gameBpm.value = '60';
    f.change('gameMode');
    f.game.setLoop(1, 1);
    await f.click('gameStart');
    f.advance(3.9);
    f.attack([40]);
    for (let i = 0; i < 12; i++) {
        f.advance(1);
        f.attack([40]);
    }
    assert.ok(f.game.running);
    assert.equal(f.acquired, 1);
    assert.equal(f.elements.gameResults.hidden, true);
    f.game.show(true);
    assert.match(f.elements.gameStats.textContent, /13 verified/);
    assert.equal(f.game.loop.first, 1);
    assert.equal(f.game.loop.last, 1);
});

test('Listen repeats selected measures with one audible onset at each boundary and no microphone', async () => {
    const f = fixture();
    f.elements.gameBpm.value = '60';
    f.change('gameBpm');
    f.game.setLoop(1, 1);
    await f.click('gameListen');
    f.advance(12.2);
    assert.equal(f.acquired, 0);
    assert.ok(f.game.running);
    const times = f.plucks.map(p => Number(p.time.toFixed(7)));
    assert.equal(new Set(times).size, times.length);
    assert.deepEqual(times.slice(0, 9), [14, 15, 16, 17, 18, 19, 20, 21, 22]);
});

test('Learn loops wait on each note and continue directly into the selected measure', async () => {
    const f = fixture();
    f.game.setLoop(2, 2);
    await f.click('gameStart');
    for (let i = 0; i < 12; i++) f.attack([40]);
    assert.ok(f.game.running);
    assert.equal(f.elements.gameResults.hidden, true);
    assert.equal(f.acquired, 1);
    f.game.show(true);
    assert.match(f.elements.gameStats.textContent, /Pass 4/);
});

test('delayed worker attacks on both sides of a loop boundary match captured musical time', async () => {
    const f = fixture();
    f.elements.gameMode.value = 'rhythm';
    f.elements.gameBpm.value = '60';
    f.change('gameMode');
    f.game.setLoop(1, 1);
    await f.click('gameStart');
    f.advance(7.05); // Last previous-pass note is due at audio time 17.
    f.advance(.95, {
        analysis: false
    });
    f.frame({
        type: 'analysis',
        time: 18,
        settledThrough: 17.02
    });
    f.advance(.12, {
        analysis: false
    });
    f.attack([40], {
        time: 17.1,
        settledThrough: 17.1
    });
    assert.match(f.elements.gameFeedback.textContent, /late/i);
    f.attack([40], {
        time: 18,
        settledThrough: 18
    });
    assert.match(f.elements.gameFeedback.textContent, /Right there/);
    f.game.show(true);
    assert.match(f.elements.gameStats.textContent, /2 verified/);
    assert.equal(f.acquired, 1);
});

test('looped Listen keeps unique onsets after archival, live tempo changes, and pause/resume', async () => {
    const f = fixture();
    f.elements.gameBpm.value = '60';
    f.change('gameBpm');
    f.game.setLoop(1, 1);
    await f.click('gameListen');
    f.advance(20.15); // Several passes have been archived; current time is 30.15.
    f.elements.gameBpm.value = '120';
    f.change('gameBpm');
    f.advance(1.6);
    const changed = f.plucks.filter(p => p.time > 30.15).map(p => Number(p.time.toFixed(6)));
    assert.deepEqual(changed, [30.575, 31.075, 31.575]);
    await f.click('gameStart');
    const stopped = f.plucks.length;
    f.advance(10);
    assert.equal(f.plucks.length, stopped);
    await f.click('gameListen'); // Listen resumes the demonstration; Start switches to microphone play.
    f.advance(.5);
    assert.ok(Math.abs(f.plucks.at(-1).time - 42.075) < 1e-6);
    const times = f.plucks.map(p => Number(p.time.toFixed(7)));
    assert.equal(new Set(times).size, times.length);
    assert.equal(f.acquired, 0);
    assert.ok(f.game.running);
});
