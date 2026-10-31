"use strict";

const TUNINGS = {
    standard: [{name:"E2", midi:40}, {name:"A2", midi:45}, {name:"D3", midi:50}, {name:"G3", midi:55}, {name:"B3", midi:59}, {name:"E4", midi:64}],
    dropD: [{name:"D2", midi:38}, {name:"A2", midi:45}, {name:"D3", midi:50}, {name:"G3", midi:55}, {name:"B3", midi:59}, {name:"E4", midi:64}]
};
const tunerPanel = document.getElementById("tunerPanel");
const tunerTuning = document.getElementById("tunerTuning");
const tunerString = document.getElementById("tunerString");
const tunerStart = document.getElementById("tunerStart");
const tunerStatus = document.getElementById("tunerStatus");
const tunerNote = document.getElementById("tunerNote");
const tunerFrequency = document.getElementById("tunerFrequency");
const tunerFeedback = document.getElementById("tunerFeedback");
const tunerNeedle = document.getElementById("tunerNeedle");
let tunerStream = null;
let tunerAudio = null;
let tunerFrame = null;
let tunerGeneration = 0;
let tunerActive = false;
const TUNER_READING_HOLD_MS = 4000;
let tunerLastPitchAt = null;

function tunerTargetFrequency(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

// YIN-style normalized difference finds the fundamental, including low Drop D.
// Downsampling keeps microphone analysis light enough for a phone.
function detectTunerPitch(buffer, sampleRate) {
    const stride = Math.max(1, Math.floor(sampleRate / 12000));
    const samples = new Float32Array(Math.floor(buffer.length / stride));
    let mean = 0;
    for (let i = 0; i < samples.length; i++) { samples[i] = buffer[i * stride]; mean += samples[i]; }
    mean /= samples.length;
    let energy = 0;
    for (let i = 0; i < samples.length; i++) { samples[i] -= mean; energy += samples[i] * samples[i]; }
    if (Math.sqrt(energy / samples.length) < 0.01) return null;
    const rate = sampleRate / stride;
    const minTau = Math.floor(rate / 380);
    const maxTau = Math.min(Math.ceil(rate / 65), Math.floor(samples.length / 2) - 1);
    if (maxTau <= minTau) return null;
    const difference = new Float32Array(maxTau + 1);
    const length = samples.length - maxTau;
    for (let tau = 1; tau <= maxTau; tau++) {
        let sum = 0;
        for (let i = 0; i < length; i++) { const delta = samples[i] - samples[i + tau]; sum += delta * delta; }
        difference[tau] = sum;
    }
    let cumulative = 0;
    for (let tau = 1; tau <= maxTau; tau++) {
        cumulative += difference[tau];
        difference[tau] = cumulative ? difference[tau] * tau / cumulative : 1;
    }
    for (let tau = minTau; tau < maxTau; tau++) {
        if (difference[tau] < 0.15) {
            while (tau + 1 <= maxTau && difference[tau + 1] < difference[tau]) tau++;
            const a = difference[tau - 1], b = difference[tau], c = difference[Math.min(tau + 1, maxTau)];
            const denominator = a - 2 * b + c;
            const adjustment = denominator ? 0.5 * (a - c) / denominator : 0;
            return rate / (tau + Math.max(-1, Math.min(1, adjustment)));
        }
    }
    return null;
}

function populateTunerStrings() {
    const previous = tunerString.value;
    tunerString.innerHTML = "";
    const auto = document.createElement("option");
    auto.value = "auto"; auto.textContent = "Detect automatically";
    tunerString.appendChild(auto);
    TUNINGS[tunerTuning.value].forEach((item, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = `String ${6 - index} · ${item.name}`;
        tunerString.appendChild(option);
    });
    tunerString.value = previous !== "" ? previous : "auto";
}

function resetTunerDisplay() {
    tunerLastPitchAt = null;
    tunerNote.textContent = "—";
    tunerFrequency.textContent = "Play an open string";
    tunerFeedback.textContent = "Flat ←   In tune   → Sharp";
    tunerNeedle.style.display = "none";
}

// Brief detection gaps are normal as a plucked string decays. Keep the last
// reading visible, but accept a fresh pitch immediately rather than locking it.
function updateTunerReading(pitch, time) {
    let status = "Listening. Pluck one open string.";
    if (pitch) {
        tunerLastPitchAt = time;
        displayTunerPitch(pitch);
    } else if (tunerLastPitchAt !== null && time - tunerLastPitchAt <= TUNER_READING_HOLD_MS) {
        if (time - tunerLastPitchAt >= 450) status = "Last reading — pluck again to update.";
    } else {
        resetTunerDisplay();
    }
    if (tunerStatus.textContent !== status) tunerStatus.textContent = status;
}

function displayTunerPitch(frequency) {
    const targets = TUNINGS[tunerTuning.value];
    const target = tunerString.value === "auto"
        ? targets.reduce((best, item) => Math.abs(1200 * Math.log2(frequency / tunerTargetFrequency(item.midi))) < Math.abs(1200 * Math.log2(frequency / tunerTargetFrequency(best.midi))) ? item : best)
        : targets[Number(tunerString.value)];
    if (!target) return;
    const cents = 1200 * Math.log2(frequency / tunerTargetFrequency(target.midi));
    const stringNumber = 6 - targets.indexOf(target);
    tunerNote.textContent = `String ${stringNumber} · ${target.name}`;
    tunerFrequency.textContent = `${frequency.toFixed(1)} Hz · target ${tunerTargetFrequency(target.midi).toFixed(1)} Hz`;
    tunerFeedback.textContent = Math.abs(cents) <= 5 ? "In tune (within 5 cents)" : `${Math.round(Math.abs(cents))} cents ${cents < 0 ? "flat" : "sharp"}`;
    tunerNeedle.style.display = "block";
    tunerNeedle.style.left = `${50 + Math.max(-50, Math.min(50, cents))}%`;
}

function stopTuner() {
    tunerGeneration++;
    tunerActive = false;
    if (tunerFrame !== null) cancelAnimationFrame(tunerFrame);
    tunerFrame = null;
    if (tunerStream) tunerStream.getTracks().forEach(track => track.stop());
    tunerStream = null;
    if (tunerAudio) { tunerAudio.close().catch(() => {}); tunerAudio = null; }
    tunerStart.textContent = "🎙 Start tuner";
    tunerStart.setAttribute("aria-pressed", "false");
    tunerStatus.textContent = "Microphone off.";
    resetTunerDisplay();
}

async function startTuner() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        tunerStatus.textContent = "Microphone access is unavailable. Open this page over HTTPS in a supported browser.";
        return;
    }
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) { tunerStatus.textContent = "Audio is not supported in this browser."; return; }
    const generation = ++tunerGeneration;
    tunerActive = true;
    tunerStart.textContent = "■ Stop tuner";
    tunerStart.setAttribute("aria-pressed", "true");
    tunerStatus.textContent = "Waiting for microphone permission…";
    try {
        const stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false, noiseSuppression:false, autoGainControl:false}});
        if (!tunerActive || generation !== tunerGeneration) { stream.getTracks().forEach(track => track.stop()); return; }
        tunerStream = stream;
        tunerAudio = new Audio();
        await tunerAudio.resume();
        if (!tunerActive || generation !== tunerGeneration) return;
        const source = tunerAudio.createMediaStreamSource(stream);
        const analyser = tunerAudio.createAnalyser();
        analyser.fftSize = 4096;
        source.connect(analyser);
        const buffer = new Float32Array(analyser.fftSize);
        let last = 0;
        tunerStatus.textContent = "Listening. Pluck one open string.";
        const listen = time => {
            if (!tunerActive || generation !== tunerGeneration) return;
            if (time - last >= 150) {
                analyser.getFloatTimeDomainData(buffer);
                const pitch = detectTunerPitch(buffer, tunerAudio.sampleRate);
                updateTunerReading(pitch, time);
                last = time;
            }
            tunerFrame = requestAnimationFrame(listen);
        };
        tunerFrame = requestAnimationFrame(listen);
    } catch (error) {
        if (generation !== tunerGeneration) return;
        stopTuner();
        tunerStatus.textContent = error.name === "NotAllowedError" ? "Microphone permission was denied. Enable it in your browser settings and try again." : "Could not access the microphone. Check your browser and microphone settings.";
    }
}

tunerStart.addEventListener("click", () => tunerActive ? stopTuner() : startTuner());
tunerTuning.addEventListener("change", () => { populateTunerStrings(); resetTunerDisplay(); });
tunerString.addEventListener("change", resetTunerDisplay);
tunerPanel.addEventListener("toggle", () => { if (!tunerPanel.open && tunerActive) stopTuner(); });
window.addEventListener("pagehide", stopTuner);
populateTunerStrings();

