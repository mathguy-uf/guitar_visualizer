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

let progressionChords = [];
let progressionIndex = 0;
let progressionSelectedVoicing = null;

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
        chip.addEventListener("click", () => { progressionIndex = index; render(); });
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
    triadMeta.textContent = progressionActive
        ? `${stringSetName} · ${INVERSION_NAMES[inversion]} · ${voicingCount} recommended ${voicingWord}`
        : `${stringSetName} · ${INVERSION_NAMES[inversion]} · ${voicingCount} ${voicingWord}`;
    triadNotes.innerHTML = "";
    notes.forEach((note, index) => {
        triadNotes.appendChild(makeSummaryChip(note, scaleRoot, index === 0 ? "triad-chip triad-root-chip" : "triad-chip"));
    });
}

function renderFretboard(scaleRoot, scaleKey, includeBlueNote, maxFret, labelMode, showTriad, triadRoot, triadQuality, stringSetKey, voicings) {
    const baseScaleNoteSet = new Set(getScaleNotes(scaleRoot, scaleKey, false));
    const primaryNoteSet = new Set(getScaleNotes(scaleRoot, scaleKey, includeBlueNote));
    const blue = getBlueNoteInfo(scaleRoot, scaleKey);
    const triadPositionMap = showTriad ? getTriadPositionMap(voicings) : new Map();
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
            const inPrimary = primaryNoteSet.has(note);
            const inBaseScale = baseScaleNoteSet.has(note);
            const isBlueNote = includeBlueNote && note === blue.note && !inBaseScale;
            const inTriad = triadPositionMap.has(`${stringIndex}:${fret}`);
            const cell = document.createElement("div");
            cell.className = "fret-cell";
            if (markerFrets.has(fret)) cell.classList.add("marker-fret");
            if (selectedStringIndices.has(stringIndex)) cell.classList.add("selected-triad-string");

            if (inPrimary || inTriad) {
                const markerStack = document.createElement("span");
                markerStack.className = "marker-stack";
                if (!inPrimary && inTriad) markerStack.classList.add("triad-only");
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
                label.textContent = getMarkerLabel(note, scaleRoot, labelMode, isBlueNote);
                markerStack.appendChild(label);

                const layerDescription = [
                    isBlueNote ? `blue note ${blue.intervalName}` : (inPrimary ? `${SCALES[scaleKey].name} tone` : null),
                    inTriad ? `${TRIADS[triadQuality].name} triad voicing tone` : null
                ].filter(Boolean).join(" + ");
                const displayNote = isBlueNote ? FLAT_NOTE_NAMES[note] : NOTE_NAMES[note];
                markerStack.title = `${displayNote} · interval ${getIntervalName(note, scaleRoot)} · string ${stringInfo.number} · fret ${fret} · ${layerDescription}`;
                markerStack.setAttribute("aria-label", `${displayNote}, interval ${getIntervalName(note, scaleRoot)}, string ${stringInfo.number}, fret ${fret}, ${layerDescription}`);
                cell.appendChild(markerStack);
            }
            row.appendChild(cell);
        }
        fretboard.appendChild(row);
    });
}

function render() {
    const scaleRoot = Number.parseInt(keySelect.value, 10);
    const scaleKey = scaleSelect.value;
    const includeBlueNote = blueNoteToggle.checked;
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
    let recommendedVoicing = null;
    if (progressionActive) {
        recommendedVoicing = chooseNearestVoicing(allVoicings, progressionSelectedVoicing);
        progressionSelectedVoicing = recommendedVoicing;
    } else {
        progressionSelectedVoicing = null;
    }
    const displayedVoicings = !showTriad ? [] : progressionActive ? (recommendedVoicing ? [recommendedVoicing] : []) : allVoicings;

    renderScaleSummary(scaleRoot, scaleKey, includeBlueNote);
    renderProgressionControls();
    renderTriadSummary(scaleRoot, triadRoot, triadQuality, showTriad, stringSetKey, inversion, displayedVoicings.length, progressionActive);
    renderFretboard(scaleRoot, scaleKey, includeBlueNote, maxFret, labelMode, showTriad, triadRoot, triadQuality, stringSetKey, displayedVoicings);
}

[keySelect, scaleSelect, labelModeSelect, fretSelect, blueNoteToggle, triadToggle, triadRootSelect, triadQualitySelect, stringSetSelect, inversionSelect]
    .forEach(control => control.addEventListener("change", render));

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
    labelModeSelect.value = "notes";
    fretSelect.value = "12";
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
    render();
});

render();
