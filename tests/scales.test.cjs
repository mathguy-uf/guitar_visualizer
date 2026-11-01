const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Load production music helpers without starting the browser UI or audio.
function fixture() {
    const source = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");
    const summary = { children: [], set innerHTML(value) { this.children = []; }, appendChild(child) { this.children.push(child); } };
    const context = {
        document: { createElement() { return {}; } },
        scaleNotes: summary, scaleTitle: {}, scaleModeInfo: {}, blueNoteLabel: {}
    };
    vm.createContext(context);
    vm.runInContext(source.slice(0, source.indexOf("const keySelect")) +
        source.slice(source.indexOf("function getBlueNoteInterval"), source.indexOf("function getCandidatePositions")), context);
    return context;
}

const modeKeys = ["majorScale", "dorian", "phrygian", "lydian", "mixolydian", "naturalMinor", "locrian"];

test("all seven modes are rotations of their parent major scale in every key", () => {
    const app = fixture();
    const cMajor = [0, 2, 4, 5, 7, 9, 11];
    for (let transpose = 0; transpose < 12; transpose++) {
        modeKeys.forEach((key, degree) => {
            const root = (cMajor[degree] + transpose) % 12;
            const expected = [...cMajor.slice(degree), ...cMajor.slice(0, degree)].map(note => (note + transpose) % 12);
            assert.deepEqual(Array.from(app.getScaleNotes(root, key)), expected, `${key}, tonic ${root}`);
        });
    }
});

test("musical spelling distinguishes Lydian's raised fourth from Locrian's flat fifth", () => {
    const app = fixture();
    assert.equal(app.getMarkerLabel(1, 7, "intervals", false, "lydian"), "♯4");
    assert.equal(app.getMarkerLabel(1, 7, "notes", false, "lydian"), "C♯");
    assert.equal(app.getMarkerLabel(1, 7, "intervals", false, "locrian"), "♭5");
    assert.equal(app.getMarkerLabel(1, 7, "notes", false, "locrian"), "D♭");
    assert.equal(app.getIntervalName(1, 7), "♭5", "generic chord labels remain chord-relative");
    assert.equal(app.getScaleNoteName(0, 1, "majorScale"), "B♯");
    assert.equal(app.getScaleNoteName(2, 6, "locrian"), "D");
});

test("each modal spelling uses all seven letters and matches the sounded pitch", () => {
    const app = fixture();
    const naturalPitch = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    for (let root = 0; root < 12; root++) {
        for (const key of modeKeys) {
            const notes = Array.from(app.getScaleNotes(root, key));
            const spellings = notes.map(note => app.getScaleNoteName(note, root, key));
            assert.equal(new Set(spellings.map(name => name[0])).size, 7, `${root} ${key}`);
            spellings.forEach((name, index) => {
                const accidental = Array.from(name.slice(1)).reduce((sum, symbol) => sum + (symbol === "♯" ? 1 : -1), 0);
                assert.equal((naturalPitch[name[0]] + accidental + 12) % 12, notes[index]);
            });
        }
    }
});

test("parent keys describe the selected tonic rather than changing it", () => {
    const app = fixture();
    assert.equal(app.getModeInfo(9, "dorian"), "Mode 2 of G major · Minor with a natural 6th. Treat A as home.");
    assert.match(app.getModeInfo(7, "lydian"), /^Mode 4 of D major/);
    assert.match(app.getModeInfo(11, "locrian"), /^Mode 7 of C major/);
    assert.match(app.getModeInfo(1, "dorian"), /^Mode 2 of B major/);
    assert.match(app.getModeInfo(1, "majorScale"), /^Mode 1 of C♯ major/);
    assert.equal(app.getModeInfo(7, "majorPentatonic"), "");
});

test("modal summaries show the correct names, formulas, and blue-note membership", () => {
    const app = fixture();
    app.renderScaleSummary(9, "dorian", false);
    assert.deepEqual(app.scaleNotes.children.map(chip => chip.textContent),
        ["A · 1", "B · 2", "C · ♭3", "D · 4", "E · 5", "F♯ · 6", "G · ♭7"]);
    assert.equal(app.scaleTitle.textContent, "A Dorian");
    assert.equal(app.scaleModeInfo.hidden, false);
    app.renderScaleSummary(7, "lydian", false);
    assert.ok(app.scaleNotes.children.some(chip => chip.textContent === "C♯ · ♯4"));
    app.renderScaleSummary(7, "locrian", false);
    assert.equal(app.scaleNotes.children.length, 7);
    assert.ok(app.scaleNotes.children.some(chip => chip.textContent === "D♭ · ♭5" && !chip.className.includes("blue-note")));
    assert.equal(app.blueNoteLabel.textContent, "Blue note · ♭5 (in scale)");
    assert.equal(app.getScaleNotes(7, "locrian", true).length, 7, "existing flat fifth is never duplicated");
    app.renderScaleSummary(7, "minorPentatonic", true);
    assert.equal(app.scaleModeInfo.hidden, true);
    assert.ok(app.scaleNotes.children.some(chip => chip.textContent === "D♭ · ♭5" && chip.className.includes("blue-note")));
});

test("the phone's scale menu includes every mode once and keeps both pentatonics", () => {
    const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
    const menu = html.match(/<select id="scaleSelect"[\s\S]*?<\/select>/)[0];
    for (const key of [...modeKeys, "majorPentatonic", "minorPentatonic"]) {
        assert.equal((menu.match(new RegExp(`value="${key}"`, "g")) || []).length, 1, key);
    }
    assert.match(menu, /optgroup label="Diatonic modes · 7 notes"/);
});
