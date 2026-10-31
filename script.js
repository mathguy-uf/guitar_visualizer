const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const FLAT_NOTE_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
const INTERVAL_NAMES = ["1", "♭2", "2", "♭3", "3", "4", "♭5", "5", "♭6", "6", "♭7", "7"];

const OPEN_STRINGS = [
    { number: 1, label: "e", note: 4, midi: 64 },
    { number: 2, label: "B", note: 11, midi: 59 },
    { number: 3, label: "G", note: 7, midi: 55 },
    { number: 4, label: "D", note: 2, midi: 50 },
    { number: 5, label: "A", note: 9, midi: 45 },
    { number: 6, label: "E", note: 4, midi: 40 }
];

const SCALES = {
    majorPentatonic: { name: "major pentatonic", family: "major", intervals: [0, 2, 4, 7, 9] },
    minorPentatonic: { name: "minor pentatonic", family: "minor", intervals: [0, 3, 5, 7, 10] },
    majorScale: { name: "major scale", family: "major", intervals: [0, 2, 4, 5, 7, 9, 11] },
    naturalMinor: { name: "natural minor", family: "minor", intervals: [0, 2, 3, 5, 7, 8, 10] }
};

const TRIADS = {
    major: { name: "major", intervals: [0, 4, 7] },
    minor: { name: "minor", intervals: [0, 3, 7] },
    diminished: { name: "diminished", intervals: [0, 3, 6] },
    augmented: { name: "augmented", intervals: [0, 4, 8] }
};

const STRING_SETS = {
    "1-3": { name: "Strings 1–3", indices: [0, 1, 2] },
    "2-4": { name: "Strings 2–4", indices: [1, 2, 3] },
    "3-5": { name: "Strings 3–5", indices: [2, 3, 4] },
    "4-6": { name: "Strings 4–6", indices: [3, 4, 5] }
};

const INVERSION_NAMES = {
    all: "All inversions",
    root: "Root position",
    first: "1st inversion",
    second: "2nd inversion"
};

const NATURAL_ROOTS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const keySelect = document.getElementById("keySelect");
const scaleSelect = document.getElementById("scaleSelect");
const patternSelect = document.getElementById("patternSelect");
const patternPositionSelect = document.getElementById("patternPositionSelect");
const patternHelp = document.getElementById("patternHelp");
const labelModeSelect = document.getElementById("labelModeSelect");
const fretSelect = document.getElementById("fretSelect");
const blueNoteToggle = document.getElementById("blueNoteToggle");
const blueNoteLabel = document.getElementById("blueNoteLabel");
const triadToggle = document.getElementById("triadToggle");
const triadRootSelect = document.getElementById("triadRootSelect");
const triadQualitySelect = document.getElementById("triadQualitySelect");
const stringSetSelect = document.getElementById("stringSetSelect");
const inversionSelect = document.getElementById("inversionSelect");
const progressionToggle = document.getElementById("progressionToggle");
const progressionInput = document.getElementById("progressionInput");
const loadProgressionButton = document.getElementById("loadProgressionButton");
const previousChordButton = document.getElementById("previousChordButton");
const nextChordButton = document.getElementById("nextChordButton");
const progressionChips = document.getElementById("progressionChips");
const progressionStatus = document.getElementById("progressionStatus");
const progressionError = document.getElementById("progressionError");
const resetButton = document.getElementById("resetButton");
const scaleTitle = document.getElementById("scaleTitle");
const scaleNotes = document.getElementById("scaleNotes");
const triadSummary = document.getElementById("triadSummary");
const triadTitle = document.getElementById("triadTitle");
const triadMeta = document.getElementById("triadMeta");
const triadNotes = document.getElementById("triadNotes");
const fretboard = document.getElementById("fretboard");
const practiceAreaSelect = document.getElementById("practiceAreaSelect");
const triadViewSelect = document.getElementById("triadViewSelect");
const shapeSelect = document.getElementById("shapeSelect");
const soloPrompt = document.getElementById("soloPrompt");
const overviewLegend = document.getElementById("overviewLegend");
const progressionPanel = document.getElementById("progressionPanel");
const modeDescription = document.getElementById("modeDescription");
const settingsPanel = document.getElementById("settingsPanel");
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const overviewColors = ["#fb7185", "#22d3ee", "#facc15", "#a3e635", "#f9a8d4", "#fb923c", "#c4b5fd", "#f8fafc"];
let currentMode = "explore";
let audioContext;

