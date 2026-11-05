# Guitar redesign and new fingerpicking game — review copy

The fingerpicking game is built from scratch within the existing application. The existing learning tools are retained and reorganized. Publishing to the existing GitHub Pages site was authorized after the initial local review work.

Repository: `mathguy-uf/guitar_visualizer`  
Base: `f658a349742d593eb25f2615d64293c5c6e9c92f`  
Local branch: `interface-fingerpicking-review`

## What changed

| Section | Experience |
|---|---|
| Learn | Existing interactive fretboard, scales/modes, pentatonic patterns, triad inversions, and progression work. Key and scale are visible; detailed controls are collapsed. |
| Practice | Nineteen short exercises in five levels, each with a playing cue, suggested tempo, and Listen/Practice actions. |
| Play | Landscape scrolling TAB, fixed playhead, six strings, beat numbers, chord cues, finger hints, Learn and Rhythm modes. Large Start/Pause, Restart, Listen, and tempo buttons. |
| Tools | Separate tuner/metronome views. Common actions are visible; string precision, meter, subdivisions, and group selections are behind disclosures. |
| Help | Seven topics, a TAB diagram, P/I/M/A guide, contextual entry points, and a skippable three-step tour. |

The interface uses restrained green, warm neutral text, consistent touch controls, and bottom navigation on portrait phones. Landscape gameplay condenses navigation and hides setup while playing. Settings and practice history use browser-local storage; audio never starts automatically after a reload.

## Preserved functionality

- Major/minor pentatonics; all seven diatonic modes, accurate note spellings, and intervals.
- Blue notes, 3–2/2–3 patterns and dashed outlines, fret ranges, practice areas, and note playback.
- Major, minor, diminished, and augmented triads; string sets and inversions; individual shapes.
- Chord progression entry, nearest-voicing transitions, chord-tone overview, and chord playback.
- Metronome meters, even/triplet subdivisions, individual count activation, group toggles, tempo slider/number control, and accented counts.
- Standard/Drop D tuner, automatic/manual string choice, practice/fine tolerance, smoothing, hysteresis, and four-second held readings.

## Implemented in the new game

- **Learn:** waits for a fresh, confidently correct pitch. Wrong-pitch attempts can be retried without a time limit. Rests and ties do not request another pluck.
- **Rhythm:** continuous movement on the audio clock, one-bar lead-in, adjustable timing window, early/late/correct/wrong/missed feedback, streak, and end results.
- Listen playback without a microphone; repeat, restart, next exercise, and optional automatic repetition.
- Live tempo changes preserve musical position. Pause silences scheduled playback and releases the microphone; resume continues from the saved position.
- Worker analysis, causal audio timestamps, an input timing offset, room-noise calibration, and a guided eight-pluck timing check.
- Shared microphone ownership for tuner/game; cancelled permission requests stop late-arriving streams. Backgrounding, navigation, and tool changes stop listening.
- Expected-pitch evidence, fundamental estimation, fresh-attack gating, and spectral-change evidence for a new treble pluck over a ringing bass.
- Conservative expected-note pinch analysis. Uncertain pinches are separate from wrong notes. Learn offers an explicit **Continue unscored** action; Rhythm excludes uncertain pinches from judged accuracy.
- Text version of the exercise and changing accessible target descriptions alongside the animated canvas.

## Exercise progression

1. One steady bass; open bass strings; alternating bass.
2. Forward, backward, and combined eighth-note rolls.
3. G–C–D–G; G–Em–Am–D; G–D–Em–C, with chord cues.
4. Two-string pinches; three-string pinches; pinches into rolls.
5. Independent bass with offbeat melody; sixteenths; dotted notes; triplets; rests/ties; 6/8; alternating-thumb blues with optional swing.

Advanced rhythms above are actual exercises and playback/scoring events, not just future placeholders.

## Timing and audio architecture

