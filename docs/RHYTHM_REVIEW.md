# Rhythm guides, syncopation, and measure loops — review copy

These changes are local and **have not been pushed or deployed**.

- Remote `main`, verified November 5, 2026: `58948e0bb56390f3e139002fcb92e0d2fc3ed728`.
- Audio/scoring corrections are preserved in local checkpoint `8ec9e61` (see [SCORING_REVIEW.md](SCORING_REVIEW.md)).
- Current branch: `rhythm-visualization-review`, built on that corrected checkpoint.
- No runtime dependencies or build step were added. GitHub Pages compatibility is retained.

## What a player sees

The count row now chooses one useful guide for the exercise: numbered quarters, `1 &`, `1 e & a`, or `1 trip let`. In 6/8 it shows `1 2 3 4 5 6`, with 1 and 4 emphasized as the two groups of three. Swung eighth-count labels move with the swung notes. **Mode & options → Show rhythm counting** hides the row; the preference is remembered.

Bass notes have round markers, treble notes square markers. Heavier lines mark numbered beats and measure boundaries; small dashed ticks mark subdivisions. A vertical connector groups simultaneous plucks into a pinch. Long notes have hold lines, tied continuations have a small arc instead of a new fret attack, and rests are placed in the appropriate voice. The current and next chord remain in the compact header. Notes ahead of the playhead remain visible.

The short playing cue explains the musical task: keep the bass steady while the melody answers between beats. The TAB remains the main part of the screen, especially during landscape playback.

## Practice loops

1. Tap **Loop measures** beside the exercise title.
2. Choose the first and last measure, inclusive. Choose the same measure twice for a one-measure loop.
3. Tap **Loop selection**, then **Start** or **Listen**.
4. Adjust the existing large − / + BPM controls while practicing.
5. Return to the loop selector and choose **Play whole exercise** to clear it.

The phrase repeats after one count-in. Learn still waits for fresh correct attacks, including at the next pass. Rhythm and Listen continue without a new count-in or microphone restart. The loop and exercise are remembered on reload; audio never starts automatically. Choosing another exercise clears the selection. Opening the selector pauses the activity.

The loop selector is separate from ordinary play. During playback, its setup row is hidden with the other setup controls. Pause brings it back. The older **Repeat automatically** option remains available for whole exercises and is disabled while measure looping is selected.

A note already held into the first selected measure is rearticulated once at each pass start. Holds are clipped at the selection end. This makes the selected phrase independently playable; cross-boundary legato is not inferred. **Listen** resumes a paused demonstration; **Start** switches from the demonstration to microphone play.

## Musical progression

All 19 existing exercise IDs remain. Five new exercises make 24 total:

| New exercise | Musical step |
|---|---|
| One note between beats | G bass on 1 and 3; a single treble answer on the & of 4 |
| Melody between the beats | G–Em–Am–D; melody on each & against the bass pulse |
| A folk-style answer | Alternating bass and a short melody through G–D–Em–C |
| The last little sixteenth | G–C–D–G; melody on the a of 2 and 4 at 40 BPM |
| Melody across a bass beat | G–C; an offbeat melody note tied across the next bass attack |

These sit alongside the preserved steady-thumb, alternating-bass, forward/backward/combined-roll, chord-change, pinch, dotted-rhythm, triplet, rest/tie, compound-meter, and swing exercises. These are authored, playable events with Listen and scoring targets, not placeholders. New note choices are tested against their chord tones.

## How timing stays aligned

One quarter note is **960 ticks**. A guide label and its note use the same tick, swing mapping, transport, and horizontal projection:

```text
x = playheadX + (eventTick − currentTick) / 960 × pixelsPerQuarter
```

At constant tempo, an onset's time relative to the beginning is `tick / 960 × 60 / BPM`:

| Position within a quarter | Tick offset | At 60 BPM | At 120 BPM |
|---|---:|---:|---:|
| e | 240 | 0.250 s | 0.125 s |
| Straight & | 480 | 0.500 s | 0.250 s |
| a | 720 | 0.750 s | 0.375 s |
| trip | 320 | 0.333 s | 0.167 s |
| let / triplet-swing & | 640 | 0.667 s | 0.333 s |

