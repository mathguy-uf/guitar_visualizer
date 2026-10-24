# Guitar Visualizer

A mobile-friendly interactive guitar fretboard for learning scales, pentatonics, triads, intervals, inversions, chord shapes, and voice leading.

## Version 0.6

Current features include:

- Major and minor pentatonic scales in all 12 keys
- Full major and natural minor scales in all 12 keys
- Note-name or scale-interval marker labels
- Interval labels measured from the selected scale root (`1`)
- Solid primary scale layer with a translucent secondary triad layer
- Larger translucent halo when a scale tone and triad tone overlap
- Major, minor, diminished, and augmented triads
- Real three-string triad voicings rather than every chord tone on the neck
- Selectable string sets: 1–3, 2–4, 3–5, 4–6, or all sets
- Root-position, first-inversion, second-inversion, or all-inversion filters
- Chord progression mode with Previous and Next controls
- Progression input such as `G D Em C`, with spaces, commas, or arrows
- Clickable progression chord buttons
- Automatic nearest-voicing selection to reduce hand movement between chords
- Triad tones outside the primary scale remain visible
- 12, 15, or 24 fret views
- Phone-first portrait layout with compact two-column controls
- Landscape playing view with a wider fretboard and reduced screen clutter
- Horizontal fretboard scrolling on narrow screens
- iPhone safe-area support and touch-friendly controls

## Layer model

The fretboard uses two visual layers:

1. **Primary layer:** the selected pentatonic, major, or natural-minor scale, shown as solid markers.
2. **Secondary layer:** optional translucent three-string triad voicings.

When the two layers occupy the same fret/string position, the translucent secondary marker becomes larger so it remains visible as a halo around the primary marker.

## Chord progression mode

Enter a progression such as:

```text
G D Em C
```

Then load the progression and use **Previous** or **Next**. The scale stays fixed as the primary layer while the secondary layer changes to the current chord.

The app chooses one available triad voicing for each chord. After the first chord, it scores the available shapes against the previous shape and recommends the one requiring the least fret movement. The selected string-set and inversion filters still apply.

Supported triad notation includes examples such as `G`, `Em`, `B♭`, `F♯m`, `C°`, and `A+`.

## Mobile layout

In portrait orientation, controls are condensed into a two-column phone layout and the fretboard remains horizontally scrollable.

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
