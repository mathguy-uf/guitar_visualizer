const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

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

const keySelect = document.getElementById("keySelect");
const scaleSelect = document.getElementById("scaleSelect");
const fretSelect = document.getElementById("fretSelect");
const noteNameToggle = document.getElementById("noteNameToggle");
const resetButton = document.getElementById("resetButton");
const scaleTitle = document.getElementById("scaleTitle");
const scaleNotes = document.getElementById("scaleNotes");
const fretboard = document.getElementById("fretboard");

function getScaleNotes(root, scaleKey) {
    return SCALES[scaleKey].intervals.map(interval => (root + interval) % 12);
}

function formatKeyName(noteValue) {
    return NOTE_NAMES[noteValue];
}

function renderScaleSummary(root, scaleKey) {
    const scale = SCALES[scaleKey];
    const notes = getScaleNotes(root, scaleKey);

    scaleTitle.textContent = `${formatKeyName(root)} ${scale.name}`;
    scaleNotes.innerHTML = "";

    notes.forEach((note, index) => {
        const chip = document.createElement("span");
        chip.className = `note-chip${index === 0 ? " root-chip" : ""}`;
        chip.textContent = NOTE_NAMES[note];
        scaleNotes.appendChild(chip);
    });
}

function renderFretboard(root, scaleKey, maxFret, showNames) {
    const notesInScale = new Set(getScaleNotes(root, scaleKey));
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
            const cell = document.createElement("div");
            cell.className = "fret-cell";

            if (markerFrets.has(fret)) {
                cell.classList.add("marker-fret");
            }

            if (notesInScale.has(note)) {
                const marker = document.createElement("span");
                marker.className = "note-marker";
                marker.textContent = NOTE_NAMES[note];
                marker.title = `${NOTE_NAMES[note]} · fret ${fret}`;

                if (note === root) {
                    marker.classList.add("root-note");
                }

                if (!showNames) {
                    marker.classList.add("note-hidden");
                    marker.setAttribute("aria-label", NOTE_NAMES[note]);
                }

                cell.appendChild(marker);
            }

            row.appendChild(cell);
        }

        fretboard.appendChild(row);
    });
}

function render() {
    const root = Number.parseInt(keySelect.value, 10);
    const scaleKey = scaleSelect.value;
    const maxFret = Number.parseInt(fretSelect.value, 10);
    const showNames = noteNameToggle.checked;

    renderScaleSummary(root, scaleKey);
    renderFretboard(root, scaleKey, maxFret, showNames);
}

[keySelect, scaleSelect, fretSelect, noteNameToggle].forEach(control => {
    control.addEventListener("change", render);
});

resetButton.addEventListener("click", () => {
    keySelect.value = "7";
    scaleSelect.value = "majorPentatonic";
    fretSelect.value = "12";
    noteNameToggle.checked = true;
    render();
});

render();
