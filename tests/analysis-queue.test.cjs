const {
    test
} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
async function fixture() {
    let worker, node, time = .1;
    const sent = [],
        received = [];
    class Worker {
        constructor() {
            worker = this;
        }
        postMessage(data) {
            sent.push(data);
        }
        terminate() {
            this.stopped = true;
        }
    }
    class Worklet {
        constructor() {
            node = this;
            this.port = {};
        }
        connect() {
            return {
                connect() {}
            };
        }
        disconnect() {}
    }
    const ctx = {
        get currentTime() {
            return time;
        },
        audioWorklet: {
            async addModule() {}
        },
        createGain() {
            return {
                gain: {},
                disconnect() {}
            };
        }
    };
    const context = {
        window: {
            addEventListener() {}
        },
        document: {
            addEventListener() {}
        },
        Worker,
        AudioWorkletNode: Worklet
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync('js/audio.js', 'utf8'), context);
    const listener = await context.window.GuitarAudio.listen({
        context: ctx,
        source: {
            connect() {},
            disconnect() {}
        }
    }, message => received.push(message), at => ({
        expected: [40],
        eventId: Math.round(at * 1000)
    }));
    return {
        sent,
        received,
        listener,
        frame(end) {
            time = end;
            node.port.onmessage?.({
                data: {
                    samples: new Float32Array(4096),
                    rate: 48000,
                    time: end
                }
            });
        },
        reply() {
            worker.onmessage?.({
                data: {
                    type: 'analysis'
                }
            });
        },
        get stopped() {
            return worker.stopped;
        }
    };
}
test('queued capture windows remain ordered and keep their captured-time target context', async () => {
    const f = await fixture();
    f.frame(.1);
    f.frame(.12);
    f.frame(.14);
    assert.equal(f.sent.length, 1);
    f.reply();
    f.reply();
    assert.deepEqual(f.sent.map(p => p.time), [.1, .12, .14]);
    assert.equal(f.sent[0].target.eventId, 57);
    assert.equal(f.sent[2].target.eventId, 97);
    f.listener.stop();
    f.reply();
    assert.equal(f.received.length, 2);
});
test('an overloaded queue reports a pause instead of silently dropping plucks', async () => {
    const f = await fixture();
    for (let i = 0; i < 27; i++) f.frame(.1 + i * .02);
    assert.equal(f.received.filter(m => m.type === 'error').length, 1);
    assert.match(f.received[0].message, /fell behind/);
    f.listener.stop();
    assert.ok(f.stopped);
});