function playNotes(midis) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) { soloPrompt.textContent = "Audio is not supported by this browser."; return; }
    audioContext ||= new Audio();
    audioContext.resume();
    const start = audioContext.currentTime;
    midis.forEach((midi, index) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const time = start + index * 0.09;
        osc.type = "triangle";
        osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(0.11 / Math.sqrt(midis.length), time + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.8);
        osc.connect(gain).connect(audioContext.destination);
        osc.start(time);
        osc.stop(time + 0.82);
    });
}

function setMode(mode) {
    currentMode = mode;
    modeButtons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.mode === mode)));
    modeDescription.textContent = {
        explore: "Explore a scale and its chord shapes. Open settings to customize your view.",
        triads: "Choose a chord and a shape to learn its notes and inversions.",
        solo: "Follow a progression and aim for a chord tone as each chord arrives."
    }[mode];
    progressionPanel.hidden = mode !== "solo";
    if (mode === "triads") {
        progressionToggle.checked = false;
        triadToggle.checked = true;
        triadViewSelect.value = "one";
        settingsPanel.open = true;
    } else if (mode === "solo") {
        triadToggle.checked = true;
        triadViewSelect.value = "one";
        labelModeSelect.value = "chord";
        settingsPanel.open = false;
        if (!progressionChords.length && !loadProgression()) return;
        progressionToggle.checked = true;
    } else {
        progressionToggle.checked = false;
        settingsPanel.open = false;
    }
    progressionSelectedVoicing = null;
    render();
}

let progressionChords = [];
let progressionIndex = 0;
let progressionSelectedVoicing = null;

// Walk successive pentatonic tones across adjacent string pairs, beginning
// at a low-E root. Standard tuning's B-string offset follows from MIDI pitch.
function getPentatonicPattern(root, scaleKey, octaveOffset) {
    const intervals = SCALES[scaleKey].intervals;
    const counts = scaleKey === "majorPentatonic" ? [3, 2, 3, 2, 3, 2] : [2, 3, 2, 3, 2, 3];
    const rootFret = (root - OPEN_STRINGS[5].note + 12) % 12 + octaveOffset;
    let lastMidi = OPEN_STRINGS[5].midi + rootFret - 1;
    const positions = new Set();
    for (let step = 0; step < 6; step += 1) {
        const stringIndex = 5 - step;
        let found = 0;
        for (let fret = 0; fret <= 36 && found < counts[step]; fret += 1) {
            const midi = OPEN_STRINGS[stringIndex].midi + fret;
            if (midi <= lastMidi || !intervals.includes((midi - root + 120) % 12)) continue;
            positions.add(`${stringIndex}:${fret}`);
            lastMidi = midi;
            found += 1;
        }
    }
    return positions;
}

function getBlueNoteInterval(scaleKey) {
    return SCALES[scaleKey].family === "major" ? 3 : 6;
}

function getBlueNoteInfo(root, scaleKey) {
    const interval = getBlueNoteInterval(scaleKey);
    return { interval, intervalName: INTERVAL_NAMES[interval], note: (root + interval) % 12 };
}

function getScaleNotes(root, scaleKey, includeBlueNote = false) {
    const intervals = [...SCALES[scaleKey].intervals];
    if (includeBlueNote) {
        const blueInterval = getBlueNoteInterval(scaleKey);
        if (!intervals.includes(blueInterval)) intervals.push(blueInterval);
    }
    intervals.sort((a, b) => a - b);
    return intervals.map(interval => (root + interval) % 12);
}

function getTriadNotes(root, quality) {
    return TRIADS[quality].intervals.map(interval => (root + interval) % 12);
}

function getIntervalName(note, scaleRoot) {
    return INTERVAL_NAMES[(note - scaleRoot + 12) % 12];
}

function getMarkerLabel(note, scaleRoot, labelMode, isBlueNote = false) {
    if (labelMode === "intervals") return getIntervalName(note, scaleRoot);
    return isBlueNote ? FLAT_NOTE_NAMES[note] : NOTE_NAMES[note];
}

function makeSummaryChip(note, scaleRoot, className = "", displayName = null) {
    const chip = document.createElement("span");
    chip.className = `note-chip${className ? ` ${className}` : ""}`;
    chip.textContent = `${displayName || NOTE_NAMES[note]} · ${getIntervalName(note, scaleRoot)}`;
    return chip;
}

