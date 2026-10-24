# Guitar Visualizer

A mobile-friendly interactive guitar fretboard for learning scales, pentatonics, triads, intervals, inversions, and chord shapes.

## Version 0.3

Current features include:

- Major pentatonic scales in all 12 keys
- Minor pentatonic scales in all 12 keys
- Full major scales in all 12 keys
- Full natural minor scales in all 12 keys
- Note-name or scale-interval marker labels
- Interval labels measured from the selected scale root (`1`)
- Translucent triad overlay layer
- Major, minor, diminished, and augmented triads
- Real three-string triad voicings rather than every chord tone on the neck
- Selectable string sets: 1–3, 2–4, 3–5, 4–6, or all sets
- Root-position, first-inversion, second-inversion, or all-inversion filters
- Voicing count for the selected fret range
- Triad tones outside the primary scale remain visible
- 12, 15, or 24 fret views
- Root-note highlighting
- Responsive portrait and landscape layouts for phones
- Horizontal fretboard scrolling on narrow screens

## Layer model

The fretboard uses two visual layers:

1. **Primary layer:** the selected pentatonic, major, or natural-minor scale.
2. **Overlay layer:** optional translucent three-string triad voicings.

The overlay can be restricted to a particular adjacent three-string set and inversion. This makes it possible to follow a chord through root position, first inversion, and second inversion while keeping the larger scale visible underneath.

## Run locally

Open `index.html` in a browser.

## Publish with GitHub Pages

In the repository, open **Settings → Pages** and choose:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`

The site will then be available through GitHub Pages.

## Planned next features

- Click or tap a triad shape to isolate it
- Optional chord-progressions mode
- Saved practice views
- Practice/game mode
- Custom fretboard patterns

## License

MIT License