- `js/exercises.js`: musical content, chord changes, playing tips, and level descriptions.
- `js/music.js`: 960 ticks per quarter note; meter/bar duration; optional swing mapping; event compilation; transport; scoring.
- Each event has an absolute onset, duration, voice, notes, and optional accent/tie/straight-subdivision flags. Simultaneous voices merge into one attack group while individual note durations remain independent.
- Triplets use 320 ticks; eighths 480; sixteenths 240. Rests have no notes; tied continuations have no new scoring target.
- `js/audio.js`: microphone ownership, context reuse, silent capture routing, playback, and analysis lifecycle.
- `js/capture-worklet.js`: audio-thread capture, 4096-sample causal windows, 1024-sample hops, and sample-clock timestamps. No microphone monitoring through speakers.
- `js/analysis-worker.js` / `js/dsp.js`: off-main-thread fundamental and candidate-frequency analysis, harmonic caution, and attack gating. Backpressure retains only the newest pending audio window.
- `js/game.js`: session controller, scheduling, calibration, TAB drawing, and feedback.
- `js/app.js`: navigation, local persistence, library, help, and onboarding.

The original music display and tuner algorithms remain in `script.js` and `tuner.js`. `legacy-layout.css` moves the original inline layout rules out of HTML; `app.css` supplies the new application shell and responsive layouts. There are no new runtime dependencies, accounts, analytics, subscriptions, or audio uploads.

## Limitations and future work

| Area | Current status |
|---|---|
| Real iPhone Safari with an acoustic guitar | **Still needs physical-device testing.** Browser viewport checks and synthetic-audio tests cannot establish real microphone accuracy, battery cost, acoustic timing, or interruptions on iOS. |
| Pinches | **Experimental.** Some two-note combinations work in synthetic tests. Octaves and harmonic-related intervals may remain uncertain, including some three-string exercises. No reliable general polyphonic transcription is claimed. |
| Additional notes | Extra onset timing and unexpected recognized pitches are tracked. Exhaustive detection of simultaneous extra strings over sustain is not implemented. |
| Sustain, rests, ties | Timed and rendered, with tied playback and no repeated scoring attack. Correct hold length, muting, and silence during rests are **not graded**. |
| Physical string/finger | Suggested by TAB only; audio cannot uniquely identify either. |
| More sophisticated music | The timeline supports independent voices and arbitrary integral tick placements. Long authored arrangements, tempo maps, changing meters inside one exercise, arbitrary irrational subdivisions, notation import, and custom exercise editing are future work. |
| Game tuning | Standard tuning only. Drop D remains available in the tuner. |
| Input timing calibration | Guided and implemented; it measures combined player/device offset, not laboratory-separated hardware latency. Use headphones and adjust if necessary. |
| Motion | Decorative motion respects reduced-motion settings. Rhythm TAB still scrolls because that movement communicates timing; Learn provides the stationary alternative. |
| Accessibility | Labels, keyboard controls, native dialogs, non-color feedback, and text TAB are included. Live microphone play and moving TAB still need assistive-technology testing. |

## Validation

Run from the project directory:

```sh
node --test tests/*.cjs
```

Automated tests cover existing modes/spellings and tuner behavior; all exercise timelines and pitches; independent voices; swing/triplets; rests/ties; tempo and pause/resume; scoring categories; uncertain pinches; microphone cancellation/denial/retry; game lifecycle; and synthetic attack/harmonic/sustain cases.

Browser checks cover navigation, the exercise library, Listen playback, contextual help, portrait guidance, retained learning controls, metronome playback, tools, and settings persistence. Phone-sized iframe viewports cover 844 × 390, 667 × 375, 390 × 844, and constrained landscape height. These are Chromium layout checks, **not an iPhone Safari certification**.

The internal HTTP preview cannot expose secure microphone APIs. Its unavailable-microphone path was verified; actual microphone capture, calibration, and Web Audio worklet behavior on Safari remain part of device QA.

## Review locally

No build is required. Extract the source archive and serve the directory:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000` on that computer. Localhost supports microphone permission in browsers that provide the required audio APIs; opening `index.html` directly is insufficient for full microphone/worker functionality. Test on an HTTPS host for a physical iPhone. Publication uses the repository’s existing GitHub Pages configuration.
