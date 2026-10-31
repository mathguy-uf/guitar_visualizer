const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Exercise the production detector and the displayed feedback without a microphone.
function fixture() {
    class Element {
        constructor() {
            this.value = ""; this.children = []; this.textContent = "";
            this.style = { setProperty(name, value) { this[name] = value; } };
            this.dataset = {}; this.listeners = {}; this.attributes = {}; this.open = true;
        }
        set innerHTML(value) { this.children = []; }
        appendChild(child) { this.children.push(child); }
        setAttribute(key, value) { this.attributes[key] = value; }
        addEventListener(name, callback) { this.listeners[name] = callback; }
    }
    const ids = ["tunerPanel", "tunerTuning", "tunerString", "tunerTolerance", "tunerStart", "tunerStatus", "tunerNote", "tunerFrequency", "tunerFeedback", "tunerNeedle", "tunerDisplay"];
    const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
    elements.tunerTuning.value = "standard";
    elements.tunerString.value = "auto";
    elements.tunerTolerance.value = "10";
    const context = {
        document: { getElementById: id => elements[id], createElement: () => new Element() },
        window: { addEventListener() {} },
        cancelAnimationFrame() {}
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "tuner.js"), "utf8"), context);
    return { context, elements };
}

function frequency(midi, cents = 0) { return 440 * 2 ** ((midi - 69) / 12 + cents / 1200); }

function signal(hz, sampleRate, amplitude = 0.1, noise = 0) {
    let seed = 7;
    return Float32Array.from({ length: 4096 }, (_, i) => {
        seed = (1664525 * seed + 1013904223) >>> 0;
        const t = i / sampleRate;
        // Harmonic-rich pluck with a decaying envelope, plus reproducible noise.
        const wave = Math.sin(2 * Math.PI * hz * t) + 0.35 * Math.sin(4 * Math.PI * hz * t) + 0.12 * Math.sin(6 * Math.PI * hz * t);
        return amplitude * Math.exp(-t * 2) * wave + noise * (seed / 0x100000000 - 0.5);
    });
}

test("detects standard and Drop D strings even after they become quiet", () => {
    const { context } = fixture();
    for (const sampleRate of [44100, 48000]) {
        for (const midi of [38, 40, 45, 50, 55, 59, 64]) {
            for (const cents of [-25, 0, 25]) {
                for (const amplitude of [0.1, 0.006]) {
                    const expected = frequency(midi, cents);
                    const measured = context.detectTunerPitch(signal(expected, sampleRate, amplitude, 0.001), sampleRate);
                    assert.ok(measured, "a quiet string should remain live");
                    assert.ok(Math.abs(1200 * Math.log2(measured / expected)) < 3, `pitch error at ${expected} Hz`);
                }
            }
        }
    }
});

test("silence, broadband noise, and below-range hum do not look in tune", () => {
    const { context } = fixture();
    assert.equal(context.detectTunerPitch(new Float32Array(4096), 48000), null);
    for (let i = 0; i < 5; i++) {
        assert.equal(context.detectTunerPitch(signal(100 + i, 48000, 0, 0.1), 48000), null);
    }
    assert.equal(context.detectTunerPitch(signal(60, 48000, 0.1), 48000), null);
});

test("default tolerance is forgiving, but fine mode is still available", () => {
    const { context, elements } = fixture();
    context.updateTunerReading(frequency(45, 8), 1000);
    assert.equal(elements.tunerDisplay.dataset.state, "in-tune");
    assert.match(elements.tunerFeedback.textContent, /In tune/);
    elements.tunerTolerance.value = "5";
    elements.tunerTolerance.listeners.change();
    context.updateTunerReading(frequency(45, 8), 1100);
    assert.equal(elements.tunerDisplay.dataset.state, "close");
    assert.match(elements.tunerFeedback.textContent, /sharp/);
    context.updateTunerReading(frequency(45, -30), 1700);
    assert.equal(elements.tunerDisplay.dataset.state, "out");
    assert.match(elements.tunerFeedback.textContent, /flat/);
});

test("boundary jitter does not flicker green, and real adjustments move the needle", () => {
    const { context, elements } = fixture();
    const read = (cents, time) => context.updateTunerReading(frequency(45, cents), time);
    read(8, 1000); read(11, 1075); read(9, 1150); read(11, 1225);
    assert.equal(elements.tunerDisplay.dataset.state, "in-tune");
    read(30, 1300); read(30, 1375); read(30, 1450);
    assert.equal(elements.tunerDisplay.dataset.state, "out");
    assert.ok(parseFloat(elements.tunerNeedle.style.left) > 75);
    read(-20, 1525); read(-20, 1600);
    assert.ok(parseFloat(elements.tunerNeedle.style.left) < 35, "a sustained new pitch takes over within two samples");
});

test("live decaying notes follow tuning changes rather than becoming held", () => {
    const { context, elements } = fixture();
    for (let i = 0; i < 8; i++) {
        const pitch = context.detectTunerPitch(signal(frequency(45, 35 - i * 5), 48000, 0.025 - i * 0.0025), 48000);
        context.updateTunerReading(pitch, 1000 + i * 75);
        assert.notEqual(elements.tunerDisplay.dataset.state, "held");
    }
    assert.equal(elements.tunerDisplay.dataset.state, "in-tune");
    assert.ok(Math.abs(parseFloat(elements.tunerNeedle.style.left) - 50) < 10);
});

test("a held reading is visibly stale and never remains green; fresh plucks update immediately", () => {
    const { context, elements } = fixture();
    context.updateTunerReading(frequency(40), 1000);
    const previous = elements.tunerFrequency.textContent;
    context.updateTunerReading(null, 1225);
    assert.equal(elements.tunerFrequency.textContent, previous, "short dropouts keep the needle");
    context.updateTunerReading(null, 1375);
    assert.equal(elements.tunerDisplay.dataset.state, "held");
    assert.doesNotMatch(elements.tunerFeedback.textContent, /In tune/);
    context.updateTunerReading(null, 4900);
    assert.equal(elements.tunerFrequency.textContent, previous, "keep the four-second hold");
    context.updateTunerReading(frequency(45, 30), 4975);
    assert.match(elements.tunerNote.textContent, /A2/);
    assert.equal(elements.tunerDisplay.dataset.state, "out");
    assert.ok(parseFloat(elements.tunerNeedle.style.left) > 75);
    context.updateTunerReading(null, 9050);
    assert.equal(elements.tunerDisplay.dataset.state, "idle");
    assert.equal(elements.tunerNeedle.style.display, "none");
});

test("string/tuning changes and Stop clear the old tuning result", () => {
    const { context, elements } = fixture();
    context.updateTunerReading(frequency(40), 1000);
    elements.tunerString.value = "1";
    elements.tunerString.listeners.change();
    assert.equal(elements.tunerDisplay.dataset.state, "idle");
    context.updateTunerReading(frequency(45), 1100);
    context.stopTuner();
    assert.equal(elements.tunerStatus.textContent, "Microphone off.");
    assert.equal(elements.tunerDisplay.dataset.state, "idle");
    elements.tunerTuning.value = "dropD";
    elements.tunerString.value = "auto";
    elements.tunerTuning.listeners.change();
    context.updateTunerReading(frequency(38), 2000);
    assert.match(elements.tunerNote.textContent, /String 6 · D2/);
    assert.equal(elements.tunerDisplay.dataset.state, "in-tune");
});