function renderScaleSummary(root, scaleKey, includeBlueNote) {
    const scale = SCALES[scaleKey];
    const blue = getBlueNoteInfo(root, scaleKey);
    const notes = getScaleNotes(root, scaleKey, includeBlueNote);

    blueNoteLabel.textContent = `Blue note · ${blue.intervalName}`;
    scaleTitle.textContent = `${NOTE_NAMES[root]} ${scale.name}${includeBlueNote ? " + blue note" : ""}`;
    scaleNotes.innerHTML = "";

    notes.forEach(note => {
        const isRoot = note === root;
        const isBlue = includeBlueNote && note === blue.note;
        const classes = [isRoot ? "root-chip" : "", isBlue ? "blue-note-chip" : ""].filter(Boolean).join(" ");
        scaleNotes.appendChild(makeSummaryChip(note, root, classes, isBlue ? FLAT_NOTE_NAMES[note] : null));
    });
}

function getCandidatePositions(stringIndex, triadNoteSet, maxFret) {
    const stringInfo = OPEN_STRINGS[stringIndex];
    const positions = [];
    for (let fret = 0; fret <= maxFret; fret += 1) {
        const note = (stringInfo.note + fret) % 12;
        if (triadNoteSet.has(note)) positions.push({ stringIndex, fret, note, midi: stringInfo.midi + fret });
    }
    return positions;
}

function classifyInversion(voicing, triadRoot, triadQuality) {
    const intervals = TRIADS[triadQuality].intervals;
    const rootNote = triadRoot;
    const thirdNote = (triadRoot + intervals[1]) % 12;
    const fifthNote = (triadRoot + intervals[2]) % 12;
    const bass = voicing.reduce((lowest, position) => position.midi < lowest.midi ? position : lowest);
    if (bass.note === rootNote) return "root";
    if (bass.note === thirdNote) return "first";
    if (bass.note === fifthNote) return "second";
    return "root";
}

function getTriadVoicings(triadRoot, triadQuality, stringSetKey, inversion, maxFret) {
    const triadNotes = getTriadNotes(triadRoot, triadQuality);
    const triadNoteSet = new Set(triadNotes);
    const setKeys = stringSetKey === "all" ? Object.keys(STRING_SETS) : [stringSetKey];
    const voicings = [];

    setKeys.forEach(setKey => {
        const stringIndices = STRING_SETS[setKey].indices;
        const candidates = stringIndices.map(index => getCandidatePositions(index, triadNoteSet, maxFret));
        candidates[0].forEach(first => {
            candidates[1].forEach(second => {
                candidates[2].forEach(third => {
                    const voicing = [first, second, third];
                    const noteSet = new Set(voicing.map(position => position.note));
                    if (noteSet.size !== 3 || triadNotes.some(note => !noteSet.has(note))) return;
                    const frets = voicing.map(position => position.fret);
                    if (Math.max(...frets) - Math.min(...frets) > 4) return;
                    const voicingInversion = classifyInversion(voicing, triadRoot, triadQuality);
                    if (inversion !== "all" && voicingInversion !== inversion) return;
                    voicings.push({ setKey, inversion: voicingInversion, positions: voicing });
                });
            });
        });
    });

    return voicings;
}

function getTriadPositionMap(voicings) {
    const map = new Map();
    voicings.forEach((voicing, voicingIndex) => {
        voicing.positions.forEach(position => {
            const key = `${position.stringIndex}:${position.fret}`;
            if (!map.has(key)) map.set(key, { note: position.note, voicingIndices: [] });
            map.get(key).voicingIndices.push(voicingIndex);
        });
    });
    return map;
}

function getVoicingAverageFret(voicing) {
    return voicing.positions.reduce((sum, position) => sum + position.fret, 0) / voicing.positions.length;
}

function getVoiceLeadingCost(previousVoicing, nextVoicing) {
    if (!previousVoicing) return getVoicingAverageFret(nextVoicing);
    const previousByString = new Map(previousVoicing.positions.map(position => [position.stringIndex, position.fret]));
    const nextByString = new Map(nextVoicing.positions.map(position => [position.stringIndex, position.fret]));
    const commonStrings = [...previousByString.keys()].filter(key => nextByString.has(key));
    if (commonStrings.length === 3) {
        return commonStrings.reduce((sum, stringIndex) => sum + Math.abs(previousByString.get(stringIndex) - nextByString.get(stringIndex)), 0);
    }
    return Math.abs(getVoicingAverageFret(previousVoicing) - getVoicingAverageFret(nextVoicing)) * 3 + 8;
}

