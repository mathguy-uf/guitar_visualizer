const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const INTERVAL_NAMES = ["1", "♭2", "2", "♭3", "3", "4", "♭5", "5", "♭6", "6", "♭7", "7"];

// Display order is high e to low E. MIDI values let us determine the
// actual lowest-sounding note of a triad, which determines its inversion.
const OPEN_STRINGS = [
    { number: 1, label: "e", note: 4, midi: 64 },
    { number: 2, label: "B", note: 11, midi: 59 },
    { number: 3, label: "G", note: 7, midi: 55 },
    { number: 4, label: "D", note: 2, midi: 50 },
    { number: 5, label: "A", note: 9, midi: 45 },
    { number: 6, label: "E", note: 4, midi: 40 }
];

const SCALES = {
    majorPentatonic: {
        name: "major pentatonic",
        intervals: [0, 2, 4, 7, 9]
    },
    minorPentatonic: {
        name: "minor pentatonic",
        intervals: [0, 3, 5, 7, 10]
    },
    majorScale: {
        name: "major scale",
        intervals: [0, 2, 4, 5, 7, 9, 11]
    },
    naturalMinor: {
        name: "natural minor",
        intervals: [0, 2, 3, 5, 7, 8, 10]
    }
};

const TRIADS = {
    major: {
        name: "major",
        intervals: [0, 4, 7]
    },
    minor: {
        name: "minor",
        intervals: [0, 3, 7]
    },
    diminished: {
        name: "diminished",
        intervals: [0, 3, 6]
    },
    augmented: {
        name: "augmented",
        intervals: [0, 4, 8]
    }
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

const keySelect = document.getElementById("keySelect");
const scaleSelect = document.getElementById("scaleSelect");
const labelModeSelect = document.getElementById("labelModeSelect");
const fretSelect = document.getElementById("fretSelect");
const triadToggle = document.getElementById("triadToggle");
const triadRootSelect = document.getElementById("triadRootSelect");
const triadQualitySelect = document.getElementById("triadQualitySelect");
const stringSetSelect = document.getElementById("stringSetSelect");
const inversionSelect = document.getElementById("inversionSelect");
const resetButton = document.getElementById("resetButton");
const scaleTitle = document.getElementById("scaleTitle");
const scaleNotes = document.getElementById("scaleNotes");
const triadSummary = document.getElementById("triadSummary");
const triadTitle = document.getElementById("triadTitle");
const triadMeta = document.getElementById("triadMeta");
const triadNotes = document.getElementById("triadNotes");
const fretboard = document.getElementById("fretboard");

function getScaleNotes(root, scaleKey) {
    return SCALES[scaleKey].intervals.map(interval => (root + interval) % 12);
}

function getTriadNotes(root, quality) {
    return TRIADS[quality].intervals.map(interval => (root + interval) % 12);
}

function formatKeyName(noteValue) {
    return NOTE_NAMES[noteValue];
}

function getIntervalName(note, scaleRoot) {
    const distance = (note - scaleRoot + 12) % 12;
    return INTERVAL_NAMES[distance];
}

function getMarkerLabel(note, scaleRoot, labelMode) {
    return labelMode === "intervals"
        ? getIntervalName(note, scaleRoot)
        : NOTE_NAMES[note];
}

function makeSummaryChip(note, scaleRoot, className = "") {
    const chip = document.createElement("span");
    chip.className = `note-chip${className ? ` ${className}` : ""}`;
    chip.textContent = `${NOTE_NAMES[note]} · ${getIntervalName(note, scaleRoot)}`;
    return chip;
}

function renderScaleSummary(root, scaleKey) {
    const scale = SCALES[scaleKey];
    const notes = getScaleNotes(root, scaleKey);

    scaleTitle.textContent = `${formatKeyName(root)} ${scale.name}`;
    scaleNotes.innerHTML = "";

    notes.forEach((note, index) => {
        scaleNotes.appendChild(
            makeSummaryChip(note, root, index === 0 ? "root-chip" : "")
        );
    });
}

function getCandidatePositions(stringIndex, triadNoteSet, maxFret) {
    const stringInfo = OPEN_STRINGS[stringIndex];
    const positions = [];

    for (let fret = 0; fret <= maxFret; fret += 1) {
        const note = (stringInfo.note + fret) % 12;
        if (triadNoteSet.has(note)) {
            positions.push({
                stringIndex,
                fret,
                note,
                midi: stringInfo.midi + fret
            });
        }
    }

    return positions;
}

function classifyInversion(voicing, triadRoot, triadQuality) {
    const intervals = TRIADS[triadQuality].intervals;
    const rootNote = triadRoot;
    const thirdNote = (triadRoot + intervals[1]) % 12;
    const fifthNote = (triadRoot + intervals[2]) % 12;
    const bass = voicing.reduce((lowest, position) =>
        position.midi < lowest.midi ? position : lowest
    );

    if (bass.note === rootNote) return "root";
    if (bass.note === thirdNote) return "first";
    if (bass.note === fifthNote) return "second";
    return "root";
}

function getTriadVoicings(triadRoot, triadQuality, stringSetKey, inversion, maxFret) {
    const triadNotes = getTriadNotes(triadRoot, triadQuality);
    const triadNoteSet = new Set(triadNotes);
    const setKeys = stringSetKey === "all"
        ? Object.keys(STRING_SETS)
        : [stringSetKey];
    const voicings = [];

    setKeys.forEach(setKey => {
        const stringIndices = STRING_SETS[setKey].indices;
        const candidates = stringIndices.map(index =>
            getCandidatePositions(index, triadNoteSet, maxFret)
        );

        candidates[0].forEach(first => {
            candidates[1].forEach(second => {
                candidates[2].forEach(third => {
                    const voicing = [first, second, third];
                    const noteSet = new Set(voicing.map(position => position.note));

                    // A triad voicing must contain all three chord tones once.
                    if (noteSet.size !== 3 || triadNotes.some(note => !noteSet.has(note))) {
                        return;
                    }

                    // Keep the displayed shapes compact enough to be practical on guitar.
                    const frets = voicing.map(position => position.fret);
                    if (Math.max(...frets) - Math.min(...frets) > 4) {
                        return;
                    }

                    const voicingInversion = classifyInversion(
                        voicing,
                        triadRoot,
                        triadQuality
                    );

                    if (inversion !== "all" && voicingInversion !== inversion) {
                        return;
                    }

                    voicings.push({
                        setKey,
                        inversion: voicingInversion,
                        positions: voicing
                    });
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
            if (!map.has(key)) {
                map.set(key, {
                    note: position.note,
                    voicingIndices: []
                });
            }
            map.get(key).voicingIndices.push(voicingIndex);
        });
    });

    return map;
}

function renderTriadSummary(
    scaleRoot,
    triadRoot,
    quality,
    showTriad,
    stringSetKey,
    inversion,
    voicingCount
) {
    [
        triadRootSelect,
        triadQualitySelect,
        stringSetSelect,
        inversionSelect
    ].forEach(control => {
        control.disabled = !showTriad;
    });

    triadSummary.hidden = !showTriad;

    if (!showTriad) {
        return;
    }

    const triad = TRIADS[quality];
    const notes = getTriadNotes(triadRoot, quality);
    const stringSetName = stringSetKey === "all"
        ? "All string sets"
        : STRING_SETS[stringSetKey].name;
    const voicingWord = voicingCount === 1 ? "voicing" : "voicings";

    triadTitle.textContent = `${formatKeyName(triadRoot)} ${triad.name} triad`;
    triadMeta.textContent = `${stringSetName} · ${INVERSION_NAMES[inversion]} · ${voicingCount} ${voicingWord}`;
    triadNotes.innerHTML = "";

    notes.forEach((note, index) => {
        const extraClass = index === 0
            ? "triad-chip triad-root-chip"
            : "triad-chip";
        triadNotes.appendChild(makeSummaryChip(note, scaleRoot, extraClass));
    });
}

function renderFretboard(
    scaleRoot,
    scaleKey,
    maxFret,
    labelMode,
    showTriad,
    triadRoot,
    triadQuality,
    stringSetKey,
    voicings
) {
    const scaleNoteSet = new Set(getScaleNotes(scaleRoot, scaleKey));
    const triadPositionMap = showTriad ? getTriadPositionMap(voicings) : new Map();
    const selectedStringIndices = showTriad && stringSetKey !== "all"
        ? new Set(STRING_SETS[stringSetKey].indices)
        : new Set();
    const fretCount = maxFret + 1;
    const markerFrets = new Set([3, 5, 7, 9, 12, 15, 17, 19, 21, 24]);

    fretboard.style.setProperty("--fret-count", fretCount);
    fretboard.innerHTML = "";

    const numberRow = document.createElement("div");
    numberRow.className = "fret-number-row";

    const numberLabel = document.createElement("div");
    numberLabel.className = "string-label";
    numberLabel.textContent = "";
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

        if (selectedStringIndices.has(stringIndex)) {
            row.classList.add("selected-string-row");
        }

        const stringLabel = document.createElement("div");
        stringLabel.className = "string-label";
        stringLabel.innerHTML = `<span class="string-number">${stringInfo.number}</span><span>${stringInfo.label}</span>`;
        row.appendChild(stringLabel);

        for (let fret = 0; fret <= maxFret; fret += 1) {
            const note = (stringInfo.note + fret) % 12;
            const inScale = scaleNoteSet.has(note);
            const positionKey = `${stringIndex}:${fret}`;
            const triadPosition = triadPositionMap.get(positionKey);
            const inTriad = Boolean(triadPosition);
            const cell = document.createElement("div");
            cell.className = "fret-cell";

            if (markerFrets.has(fret)) {
                cell.classList.add("marker-fret");
            }

            if (selectedStringIndices.has(stringIndex)) {
                cell.classList.add("selected-triad-string");
            }

            if (inScale || inTriad) {
                const markerStack = document.createElement("span");
                markerStack.className = "marker-stack";

                if (!inScale && inTriad) {
                    markerStack.classList.add("triad-only");
                }

                if (labelMode === "intervals") {
                    markerStack.classList.add("interval-mode");
                }

                if (inScale) {
                    const scaleMarker = document.createElement("span");
                    scaleMarker.className = "scale-marker";

                    if (note === scaleRoot) {
                        scaleMarker.classList.add("root-note");
                    }

                    markerStack.appendChild(scaleMarker);
                }

                if (inTriad) {
                    const triadMarker = document.createElement("span");
                    triadMarker.className = "triad-marker";

                    if (note === triadRoot) {
                        triadMarker.classList.add("triad-root-note");
                    }

                    markerStack.appendChild(triadMarker);
                }

                const label = document.createElement("span");
                label.className = "marker-label";
                label.textContent = getMarkerLabel(note, scaleRoot, labelMode);
                markerStack.appendChild(label);

                const layerDescription = [
                    inScale ? `${SCALES[scaleKey].name} tone` : null,
                    inTriad ? `${TRIADS[triadQuality].name} triad voicing tone` : null
                ].filter(Boolean).join(" + ");

                markerStack.title = `${NOTE_NAMES[note]} · interval ${getIntervalName(note, scaleRoot)} · string ${stringInfo.number} · fret ${fret} · ${layerDescription}`;
                markerStack.setAttribute(
                    "aria-label",
                    `${NOTE_NAMES[note]}, interval ${getIntervalName(note, scaleRoot)}, string ${stringInfo.number}, fret ${fret}, ${layerDescription}`
                );

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
    const labelMode = labelModeSelect.value;
    const maxFret = Number.parseInt(fretSelect.value, 10);
    const showTriad = triadToggle.checked;
    const triadRoot = Number.parseInt(triadRootSelect.value, 10);
    const triadQuality = triadQualitySelect.value;
    const stringSetKey = stringSetSelect.value;
    const inversion = inversionSelect.value;

    const voicings = showTriad
        ? getTriadVoicings(
            triadRoot,
            triadQuality,
            stringSetKey,
            inversion,
            maxFret
        )
        : [];

    renderScaleSummary(scaleRoot, scaleKey);
    renderTriadSummary(
        scaleRoot,
        triadRoot,
        triadQuality,
        showTriad,
        stringSetKey,
        inversion,
        voicings.length
    );
    renderFretboard(
        scaleRoot,
        scaleKey,
        maxFret,
        labelMode,
        showTriad,
        triadRoot,
        triadQuality,
        stringSetKey,
        voicings
    );
}

[
    keySelect,
    scaleSelect,
    labelModeSelect,
    fretSelect,
    triadToggle,
    triadRootSelect,
    triadQualitySelect,
    stringSetSelect,
    inversionSelect
].forEach(control => {
    control.addEventListener("change", render);
});

resetButton.addEventListener("click", () => {
    keySelect.value = "7";
    scaleSelect.value = "majorPentatonic";
    labelModeSelect.value = "notes";
    fretSelect.value = "12";
    triadToggle.checked = true;
    triadRootSelect.value = "7";
    triadQualitySelect.value = "major";
    stringSetSelect.value = "1-3";
    inversionSelect.value = "all";
    render();
});

render();
