importScripts('dsp.js?v=1.2');
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
    // Keep an attack's original target while the pick transient settles,
    // even if a newer frame/visual target has moved to the next note.
    const analysisTarget = gate.pending?.analysisTarget || data.target || {
        expected,
        version
    };
    const result = GuitarDSP.analyse(data.samples, data.rate, analysisTarget.expected, floor);
    const time = data.time - data.samples.length / data.rate / 2;
    const attack = gate.process(result, time);
    if (gate.pending) gate.pending.analysisTarget = analysisTarget;
    self.postMessage({
        type: 'analysis',
        rms: result.rms,
        time,
        // No event before this audio time is still awaiting pitch settlement.
        settledThrough: gate.pending ? gate.pending.time : time,
        attack: attack ? {
            time: attack.time,
            pitches: attack.pitches,
            confidence: attack.confidence
        } : null,
        eventId: analysisTarget.eventId,
        version: analysisTarget.version ?? version
    });
};
