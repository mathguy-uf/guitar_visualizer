# Guitar Visualizer

A mobile-friendly interactive guitar fretboard for learning scales, pentatonics, blues notes, triads, intervals, inversions, chord shapes, and voice leading.

## Version 0.13

Current features include:

- Metronome with adjustable 40–240 BPM, 2/4, 3/4, 4/4, and 6/8; even or triplet subdivisions and individually selectable clicks
- Microphone guitar tuner for standard tuning and Drop D, with automatic or manual string selection
- Explore, Learn triads, and Solo practice modes with collapsible settings
- Select one triad shape, all shapes of the current chord, or a progression chord-tone overview
- Chord-relative interval labels, alongside note names and scale intervals
- A selectable five-position practice area and prompts for targeting chord tones
- Tap displayed notes or play the current chord to hear synthesized audio
- Major and minor pentatonic scales in all 12 keys
- Selectable 3–2 major and 2–3 minor pentatonic paths, starting at a low-E root
- Full major and natural minor scales in all 12 keys
- Optional blue-note control on the primary layer
- Major-family blue note: `♭3`
- Minor-family blue note: `♭5`
- Distinct cyan dashed marker for the blue note
- Flat spelling for blue notes where appropriate, such as `D♭` rather than `C♯`
- Note-name or scale-interval marker labels
- Interval labels measured from the selected scale root (`1`)
- Solid primary scale layer with a translucent secondary triad layer
- Larger translucent halo when a primary tone and triad tone overlap
- Major, minor, diminished, and augmented triads
- Real three-string triad voicings rather than every chord tone on the neck
- Selectable string sets: 1–3, 2–4, 3–5, 4–6, or all sets
- Root-position, first-inversion, second-inversion, or all-inversion filters
- Chord progression mode with Previous and Next controls
- Progression input such as `G D Em C`, with spaces, commas, or arrows
- Clickable progression chord buttons
- Automatic nearest-voicing selection to reduce hand movement between chords
- Independent secondary-layer visibility while progression mode is active
- 12, 15, or 24 fret views
- Phone-first portrait layout with compact controls
- Landscape playing view with a wider fretboard and reduced screen clutter
- Horizontal fretboard scrolling on narrow screens
- iPhone safe-area support and touch-friendly controls

## Pentatonic 3–2 / 2–3 paths

Choose a major or minor pentatonic scale, then select **3–2 major / 2–3 minor** under Pentatonic view. The path begins at the selected root on the low E string. The major version plays three successive scale tones on the first string and two on the next, repeating across the neck; the minor version uses two, then three. The pattern follows standard tuning, including the B string shift.

For example, G major begins at low E frets 3–5–7, then A frets 5–7. A minor begins at low E frets 5–8, then A frets 5–7–10. Choose the next low E root to move the path up an octave. Notes beyond the selected fret range are not shown; select a larger range when needed. The blue note is temporarily hidden in this view, while the triad overlay remains independent. Return to **All scale notes** for the complete scale.

Each complete two-string group has a dashed outline. If the current fret range or practice area cuts off any notes in a group, its outline is omitted until the whole group is visible.

## Learning and solo practice

Use **Explore**, **Learn triads**, or **Solo practice** to set up a starting view. Open **Scale & triad settings** for key, scale, labels, practice area, string set, inversion, and shape controls. A practice area limits the visible notes and requires complete triad shapes to fit within it. Expand the area or change the string set if no shapes appear.

In Solo practice, load a progression, then use its chord buttons or Previous and Next. The prompt suggests chord tones to target. Choose **Chord intervals** for labels measured from the current chord root; other notes are also labeled by their interval from that root. **Choose one shape** shows a selectable voicing; **All shapes of current chord** shows all matching voicings. **Progression chord-tone overview** adds colored dots for every chord tone across the displayed area, including tones outside the selected scale. Dots indicate note membership, not simultaneous playable shapes. The legend identifies each chord; colors repeat if there are more than eight entries.

Tap a displayed fretboard marker to hear its pitch, or tap **Hear current chord** to hear a synthesized arpeggio. Audio begins only after a tap and uses the browser's Web Audio support. The app does not provide a backing track.

## Metronome

Open **Metronome**, choose a meter, tempo, and subdivision, then press **Start**. Tap any numbered beat or subdivision to enable or mute that individual click. Gold indicates enabled clicks; a teal outline tracks the current count. The two checkboxes select or clear all numbered beats or all subdivisions; a partial check indicates a mixed selection. New even patterns start with numbered beats on and subdivisions off; new triplet patterns start with all counts on. Choices for each meter and subdivision are remembered while the page remains open.