function chooseNearestVoicing(voicings, previousVoicing) {
    if (voicings.length === 0) return null;
    return voicings.reduce((best, candidate) =>
        getVoiceLeadingCost(previousVoicing, candidate) < getVoiceLeadingCost(previousVoicing, best) ? candidate : best
    );
}

function parseChordToken(rawToken) {
    const token = rawToken.trim().replaceAll("♯", "#").replaceAll("♭", "b");
    const match = token.match(/^([A-Ga-g])([#b]?)(maj|major|min|minor|m|dim|°|aug|\+)?$/i);
    if (!match) return null;
    const letter = match[1].toUpperCase();
    const accidental = match[2] || "";
    const suffix = (match[3] || "").toLowerCase();
    let root = NATURAL_ROOTS[letter];
    if (accidental === "#") root = (root + 1) % 12;
    if (accidental === "b") root = (root + 11) % 12;
    let quality = "major";
    if (["m", "min", "minor"].includes(suffix)) quality = "minor";
    if (["dim", "°"].includes(suffix)) quality = "diminished";
    if (["aug", "+"].includes(suffix)) quality = "augmented";
    const qualitySuffix = quality === "major" ? "" : quality === "minor" ? "m" : quality === "diminished" ? "°" : "+";
    const rootLabel = `${letter}${accidental}`.replace("#", "♯").replace("b", "♭");
    return { root, quality, label: `${rootLabel}${qualitySuffix}` };
}

function parseProgression(text) {
    const cleaned = text.replaceAll("→", " ").replaceAll("->", " ").replace(/[|,;/]+/g, " ");
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    const chords = [];
    const invalid = [];
    tokens.forEach(token => {
        const chord = parseChordToken(token);
        if (chord) chords.push(chord);
        else invalid.push(token);
    });
    return { chords, invalid };
}

function progressionModeIsActive() {
    return progressionToggle.checked && progressionChords.length > 0;
}

function getCurrentTriadSettings() {
    if (progressionModeIsActive()) {
        const chord = progressionChords[progressionIndex];
        return { root: chord.root, quality: chord.quality };
    }
    return { root: Number.parseInt(triadRootSelect.value, 10), quality: triadQualitySelect.value };
}

function renderProgressionControls() {
    const active = progressionModeIsActive();
    progressionChips.innerHTML = "";
    progressionChords.forEach((chord, index) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = `progression-chip${active && index === progressionIndex ? " active" : ""}`;
        chip.textContent = chord.label;
        chip.setAttribute("aria-label", `Go to ${chord.label}, chord ${index + 1}`);
        chip.addEventListener("click", () => { progressionIndex = index; shapeSelect.value = ""; render(); });
        progressionChips.appendChild(chip);
    });
    previousChordButton.disabled = !active || progressionChords.length < 2;
    nextChordButton.disabled = !active || progressionChords.length < 2;
    if (!progressionToggle.checked) {
        progressionStatus.textContent = "Turn progression mode on to step through the chords.";
    } else if (progressionChords.length === 0) {
        progressionStatus.textContent = "Enter a progression, then choose Load progression.";
    } else {
        const chord = progressionChords[progressionIndex];
        const layerState = triadToggle.checked ? "secondary shown" : "secondary hidden";
        progressionStatus.textContent = `Chord ${progressionIndex + 1} of ${progressionChords.length}: ${chord.label} · ${layerState}`;
    }
}

function loadProgression() {
    const parsed = parseProgression(progressionInput.value);
    if (parsed.invalid.length > 0 || parsed.chords.length === 0) {
        const bad = parsed.invalid.length > 0 ? `Could not read: ${parsed.invalid.join(", ")}.` : "Enter at least one chord.";
        progressionError.textContent = `${bad} Try chords like G, D, Em, C, B♭, F♯m, C° or A+.`;
        progressionError.hidden = false;
        return false;
    }
    progressionError.hidden = true;
    progressionChords = parsed.chords;
    progressionIndex = 0;
    progressionSelectedVoicing = null;
    progressionToggle.checked = true;
    render();
    return true;
}

function stepProgression(direction) {
    if (!progressionModeIsActive() || progressionChords.length < 2) return;
    progressionIndex = (progressionIndex + direction + progressionChords.length) % progressionChords.length;
    shapeSelect.value = "";
    render();
}

function renderTriadSummary(scaleRoot, triadRoot, quality, showTriad, stringSetKey, inversion, voicingCount, progressionActive) {
    triadToggle.disabled = false;
    triadRootSelect.disabled = !showTriad || progressionActive;
    triadQualitySelect.disabled = !showTriad || progressionActive;
    stringSetSelect.disabled = !showTriad && !progressionActive;
    inversionSelect.disabled = !showTriad && !progressionActive;
    triadSummary.hidden = !showTriad;
    if (!showTriad) return;
    const triad = TRIADS[quality];
    const notes = getTriadNotes(triadRoot, quality);
    const stringSetName = stringSetKey === "all" ? "All string sets" : STRING_SETS[stringSetKey].name;
    const voicingWord = voicingCount === 1 ? "voicing" : "voicings";
    triadTitle.textContent = `${NOTE_NAMES[triadRoot]} ${triad.name} triad`;
    triadMeta.textContent = `${stringSetName} · ${INVERSION_NAMES[inversion]} · ${voicingCount} displayed ${voicingWord}`;
    triadNotes.innerHTML = "";
    notes.forEach((note, index) => {
        triadNotes.appendChild(makeSummaryChip(note, scaleRoot, index === 0 ? "triad-chip triad-root-chip" : "triad-chip"));
    });
}

// Enclose each pair with a stepped outline that follows the two rows of notes.
// Coordinates are measured from rendered cells so the lines scale with the
// fretboard in both phone orientations and scroll along with it.
function patternOutlinePath(upper, lower, width, height) {
    const padX = 21;
    const padY = 22;
    const left = row => Math.max(1, Math.min(...row.map(p => p.x)) - padX);
    const right = row => Math.min(width - 1, Math.max(...row.map(p => p.x)) + padX);
    const top = Math.max(1, upper[0].y - padY);
    const bottom = Math.min(height - 1, lower[0].y + padY);
    const mid = (upper[0].y + lower[0].y) / 2;
    const ul = left(upper), ur = right(upper), ll = left(lower), lr = right(lower);
    return `M ${ul} ${top} H ${ur} V ${mid} H ${lr} V ${bottom} H ${ll} V ${mid} H ${ul} Z`;
}

function drawPatternOutlines() {
    const old = fretboard.querySelector(".pattern-outlines");
    if (old) old.remove();
    if (patternSelect.value !== "pattern" || !scaleSelect.value.endsWith("Pentatonic")) return;
    const rect = fretboard.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "pattern-outlines");
    svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
    svg.setAttribute("aria-hidden", "true");
    const counts = scaleSelect.value === "majorPentatonic" ? [3, 2, 3, 2, 3, 2] : [2, 3, 2, 3, 2, 3];
    for (let pair = 0; pair < 3; pair += 1) {
        const lowerIndex = 5 - pair * 2;
        const upperIndex = lowerIndex - 1;
        const coordinates = stringIndex => [...fretboard.querySelectorAll(`[data-pattern-string="${stringIndex}"]`)].map(cell => {
            const r = cell.getBoundingClientRect();
            return { x: r.left + r.width / 2 - rect.left, y: r.top + r.height / 2 - rect.top };
        });
        const lower = coordinates(lowerIndex), upper = coordinates(upperIndex);
        // Do not imply that a clipped or filtered fragment is the full shape.
        if (lower.length !== counts[pair * 2] || upper.length !== counts[pair * 2 + 1]) continue;
        const pathData = patternOutlinePath(upper, lower, rect.width, rect.height);
        ["pattern-outline-shadow", "pattern-outline-dash"].forEach(className => {
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", pathData);
            path.setAttribute("class", className);
            svg.appendChild(path);
        });
    }
    fretboard.appendChild(svg);
}

function renderFretboard(scaleRoot, scaleKey, includeBlueNote, maxFret, labelMode, showTriad, triadRoot, triadQuality, stringSetKey, voicings) {
    const patternActive = patternSelect.value === "pattern" && scaleKey.endsWith("Pentatonic");
    const patternPositions = patternActive ? getPentatonicPattern(scaleRoot, scaleKey, Number(patternPositionSelect.value)) : null;
    const baseScaleNoteSet = new Set(getScaleNotes(scaleRoot, scaleKey, false));
    const primaryNoteSet = new Set(getScaleNotes(scaleRoot, scaleKey, includeBlueNote));
    const blue = getBlueNoteInfo(scaleRoot, scaleKey);
    const triadPositionMap = showTriad ? getTriadPositionMap(voicings) : new Map();
    const overview = showTriad && triadViewSelect.value === "overview" && progressionModeIsActive();
    const areaStart = practiceAreaSelect.value === "all" ? null : Number(practiceAreaSelect.value);
    const selectedStringIndices = showTriad && stringSetKey !== "all" ? new Set(STRING_SETS[stringSetKey].indices) : new Set();
    const fretCount = maxFret + 1;
    const markerFrets = new Set([3, 5, 7, 9, 12, 15, 17, 19, 21, 24]);

    fretboard.style.setProperty("--fret-count", fretCount);
    fretboard.innerHTML = "";
    const numberRow = document.createElement("div");
    numberRow.className = "fret-number-row";
    const numberLabel = document.createElement("div");
    numberLabel.className = "string-label";
    numberRow.appendChild(numberLabel);
    for (let fret = 0; fret <= maxFret; fret += 1) {
        const numberCell = document.createElement("div");
        numberCell.className = "fret-number";
        numberCell.textContent = fret;
        numberRow.appendChild(numberCell);
    }
    fretboard.appendChild(numberRow);

    OPEN_STRINGS.forEach((stringInfo, stringIndex) => {
        const row = document.createElement("div");
        row.className = "fret-row";
        if (selectedStringIndices.has(stringIndex)) row.classList.add("selected-string-row");
        const stringLabel = document.createElement("div");
        stringLabel.className = "string-label";
        stringLabel.innerHTML = `<span class="string-number">${stringInfo.number}</span><span>${stringInfo.label}</span>`;
        row.appendChild(stringLabel);

        for (let fret = 0; fret <= maxFret; fret += 1) {
            const note = (stringInfo.note + fret) % 12;
            const withinArea = areaStart === null || (fret >= areaStart && fret <= areaStart + 4);
            const inPrimary = withinArea && (patternActive ? patternPositions.has(`${stringIndex}:${fret}`) : primaryNoteSet.has(note));
            const inBaseScale = baseScaleNoteSet.has(note);
            const isBlueNote = inPrimary && includeBlueNote && note === blue.note && !inBaseScale;
            const inTriad = withinArea && triadPositionMap.has(`${stringIndex}:${fret}`);
            const matchingChords = overview && withinArea ? progressionChords.map((chord, index) =>
                getTriadNotes(chord.root, chord.quality).includes(note) ? index : -1).filter(index => index >= 0) : [];
            const cell = document.createElement("div");
            cell.className = "fret-cell";
            if (patternActive && inPrimary) cell.dataset.patternString = String(stringIndex);
            if (!withinArea) cell.classList.add("outside-area");
            if (markerFrets.has(fret)) cell.classList.add("marker-fret");
            if (selectedStringIndices.has(stringIndex)) cell.classList.add("selected-triad-string");

            if (inPrimary || inTriad || matchingChords.length) {
                const markerStack = document.createElement("button");
                markerStack.type = "button";
                markerStack.className = "marker-stack";
                if (!inPrimary) markerStack.classList.add("triad-only");
                if (!inPrimary && !inTriad) markerStack.classList.add("overview-only");
                if (inPrimary && inTriad) markerStack.classList.add("layer-overlap");
                if (isBlueNote) markerStack.classList.add("blue-note-position");
                if (labelMode === "intervals") markerStack.classList.add("interval-mode");

                if (inPrimary) {
                    const scaleMarker = document.createElement("span");
                    scaleMarker.className = "scale-marker";
                    if (note === scaleRoot) scaleMarker.classList.add("root-note");
                    if (isBlueNote) scaleMarker.classList.add("blue-note");
                    markerStack.appendChild(scaleMarker);
                }
                if (inTriad) {
                    const triadMarker = document.createElement("span");
                    triadMarker.className = "triad-marker";
                    if (note === triadRoot) triadMarker.classList.add("triad-root-note");
                    markerStack.appendChild(triadMarker);
                }
                const label = document.createElement("span");
                label.className = "marker-label";
                label.textContent = labelMode === "chord" ? getIntervalName(note, triadRoot) : getMarkerLabel(note, scaleRoot, labelMode, isBlueNote);
                markerStack.appendChild(label);
                if (matchingChords.length) {
                    const dots = document.createElement("span");
                    dots.className = "chord-dots";
                    matchingChords.forEach(index => {
                        const dot = document.createElement("i");
                        dot.style.background = overviewColors[index % overviewColors.length];
                        dots.appendChild(dot);
                    });
                    markerStack.appendChild(dots);
                }

                const layerDescription = [
                    isBlueNote ? `blue note ${blue.intervalName}` : (inPrimary ? `${SCALES[scaleKey].name} tone` : null),
                    inTriad ? `${TRIADS[triadQuality].name} triad voicing tone` : null
                ].filter(Boolean).join(" + ");
                const displayNote = isBlueNote ? FLAT_NOTE_NAMES[note] : NOTE_NAMES[note];
                markerStack.title = `${displayNote} · interval ${getIntervalName(note, scaleRoot)} · string ${stringInfo.number} · fret ${fret} · ${layerDescription}`;
                markerStack.setAttribute("aria-label", `Play ${displayNote}, string ${stringInfo.number}, fret ${fret}, ${layerDescription}${matchingChords.length ? ", chord tones for " + matchingChords.map(i => progressionChords[i].label).join(", ") : ""}`);
                markerStack.addEventListener("click", () => playNotes([stringInfo.midi + fret]));
                cell.appendChild(markerStack);
            }
            row.appendChild(cell);
        }
        fretboard.appendChild(row);
    });
    drawPatternOutlines();
}

function render() {
    const scaleRoot = Number.parseInt(keySelect.value, 10);
    const scaleKey = scaleSelect.value;
    const isPentatonic = scaleKey.endsWith("Pentatonic");
    patternSelect.disabled = !isPentatonic;
    const patternActive = isPentatonic && patternSelect.value === "pattern";
    patternPositionSelect.disabled = !patternActive;
    blueNoteToggle.disabled = patternActive;
    const includeBlueNote = blueNoteToggle.checked && !patternActive;
    patternHelp.textContent = !isPentatonic ? "Pattern view is available for pentatonic scales." : patternActive
        ? `${scaleKey === "majorPentatonic" ? "3–2" : "2–3"}: play successive scale tones from low E to high e. Dashed outlines mark each complete two-string group. Increase the fret range or practice area if a group is cut off. Blue note is hidden in this view.`
        : "Choose a pattern to trace a path between pentatonic positions.";
    const labelMode = labelModeSelect.value;
    const maxFret = Number.parseInt(fretSelect.value, 10);
    const progressionActive = progressionModeIsActive();
    const showTriad = triadToggle.checked;
    const triadSettings = getCurrentTriadSettings();
    const triadRoot = triadSettings.root;
    const triadQuality = triadSettings.quality;
    const stringSetKey = stringSetSelect.value;
    const inversion = inversionSelect.value;

    triadRootSelect.value = String(triadRoot);
    triadQualitySelect.value = triadQuality;
    const shouldCalculateVoicings = showTriad || progressionActive;
    const allVoicings = shouldCalculateVoicings ? getTriadVoicings(triadRoot, triadQuality, stringSetKey, inversion, maxFret) : [];
    const areaStart = practiceAreaSelect.value === "all" ? null : Number(practiceAreaSelect.value);
    const availableVoicings = allVoicings.filter(v => areaStart === null || v.positions.every(p => p.fret >= areaStart && p.fret <= areaStart + 4))
        .sort((a, b) => getVoicingAverageFret(a) - getVoicingAverageFret(b));
    let recommendedVoicing = null;
    if (progressionActive) {
        recommendedVoicing = chooseNearestVoicing(availableVoicings, progressionSelectedVoicing);
        progressionSelectedVoicing = recommendedVoicing;
    } else {
        progressionSelectedVoicing = null;
    }
    const oldShape = shapeSelect.value;
    shapeSelect.innerHTML = "";
    availableVoicings.forEach((voicing, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        const positions = [...voicing.positions].sort((a, b) => b.stringIndex - a.stringIndex);
        option.textContent = `${STRING_SETS[voicing.setKey].name} · ${INVERSION_NAMES[voicing.inversion]} · frets ${positions.map(p => p.fret).join("–")}`;
        shapeSelect.appendChild(option);
    });
    if (!availableVoicings.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No shapes: widen area or change filters";
        shapeSelect.appendChild(option);
    }
    if (oldShape && Number(oldShape) < availableVoicings.length) shapeSelect.value = oldShape;
    else if (recommendedVoicing) shapeSelect.value = String(availableVoicings.indexOf(recommendedVoicing));
    shapeSelect.disabled = !showTriad || triadViewSelect.value !== "one" || !availableVoicings.length;
    const selectedVoicing = availableVoicings[Number(shapeSelect.value)] || null;
    const displayedVoicings = !showTriad ? [] : triadViewSelect.value === "all" ? availableVoicings : (selectedVoicing ? [selectedVoicing] : []);
    overviewLegend.innerHTML = "";
    document.getElementById("overviewHelp").hidden = !(triadViewSelect.value === "overview" && progressionActive && showTriad);
    if (triadViewSelect.value === "overview" && progressionActive && showTriad) {
        progressionChords.forEach((chord, index) => {
            const item = document.createElement("span");
            const dot = document.createElement("i");
            dot.style.background = overviewColors[index % overviewColors.length];
            item.append(dot, document.createTextNode(chord.label + " "));
            overviewLegend.appendChild(item);
        });
    }
    const notes = getTriadNotes(triadRoot, triadQuality).map(n => NOTE_NAMES[n]).join(", ");
    soloPrompt.textContent = progressionActive
        ? `Try it: play a short phrase, then land on ${notes} over ${progressionChords[progressionIndex].label}. Use Next as the chord changes.${!availableVoicings.length ? " No complete shape fits these filters; widen the practice area or change the string set." : ""}`
        : "Load a progression to practice aiming for its chord tones.";

    renderScaleSummary(scaleRoot, scaleKey, includeBlueNote);
    renderProgressionControls();
    renderTriadSummary(scaleRoot, triadRoot, triadQuality, showTriad, stringSetKey, inversion, displayedVoicings.length, progressionActive);
    renderFretboard(scaleRoot, scaleKey, includeBlueNote, maxFret, labelMode, showTriad, triadRoot, triadQuality, stringSetKey, displayedVoicings);
}

[keySelect, scaleSelect, patternSelect, patternPositionSelect, labelModeSelect, fretSelect, blueNoteToggle, triadToggle, triadRootSelect, triadQualitySelect, stringSetSelect, inversionSelect, practiceAreaSelect, triadViewSelect, shapeSelect]
    .forEach(control => control.addEventListener("change", render));
practiceAreaSelect.addEventListener("change", () => {
    if (practiceAreaSelect.value !== "all") {
        const end = Number(practiceAreaSelect.value) + 4;
        if (Number(fretSelect.value) < end) fretSelect.value = end <= 15 ? "15" : "24";
        render();
    }
});

modeButtons.forEach(button => button.addEventListener("click", () => setMode(button.dataset.mode)));
document.getElementById("playChordButton").addEventListener("click", () => {
    const chord = getCurrentTriadSettings();
    playNotes(TRIADS[chord.quality].intervals.map(interval => 48 + chord.root + interval));
});
progressionToggle.addEventListener("change", () => {
    if (progressionToggle.checked && progressionChords.length === 0) {
        if (!loadProgression()) progressionToggle.checked = false;
        return;
    }
    progressionSelectedVoicing = null;
    render();
});

loadProgressionButton.addEventListener("click", loadProgression);
progressionInput.addEventListener("keydown", event => { if (event.key === "Enter") loadProgression(); });
previousChordButton.addEventListener("click", () => stepProgression(-1));
nextChordButton.addEventListener("click", () => stepProgression(1));

resetButton.addEventListener("click", () => {
    keySelect.value = "7";
    scaleSelect.value = "majorPentatonic";
    patternSelect.value = "all";
    patternPositionSelect.value = "0";
    labelModeSelect.value = "notes";
    fretSelect.value = "12";
    practiceAreaSelect.value = "all";
    triadViewSelect.value = "all";
    blueNoteToggle.checked = false;
    triadToggle.checked = true;
    triadRootSelect.value = "7";
    triadQualitySelect.value = "major";
    stringSetSelect.value = "1-3";
    inversionSelect.value = "all";
    progressionInput.value = "G D Em C";
    progressionToggle.checked = false;
    progressionChords = [];
    progressionIndex = 0;
    progressionSelectedVoicing = null;
    progressionError.hidden = true;
    setMode("explore");
});

setMode("explore");
if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(drawPatternOutlines).observe(fretboard);
} else {
    window.addEventListener("resize", drawPatternOutlines);
}


