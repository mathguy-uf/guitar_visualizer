/* Capture is on the audio rendering thread. Pitch work runs in a Worker. */
class GuitarCapture extends AudioWorkletProcessor {
    constructor() {
        super();
        this.ring = new Float32Array(4096);
        this.index = 0;
        this.count = 0;
        this.hop = 0;
    }
    process(inputs, outputs) {
        const input = inputs[0]?.[0];
        if (!input) return true;
        for (let i = 0; i < input.length; i++) {
            this.ring[this.index] = input[i];
            this.index = (this.index + 1) % 4096;
            this.count++;
            this.hop++;
            if (this.count >= 4096 && this.hop >= 1024) {
                this.hop = 0;
                const data = new Float32Array(4096);
                for (let j = 0; j < 4096; j++) data[j] = this.ring[(this.index + j) % 4096];
                this.port.postMessage({
                    samples: data,
                    rate: sampleRate,
                    time: (currentFrame + i + 1) / sampleRate
                }, [data.buffer]);
            }
        }
        // The input is never monitored through the speakers.
        for (const channel of outputs[0] || []) channel.fill(0);
        return true;
    }
}
registerProcessor('guitar-capture', GuitarCapture);
