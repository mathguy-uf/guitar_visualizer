# Guitar Visualizer

A mobile-friendly interactive guitar fretboard for learning pentatonic scales, triads, intervals, inversions, and chord shapes.

## Version 0.2

Current features include:

- Major pentatonic scales in all 12 keys
- Minor pentatonic scales in all 12 keys
- Note-name or interval-label display
- Interval labels measured from the selected scale root (`1`)
- Translucent triad overlay layer
- Major, minor, diminished, and augmented triads
- Triad tones outside the primary scale remain visible
- 12, 15, or 24 fret views
- Root-note highlighting
- Responsive portrait and landscape layouts for phones
- Horizontal fretboard scrolling on narrow screens

## Layer model

The fretboard uses two visual layers:

1. **Primary layer:** the selected pentatonic scale.
2. **Overlay layer:** an optional translucent triad placed over the scale.

This makes it possible to see both shared notes and chord tones that fall outside the selected pentatonic scale.

## Run locally

Open `index.html` in a browser.

## Publish with GitHub Pages

In the repository, open **Settings → Pages** and choose:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`

The site will then be available through GitHub Pages.

## Planned next features

- Root, first, and second triad inversions
- Selectable string groups
- Diatonic triad shortcuts for the selected key
- Practice mode
- Custom fretboard patterns

## License

MIT License
