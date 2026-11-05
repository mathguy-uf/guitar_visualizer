const {
    test
} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture() {
    const requests = [];
    const events = {};
    let contexts = 0;
    class AudioContext {
        constructor() {
            contexts++;
            this.state = 'running';
        }
        resume() {
            return Promise.resolve();
        }
        suspend() {
            return Promise.resolve();
        }
        createMediaStreamSource(stream) {
            return {
                stream,
                disconnect() {}
            };
        }
    }
    const window = {
        AudioContext,
        addEventListener(name, fn) {
            events[name] = fn;
        }
    };
    const context = {
        window,
        navigator: {
            mediaDevices: {
                getUserMedia() {
                    return new Promise((resolve, reject) => requests.push({
                        resolve,
                        reject
                    }));
                }
            }
        },
        document: {
            addEventListener() {}
        },
        DOMException,
        Worker: class {},
        console
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync('js/audio.js', 'utf8'), context);
    return {
        api: window.GuitarAudio,
        requests,
        events,
        contexts: () => contexts
    };
}

function stream() {
    const track = {
        stopped: false,
        stop() {
            this.stopped = true;
        },
        addEventListener() {}
    };
    return {
        track,
        getTracks: () => [track],
        getAudioTracks: () => [track]
    };
}
test('switching ownership cancels a pending microphone request and stops its late stream', async () => {
    const f = fixture();
    let lost = 0;
    const first = f.api.acquire('tuner', () => lost++);
    const failure = assert.rejects(first, {
        name: 'AbortError'
    });
    const second = f.api.acquire('game', () => {});
    assert.equal(lost, 1);
    const stale = stream();
    f.requests[0].resolve(stale);
    await failure;
    assert.equal(stale.track.stopped, true);
    const live = stream();
    f.requests[1].resolve(live);
    await second;
    assert.equal(f.api.owner, 'game');
    assert.equal(f.contexts(), 1);
    f.api.release('tuner');
    assert.equal(live.track.stopped, false);
    f.api.release('game');
    assert.equal(live.track.stopped, true);
    assert.equal(f.api.owner, null);
});
test('denied permissions release ownership and a later retry succeeds', async () => {
    const f = fixture();
    const pending = f.api.acquire('game', () => {});
    const rejected = assert.rejects(pending, {
        name: 'NotAllowedError'
    });
    f.requests[0].reject(new DOMException('Denied', 'NotAllowedError'));
    await rejected;
    assert.equal(f.api.owner, null);
    const next = f.api.acquire('tuner', () => {}),
        live = stream();
    f.requests[1].resolve(live);
    await next;
    assert.equal(f.api.owner, 'tuner');
    f.events.pagehide();
    assert.equal(live.track.stopped, true);
});