**Even** counts “1 &”; **Triplets** counts “1 trip let,” with three equal parts per pulse. Beat 1 is accented; in 6/8, pulses 1 and 4 are accented. In 2/4, 3/4, and 4/4, BPM counts quarter notes. In 6/8, BPM counts eighth-note pulses, so triplets divide each eighth-note pulse into three. Tempo can be adjusted while playing; changing meter or subdivision restarts the count. **Stop** silences metronome clicks without stopping the fretboard's note sounds. Browser background throttling or device sleep may interrupt timing.

## Guitar tuner

Open **Guitar tuner**, select **Standard** (E2 A2 D3 G3 B3 E4) or **Drop D** (D2 A2 D3 G3 B3 E4), then tap **Start tuner** and allow microphone access. Pluck one open string at a time. Automatic mode finds the closest open-string target; select a specific string when you prefer to tune against a fixed target.

**Practice** uses a forgiving ±10-cent in-tune window; **Fine** uses ±5 cents. The reading panel turns green with a short confirmation glow when in tune; amber means close and the text explains whether to tighten or loosen. A two-cent exit margin prevents flicker near the boundary. The green region on the meter shows the selected tolerance. Reduced-motion preferences disable the glow animation.

The detector analyzes approximately every 75 ms and accepts quieter notes while rejecting unclear/noisy input. A short three-reading median reduces jitter without locking the needle; after a gap or a string change the new pitch starts a fresh history. After 300 ms without a clear pitch, the old reading dims and loses its green confirmation. It remains visible for up to four seconds, labeled **Last reading**, so it cannot be mistaken for a live measurement. A fresh pluck updates immediately. Changing the string, tuning, or tolerance clears the held reading.

Tap **Stop tuner** or close the tuner to stop microphone capture. A quiet room helps; use headphones or stop the metronome while tuning. This feature requires microphone permission and HTTPS (or localhost).

### Tuner design references and checks

The feedback and stabilization design was compared with [Trace Tuner](https://github.com/Fannon/trace-tuner) (roughly ±10-cent green zone and sustained-note tracking), [pyymenta/tuner](https://github.com/pyymenta/tuner) (smoothing and pitch-clarity gating), and [Ukulele Companion's tuner](https://github.com/baijum/ukulele-companion/blob/main/iosApp/UkuleleCompanion/ViewModels/TunerViewModel.swift) (median smoothing and string-aware reset behavior). These are references; the tuner remains dependency-free.

Run the tuner regression checks with Node.js:

```sh
node --test tests/tuner.test.cjs
```

The tests cover synthetic quiet/decaying standard and Drop D notes at 44.1/48 kHz, noise rejection, pitch adjustments, tolerance settings, held/live feedback, and reset behavior. Real microphone performance still depends on the device and room.

## Blue note

The **Blue note** switch is part of the primary layer.

For major-family scales, it adds the `♭3`. For example, G major pentatonic becomes:

```text
G A B♭ B D E
1 2 ♭3 3 5 6
```

For minor-family scales, it adds the classic `♭5`. For example, G minor pentatonic becomes:

```text
G B♭ C D♭ D F
1 ♭3 4 ♭5 5 ♭7
```

The blue note is shown with a cyan dashed marker so it remains visually distinct from ordinary scale tones and from the translucent purple triad layer.

## Layer model

The fretboard uses two visual layers:

1. **Primary layer:** the selected pentatonic, major, or natural-minor scale, optionally including the blue note.
2. **Secondary layer:** optional translucent three-string triad voicings.

When the two layers occupy the same fret/string position, the translucent secondary marker becomes larger so it remains visible as a halo around the primary marker.

## Chord progression mode

Enter a progression such as:

```text
G D Em C
```

Then load the progression and use **Previous** or **Next**. Progression mode determines which chord is current, while the **Secondary → Show** switch independently controls whether that chord voicing is visible.

The app continues calculating the recommended voicing even while the secondary layer is hidden, so voice-leading continuity is preserved when the overlay is shown again.

Supported triad notation includes examples such as `G`, `Em`, `B♭`, `F♯m`, `C°`, and `A+`.

## Mobile layout

In portrait orientation, controls are condensed into a phone-friendly layout and the fretboard remains horizontally scrollable.

Turn the phone sideways to switch automatically into the landscape playing layout. The interface reduces descriptive text and summary detail, widens the fretboard cells, and gives the neck more of the available screen.

## Run locally

Open `index.html` in a browser.

## Publish with GitHub Pages

In the repository, open **Settings → Pages** and choose:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`

## Possible next features

- Click or tap a triad shape to isolate it
- Chord-relative interval labels
- Tap notes or triads to hear them
- Saved/shareable practice views
- Practice/game mode
- Custom fretboard patterns

## License

MIT License





