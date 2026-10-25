# Guitar Visualizer

A mobile-friendly interactive guitar fretboard for learning scales, pentatonics, blues notes, triads, intervals, inversions, chord shapes, and voice leading.

## Version 0.7

Current features include:

- Major and minor pentatonic scales in all 12 keys
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
