const {
    test
} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Run the production metronome and inspect its actual oscillator-to-output graph.
function fixture({
    shared = true,
    pending = false
} = {}) {
    class Element {
        constructor() {
            this.value = '';
            this.checked = false;
            this.children = [];
            this.listeners = {};
            this.attributes = {};
            this.classList = {
                toggle() {},
                remove() {}
            };
        }
        set innerHTML(v) {
            this.children = [];
        }
        appendChild(c) {
            this.children.push(c);
        }
        setAttribute(k, v) {
            this.attributes[k] = v;
        }
        addEventListener(k, f) {
            this.listeners[k] = f;
        }
        querySelectorAll() {
            return this.children.flatMap(c => c.children);
        }
    }
    const elements = new Proxy({}, {
        get: (o, k) => o[k] ??= (new Element())
    });
    Object.assign(elements.metronomeMeter, {
        value: '4/4'
    });
    elements.metronomeSubdivision.value = '2';
    elements.metronomeBpm.value = '100';
    const nodes = [],
        oscillators = [];
    let interval = null,
        finishResume, contexts = 0,
        settings = 0;
    class Audio {
        constructor() {
            contexts++;
            this.state = 'suspended';
            this.currentTime = 0;
            this.destination = {
                output: true
            };
        }
        resume() {
            if (pending) return new Promise(resolve => {
                finishResume = () => {
                    this.state = 'running';
                    resolve();
                };
            });
            this.state = 'running';
            return Promise.resolve();
        }
        createGain() {
            const g = {
                gain: {
                    setValueAtTime() {},
                    exponentialRampToValueAtTime() {}
                },
                connect(to) {
                    this.to = to;
                    return to;
                },
                disconnect() {
                    this.disconnected = true;
                }
            };
            nodes.push(g);
            return g;
        }
        createOscillator() {
            const o = {
                frequency: {},
                connect(to) {
                    this.to = to;
                    return to;
                },
                start(time) {
                    this.time = time;
                },
                stop() {},
                disconnect() {}
            };
            oscillators.push(o);
            return o;
        }
    }
    const audio = new Audio();
    const GuitarAudio = {
        ensureContext() {
            if (audio.state === 'closed') audio.state = 'suspended';
            return audio;
        }
    };
    const window = {
        AudioContext: Audio,
        GuitarAudio: shared ? GuitarAudio : null,
        dispatchEvent() {
            settings++;
        }
    };
    const scope = {
        window,
        GuitarAudio,
        document: {
            getElementById: id => elements[id],
            createElement: () => new Element()
        },
        setTimeout: () => 1,
        clearTimeout() {},
        setInterval: f => {
            interval = f;
            return 1;
        },
        clearInterval() {
            interval = null;
        },
        stopTuner() {},
        Event: class {}
    };
    vm.createContext(scope);
    const source = fs.readFileSync('script.js', 'utf8');
    vm.runInContext('let audioContext;' + source.slice(source.indexOf('const metronomeMeter'), source.indexOf('function playNotes')), scope);
    return {
        scope,
        elements,
        audio,
        nodes,
        oscillators,
        click: id => elements[id].listeners.click(),
        advance(dt) {
            audio.currentTime += dt;
            interval?.();
        },
        finish: () => finishResume(),
        contexts: () => contexts,
        settings: () => settings
    };
}

test('Start resumes the shared context and connects audible clicks to its destination', async () => {
    const f = fixture();
    await f.click('metronomeStart');
    assert.equal(f.contexts(), 1);
    assert.equal(f.audio.state, 'running');
    assert.equal(f.oscillators.length, 1);
    assert.equal(f.oscillators[0].to.to.to, f.audio.destination);
    assert.match(f.elements.metronomeStatus.textContent, /Playing/);
    assert.equal(f.elements.metronomeRestore.hidden, true);
});
test('saved all-muted patterns are explicit and restore numbered beats without changing subdivisions', async () => {
    const f = fixture();
    vm.runInContext('metronomePattern.fill(false);syncMetronomeSelection();', f.scope);
    await f.click('metronomeStart');
    assert.equal(f.oscillators.length, 0);
    assert.match(f.elements.metronomeStatus.textContent, /All counts are muted/);
    assert.equal(f.elements.metronomeRestore.hidden, false);
    f.click('metronomeRestore');
    f.advance(.3);
    f.advance(.3);
    assert.equal(f.oscillators.length, 1);
    assert.equal(f.settings(), 1);
    assert.deepEqual(Array.from(vm.runInContext('metronomePattern', f.scope)), [true, false, true, false, true, false, true, false]);
    assert.match(f.elements.metronomeStatus.textContent, /Playing/);
});
test('an interrupted context stops the silent running indicator and can restart on the next touch', async () => {
    const f = fixture();
    await f.click('metronomeStart');
    f.audio.state = 'interrupted';
    f.advance(.4);
    assert.equal(f.elements.metronomeStart.attributes['aria-pressed'], 'false');
    assert.match(f.elements.metronomeStatus.textContent, /interrupted/);
    await f.click('metronomeStart');
    assert.equal(f.audio.state, 'running');
    assert.equal(f.oscillators.length, 2);
});
test('closed fallback audio contexts are replaced before restarting', async () => {
    const f = fixture({
        shared: false
    });
    await f.click('metronomeStart');
    vm.runInContext('audioContext.state="closed";stopMetronome();', f.scope);
    await f.click('metronomeStart');
    assert.equal(f.contexts(), 3);
    assert.equal(f.oscillators.length, 2);
});
test('Stop while resume is pending cannot start a late oscillator or reconnect output', async () => {
    const f = fixture({
        pending: true
    });
    const starting = f.click('metronomeStart');
    f.click('metronomeStart');
    f.finish();
    await starting;
    assert.equal(f.oscillators.length, 0);
    assert.equal(f.nodes.length, 0);
});
test('triplet subdivision and individual count muting preserve scheduled audio spacing', async () => {
    const f = fixture();
    f.elements.metronomeSubdivision.value = '3';
    f.elements.metronomeSubdivision.listeners.change();
    // Disable only the first triplet subdivision.
    f.elements.metronomeCount.querySelectorAll()[1].listeners.click();
    await f.click('metronomeStart');
    f.advance(.2);
    f.advance(.2);
    f.advance(.2);
    assert.deepEqual(f.oscillators.map(o => Number(o.time.toFixed(3))), [.04, .44, .64]);
});
test('a failed resume does not show Playing and a later retry succeeds', async () => {
    const f = fixture();
    const resume = f.audio.resume;
    f.audio.resume = async () => {
        throw Error('blocked');
    };
    await f.click('metronomeStart');
    assert.match(f.elements.metronomeStatus.textContent, /Could not start audio/);
    f.audio.resume = resume;
    await f.click('metronomeStart');
    assert.equal(f.oscillators.length, 1);
});
