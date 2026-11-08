# E major in thirds

Open **Learn → E major thirds**. The existing explorer and its key, scale, mode, triad and progression settings remain independent. No microphone is used by this lesson. Tap **Hear two notes** for the double-stop or **Hear this voicing** for its additional chord tones (short synthesized previews).

## Teaching choices

- Vertical scale map uses low E at left, high e at right, nut at top, traditional inlays, and note markers between fret wires. The side numbers are frets; the marker labels are pitch names, not fretting fingers.
- O means an open string in the selected voicing, X means skip, and a blank means that string is fretted. The complete map shows other pairs for context; it is not a strumming diagram. Gold identifies selected open chord tones and additional fretted notes. D scale tones are blue; G harmonizing tones are cream. Green/purple dashed outlines describe the interval separately from the chord quality.
- Begin with E–G♯ at D2/G1, pluck together with thumb/index, then use the one-bar eighth-note roll. Picking-hand letters use P/I/M/A; TAB has high e at top, 0 for an open string, and 1 & 2 & 3 & 4 & above evenly spaced attacks. This is an arpeggio exercise, not a strict banjo roll or Travis-picking exercise.
- Open E, A and B are in the key but are not universally stable over every chord. Available open chord tones, extensions, potential clashes, occupied strings, and bass changes are explained in expandable guidance. Open D/G are chromatic and cannot also ring open on the fretted D/G strings.
- Minor third G♯–B can supply the third/fifth of E major; minor third D♯–F♯ can supply the third/fifth of B major. Interval quality and full chord quality must not be conflated.
- B7 with open A is B7/A; D♯ diminished with open A is D♯dim/A; C♯m7 without its fifth and with open B is C♯m7/B (no fifth). F♯m7 uses high open E to preserve F♯ as bass. Aadd9 retains the third and contains no seventh. Added 11ths are not labeled sus4 while the third remains.
- The requested high-e-fret-2 F♯ for B and high-e-fret-4 G♯ for C♯m are shown as theoretical recipes with stretch warnings. Playable voicings use the identical pitches on B7/B9 respectively, within two frets of the pair. F♯ minor uses B2 for its C♯ fifth.
- Previous/Next changes the voicing's TAB together with its pair; no universal drone is silently carried across every chord. The selectable progression resets a restrictive quality filter to reveal its chord.

## References checked

- [Fender: How to Read a Chord Chart](https://www.fender.com/articles/chords/how-to-read-a-chord-chart): orientation, nut, fretting-hand numbers and O/X conventions.
- [Fender: What is PIMA?](https://www.fender.com/articles/techniques/what-is-pima): picking-hand letters and optional pinky anchoring.
- [Yamaha / Robbie Calvo: How To Play Guitar Double-Stops](https://hub.yamaha.com/guitars/g-how-to/how-to-play-guitar-double-stops/): two-note fragments, major-scale thirds, chord relationships, G–B tuning exception.
- [Acoustic Guitar / Mac Randall: The Care and Feeding of the Picking Hand](https://acousticguitar.com/the-care-and-feeding-of-the-picking-hand/): common thumb E/A/D, index G, middle B, ring e allocation.
- [JustinGuitar: Folk Fingerstyle](https://www.justinguitar.com/modules/folk-fingerstyle): begin with a simple pattern, then connect chord/scale relationships and expand.

## Implementation and verification

`js/thirds.js` contains tuning, authored pairs, chord recipes, open-string advice, progressions and picking events. It exports the same data to the browser and Node. `js/thirds-lesson.js` renders an isolated SVG lesson; `thirds.css` scopes its styling. There are no new dependencies and no changes to audio capture or scoring.

Run `node --test tests/*.test.cjs`. The new tests independently verify standard-tuning pitches, semitone intervals, chord pitch sets and basses, feasible hand spans, physical string exclusivity, drone restrictions, complete progression chords, and picking voice/finger assignments.

Phone layouts were checked in browser frames at 390 × 844 and 844 × 390. This checks responsive layout and interactions, not real iOS Safari audio or microphone hardware. The diagram scrolls vertically within the card on small screens; the TAB scrolls horizontally to keep fret numbers legible.

Game integration is a future extension. The lesson does not register exercises or change game state.