The existing piecewise tempo history handles live BPM changes, so earlier captured attacks retain their original times. Pausing freezes the musical position. Rendering does not drive scoring or the audio clock.

For a four-quarter-note loop, `L = 3840` ticks. Each pass creates event ticks `localTick + passIndex × L`, with unique IDs. The clock is never reset at the loop boundary. A previous-pass late attack and a next-pass early attack therefore coexist and can be matched independently. The end boundary is exclusive, preventing a duplicated downbeat.

Capture timestamps, ordered worker processing, settled-audio expiry, uncertainty handling, calibration, and tuner/game microphone ownership from the scoring correction remain in use. Recent passes stay available for pending results; finalized older events are archived while aggregate results are retained. A regression simulates 500 passes and 2,000 credited attacks without growing the live event list indefinitely.

## Files changed in this rhythm increment

| File | Change |
|---|---|
| `js/rhythm.js` (new) | Counting guides, shared position projection, sustained-note lookup, measure selection, repeating timeline |
| `js/music.js` | Retain voice-specific rests and bass defaults; archive completed loop events without losing totals |
| `js/game.js` | Loop controller and scheduling; adaptive counts; bass/treble shapes, pinches, holds and rests; accessible labels |
| `js/exercises.js` | Five gradual syncopation exercises and short teaching cues |
| `js/app.js` | Persist loop settings; new loop help and expanded rhythm/TAB help |
| `index.html` | Counting option, loop selector, teaching cue, script/style cache versions |
| `app.css` | Compact loop controls and responsive landscape selector |
| `tests/rhythm-guides.test.cjs` (new) | Count selection, swing, projection, voices/ties, chord tones |
| `tests/measure-loop.test.cjs` (new) | Selection, boundaries, unique IDs, scoring, holds, tempo, long sessions |
| `tests/game.test.cjs` | Controller integration for looped Learn/Listen/Rhythm, delayed results, tempo and pause |
| `docs/REVIEW.md`, `docs/RHYTHM_REVIEW.md` | Updated overview and this review |

## Validation

`node --test tests/*.cjs`: **82 passed, 0 failed, 0 skipped**. This includes all 63 earlier audio/scoring checks plus 19 new rhythm/loop checks. `git diff --check` also passes.

New automated coverage includes:

- Count-to-note projection at 40, 60, 95, and 180 BPM; eighths, sixteenths, triplets, 6/8, and swing.
- Correct subdivision labels without stacking multiple guide systems.
- Measure selection, carry-in notes and ties, boundary clipping, and cross-loop chord cues.
- Late previous-pass and early next-pass attacks, including worker results delivered after the boundary.
- Single microphone ownership across repeated passes, unique Listen onsets, live BPM changes after archival, and pause/resume.
- Learn's indefinite looping and bounded event storage during a long practice simulation.

Chromium UI checks covered 844 × 390 and 667 × 375 landscape, 390 × 844 portrait guidance, and 844 × 300 constrained height. Landscape views fit without page scrolling; setup is hidden while playing. Checked selecting measures 2–3, playback across several passes, live BPM changes and pause, hiding/restoring counts, reload persistence, the expanded lesson list, and contextual loop help. The short-height selector keeps its primary controls available and can scroll for additional help.

## Remaining limitations

- **Physical iPhone Safari and acoustic-guitar testing remains necessary.** Chromium iframe layouts, simulated controller clocks, and synthesized guitar tests do not prove real-device microphone accuracy, audio interruption behavior, or absence of audible glitches. The internal HTTP preview cannot exercise secure microphone capture.
- Polyphonic/pinch recognition remains experimental, with uncertainty preserved rather than converted into wrong notes. No new recognition capability is claimed here.
- Sustain, ties, and rests are shown and scheduled; hold duration, muting, and silence are not graded.
- The guide is chosen per exercise, not dynamically per measure. The present exercises are covered; mixed triplet-and-sixteenth notation within one exercise would need authored guide regions before being added to the library.
- Looping selects whole measures. Arbitrary in/out points, a custom pattern editor, changing meters within an exercise, automatic tempo ramps, and cross-boundary legato are outside this increment.
- Live tempo changes silence already-scheduled demonstration output before rescheduling; a long held demonstration note can be cut short by the change. Onset positions and scoring remain synchronized.
