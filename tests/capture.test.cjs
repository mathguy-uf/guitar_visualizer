const {
    test
} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('audio capture preserves sample order, timestamps, hop spacing, and silent output', () => {
    let Processor;
    const messages = [];
    const context = {
        sampleRate: 48000,
        currentFrame: 0,
        AudioWorkletProcessor: class {
            constructor() {
                this.port = {
                    postMessage(data) {
                        messages.push(data);
                    }
                };
            }
        },
        registerProcessor(_name, Class) {
            Processor = Class;
        }
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync('js/capture-worklet.js', 'utf8'), context);
    const capture = new Processor();
    for (let frame = 0; frame < 48; frame++) {
        context.currentFrame = frame * 128;
        const input = Float32Array.from({
            length: 128
        }, (_, i) => (frame * 128 + i) / 10000);
        const output = new Float32Array(128).fill(1);
        capture.process([
            [input]
        ], [
            [output]
        ]);
        assert.ok(output.every(v => v === 0));
    }
    assert.equal(messages.length, 3);
    for (let i = 0; i < 3; i++) {
        assert.equal(messages[i].time, (4096 + i * 1024) / 48000);
        assert.ok(Math.abs(messages[i].samples[0] - i * 1024 / 10000) < 1e-6);
        assert.ok(Math.abs(messages[i].samples[4095] - (4095 + i * 1024) / 10000) < 1e-6);
    }
});
