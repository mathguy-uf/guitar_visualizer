const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

const INTERVAL_NAMES = ["1", "♭2", "2", "♭3", "3", "4", "♭5", "5", "♭6", "6", "♭7", "7"];

const OPEN_STRINGS = [
    { label: "e", note: 4 },
    { label: "B", note: 11 },
    { label: "G", note: 7 },
    { label: "D", note: 2 },
    { label: "A", note: 9 },
    { label: "E", note: 4 }
];

const SCALES = {
    majorPentatonic: {
        name: "major pentatonic",
        intervals: [0, 2, 4, 7, 9]
    },
    minorPentatonic: {
        name: "minor pentatonic",
        intervals: [0, 3, 5, 7, 10]
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

const keySelect = document.getElementById("keySelect");
const scaleSelect = document.getElementById("scaleSelect");
const labelModeSelect = document.getElementById("labelModeSelect");
const fretSelect = document.getElementById("fretSelect");
const triadToggle = document.getElementById("triadToggle");
const triadRootSelect = document.getElementById("triadRootSelect");
const triadQualitySelect = document.getElementById("triadQualitySelect");
const resetButton = document.getElementById("resetButton");
const scaleTitle = document.getElementById("scaleTitle");
const scaleNotes = document.getElementById("scaleNotes");
const triadSummary = document.getElementById("triadSummary");
const triadTitle = document.getElementById("triadTitle");
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
        const chip = makeSummaryChip(note, root, index === 0 ? "root-chip" : "");
        scaleNotes.appendChild(chip);
    });
}

function renderTriadSummary(scaleRoot, triadRoot, quality, showTriad) {
    triadRootSelect.disabled = !showTriad;
    triadQualitySelect.disabled = !showTriad;
    triadSummary.hidden = !showTriad;

    if (!showTriad) {
        return;
    }

    const triad = TRIADS[quality];
    const notes = getTriadNotes(triadRoot, quality);

    triadTitle.textContent = `${formatKeyName(triadRoot)} ${triad.name} triad`;
    triadNotes.innerHTML = "";

    notes.forEach((note, index) => {
        const extraClass = index === 0 ? "triad-chip triad-root-chip" : "triad-chip";
        triadNotes.appendChild(makeSummaryChip(note, scaleRoot, extraClass));
    });
}

function renderFretboard(scaleRoot, scaleKey, maxFret, labelMode, showTriad, triadRoot, triadQuality) {
    const scaleNoteSet = new Set(getScaleNotes(scaleRoot, scaleKey));
    const triadNoteSet = showTriad ? new Set(getTriadNotes(triadRoot, triadQuality)) : new Set();
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

    OPEN_STRINGS.forEach(stringInfo => {
        const row = document.createElement("div");
        row.className = "fret-row";

        const stringLabel = document.createElement("div");
        stringLabel.className = "string-label";
        stringLabel.textContent = stringInfo.label;
        row.appendChild(stringLabel);

        for (let fret = 0; fret <= maxFret; fret += 1) {
            const note = (stringInfo.note + fret) % 12;
            const inScale = scaleNoteSet.has(note);
            const inTriad = triadNoteSet.has(note);
            const cell = document.createElement("div");
            cell.className = "fret-cell";

            if (markerFrets.has(fret)) {
                cell.classList.add("marker-fret");
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
                    inTriad ? `${TRIADS[triadQuality].name} triad tone` : null
                ].filter(Boolean).join(" + ");

                markerStack.title = `${NOTE_NAMES[note]} · interval ${getIntervalName(note, scaleRoot)} · fret ${fret} · ${layerDescription}`;
                markerStack.setAttribute(
                    "aria-label",
                    `${NOTE_NAMES[note]}, interval ${getIntervalName(note, scaleRoot)}, fret ${fret}, ${layerDescription}`
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

    renderScaleSummary(scaleRoot, scaleKey);
    renderTriadSummary(scaleRoot, triadRoot, triadQuality, showTriad);
    renderFretboard(
        scaleRoot,
        scaleKey,
        maxFret,
        labelMode,
        showTriad,
        triadRoot,
        triadQuality
    );
}

[
    keySelect,
    scaleSelect,
    labelModeSelect,
    fretSelect,
    triadToggle,
    triadRootSelect,
    triadQualitySelect
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
    render();
});

render();
