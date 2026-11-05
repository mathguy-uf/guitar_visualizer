const {
    test
} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const M = require('../js/music.js'),
    E = require('../js/exercises.js');

function fixture() {
    let time = 10,
        receive, acquired = 0,
        released = 0,
        interval;
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
            return {
                source: {
                    disconnect() {}
                }
            };
        },
        async listen(_handle, fn) {
            receive = fn;
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
        pluck() {},
        message: e => e.message
    };
    const brush = new Proxy({}, {
        get: (o, p) => o[p] || (() => {})
    });
    elements.tabCanvas.getContext = () => brush;
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
        addEventListener() {},
        dispatchEvent() {},
        devicePixelRatio: 1
    };
    const context = {
        GuitarMusic: M,
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
            addEventListener() {}
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
        advance(dt) {
            time += dt;
            interval?.();
        },
        click: async id => elements[id].listeners.click(),
        change: id => elements[id].listeners.change(),
        attack(pitches) {
            receive({
                type: 'analysis',
                version: 1,
                attack: {
                    pitches,
                    confidence: 1,
                    time
                }
            });
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
