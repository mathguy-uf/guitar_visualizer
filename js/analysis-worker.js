importScripts('dsp.js');
const gate = new GuitarDSP.AttackGate();
let expected = [],
    floor = .004,
    version = 0;
self.onmessage = ({
    data
}) => {
    if (data.type === 'target') {
        expected = data.expected;
        version = data.version;
        return;
    }
    if (data.type === 'reset') {
        gate.reset();
        return;
    }
    if (data.type === 'floor') {
        floor = data.floor;
        return;
    }
    const result = GuitarDSP.analyse(data.samples, data.rate, expected, floor);
    // The centre of the causal window is a practical initial latency estimate;
    // user timing calibration corrects the remaining device/player offset.
    const time = data.time - data.samples.length / data.rate / 2;
    const attack = gate.process(result, time);
    self.postMessage({
        type: 'analysis',
        rms: result.rms,
        time,
        attack: attack ? {
            time: attack.time,
            pitches: attack.pitches,
            confidence: attack.confidence
        } : null,
        version
    });
};
