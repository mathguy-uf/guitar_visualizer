const {
    test
} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

test('a settling attack keeps its captured target, event identity, and original time', () => {
    const analysed = [],
        posted = [];
    let calls = 0;
    class Gate {
        reset() {
            this.pending = null;
        }
        process(result, time) {
            calls++;
            if (calls === 1) {
                this.pending = {
                    time
                };
                return null;
            }
            const attack = {
                ...result,
                time: this.pending?.time ?? time
            };
            this.pending = null;
            return attack;
        }
    }
    const context = {
        importScripts() {},
        GuitarDSP: {
            AttackGate: Gate,
            analyse(_samples, _rate, expected) {
                analysed.push([...expected]);
                return {
                    rms: .02,
                    pitches: [...expected],
                    confidence: .8
                };
            }
        },
        self: {
            postMessage(data) {
                posted.push(data);
            }
        }
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync('js/analysis-worker.js', 'utf8'), context);
    const frame = (end, target) => context.self.onmessage({
        data: {
            samples: new Float32Array(1000),
            rate: 1000,
            time: end,
            target
        }
    });
    frame(1.5, {
        expected: [40],
        eventId: 7
    });
    frame(1.6, {
        expected: [55],
        eventId: 8
    });
    frame(1.7, {
        expected: [55],
        eventId: 8
    });
    assert.deepEqual(analysed, [
        [40],
        [40],
        [55]
    ]);
    assert.equal(posted[0].settledThrough, 1);
    assert.equal(posted[1].attack.time, 1);
    assert.equal(posted[1].eventId, 7);
    assert.equal(posted[2].eventId, 8);
});
