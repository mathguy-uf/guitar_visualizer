# Audio and scoring corrections — approval copy

**Status: local changes only. Nothing in this review has been pushed.**

The current GitHub `main` was checked before editing and rechecked afterward: `58948e0bb56390f3e139002fcb92e0d2fc3ed728`. Proposed work is on the local `scoring-reliability-review` branch.

## Causes and corrections

| Problem | Actual cause | Correction |
|---|---|---|
| Three-string pinch cannot be verified | E2–B3–E4 overlaps E2's third/fourth harmonics, which the detector deliberately suppresses. The first pinch in the pinch-roll also paired E2 with its octave-family E4. | Use open D3–B3–E4 for the three-string exercise. The pinch-roll pairs E2 with G3, then D3 with E4. Every authored pinch group now passes the production harmonic checks in synthesized tests. |
| False pinch from ringing strings | Simultaneous frequency presence alone could combine an old bass sustain with newly plucked treble. Harmonic rejection considered only expected lower notes. | Require fresh energy for each pinch constituent. Also examine significant lower spectral peaks outside the expected set, so an unexpected ringing string cannot easily supply a phantom upper pitch. Harmonic-related combinations remain uncertain. |
| Sustain can count twice | A long 4096-sample pitch window keeps filling after the first detected attack. That rising window energy could be treated as a second pluck. | Separate attack and pitch analysis: a 1024-sample causal envelope finds fresh attacks, with a local envelope valley for gradual rises. The longer window still estimates bass pitch. A short 40 ms refractory interval preserves rapid legitimate attacks. |
| Correct notes become misses while analysis is pending | The UI expired notes using the present audio clock, ahead of the worker. | Worker messages report how far captured audio is fully analysed, holding that position back while a pitch is settling. Score the returned attack first; then expire only events whose deadlines are behind the processed-audio position. End results also wait for pending analysis. |
| Rapid plucks can disappear | While the worker was busy, the next pending window was repeatedly replaced by the newest one. | Keep an ordered FIFO of up to 24 waiting windows (about half a second). Excessive delay pauses the exercise instead of silently dropping attacks and assigning misses. Stale capture packets over 500 ms old and a one-second worker-message stall also cause a safe pause. |
| A late worker result is discarded | Results were accepted only when their target version matched the current visual target. | Attach expected pitches/event identity using each captured window's timestamp. Retain that context while an attack settles. Accept results from the active session regardless of later visual target changes; discard messages only from stopped/restarted sessions. |
| Tempo changes distort older attacks | Updating BPM discarded the old time-to-tick mapping; older timestamps were interpreted using the new tempo. | Retain piecewise tempo history and calculate timing error in real seconds against each event's scheduled audio time. The chosen timing tolerance is unchanged. |
| Overlapping timing windows penalize the correct pitch | The nearest event was chosen before pitch matching, even when a nearby different note stole a valid early/late attack. | Prefer a fully matching pending event inside its timing window before judging a nearby different pitch. Slightly early first notes inside the selected window are accepted. |
| Uncertainty prematurely closes a note | Rhythm immediately finalized an uncertain pinch; uncertain single-note attempts could later become misses. | Keep uncertainty provisional until the timing window closes. A clearer reading can replace it. Unresolved uncertainty is unscored, including unclear single-note readings; it is not an extra-note or missed-note penalty. Learn retains **Continue unscored**. |
| A cancelled slow startup can stop a newer session | A late `listen()` completion assigned its old handle to the shared listener variable before checking session identity. Cleanup could then release the current microphone owner. | Keep the returned analysis handle local until its session is confirmed. Cancelled startup cleans up only its own nodes. |
| Pausing drops unprocessed audio | Stopping the microphone discards its pending frames while the visual cursor had already advanced. | Resume from the earlier analysed position so the unprocessed gap can be replayed fairly. Restart starts a fresh worker/session. Backgrounding pauses; foregrounding never starts the microphone automatically. |

## Capture and timing details

`js/capture-worklet.js` was reviewed and left unchanged. Its existing sample-order, hop-spacing, silence-routing, and sample-clock timestamp tests still pass.

Capture timestamps remain the common clock for detection, display, and scoring. The analysis window centre is an onset-time estimate; the existing room/timing calibration compensates the combined player/device offset. This is not a claim of laboratory-accurate physical onset measurement.

Processing grace is separate from musical tolerance: waiting for the worker does **not** widen the ±100/160/220 ms playing windows. If processing cannot keep up, the app pauses and revisits the unprocessed region. It does not mark the gap missed.

The game still has Learn and Rhythm modes, Listen playback, metronome scheduling, room/timing calibration, saved settings, standard guitar tuning, and exclusive tuner/game microphone ownership. No runtime dependencies or server changes were introduced. Browser cache keys were advanced for the changed scripts and worker imports.

## Validation

Command:

```sh
node --test tests/*.cjs
```

**63 tests passed; 0 failed.** The original 35 checks are retained. New coverage includes:

- Every authored pinch combination through the production detector at 44.1 and 48 kHz.
- Octave/third/fourth-harmonic interference and an unexpected lower string producing a phantom upper octave.
- Synthesized plucks with finite attacks, six harmonic partials, frequency-dependent exponential decay, small tuning offsets, pick noise, low background noise, and overlapping sustain.
- Two- and three-string attacks with small finger-onset offsets; a ringing bass plus new treble is not accepted as a fresh three-string pinch.
- Natural sustain counted once; distinct roll notes at 100 ms spacing and repeated pitches at 80 ms spacing counted separately in the fixtures.
- Pending pitch-settlement target identity; FIFO ordering; overload handling; captured-time target selection.
- Delayed results inside the playing window, including delivery after the visible exercise end.
- Slightly early first notes, overlapping timing windows, uncertainty retries, and historical tempo mapping.
- Pause/resume with audio pending, restart with stale worker callbacks, Listen/Play transitions, background/foreground, denied microphone permission, cancelled slow-start ownership races, and calibration while a pinch exercise is selected.
- Existing scale, modal spelling, tuner pitch, tuner tolerance/persistence, ownership, and capture checks.

The failures were reproduced before correcting the corresponding production logic. The game fixture now models continuous timestamped analysis frames separately from attacks, so delivery delay can be injected intentionally rather than treating a long interval with no microphone messages as normal processing.

Local browser smoke checks cover the revised exercise selection, tablature/text score, Listen playback, navigation, help, and the unchanged UI. The internal HTTP preview cannot test live microphone APIs.

## Files changed

| Files | Purpose |
|---|---|
| `js/dsp.js` | Attack envelope, per-note pinch freshness, broader harmonic checks. |
| `js/analysis-worker.js` | Captured target retention and processed-audio progress. |
| `js/audio.js` | Ordered queue, bounded grace, per-window target context, worker cache version. |
| `js/music.js` | Tempo history, time-based event matching, provisional uncertainty. |
| `js/game.js` | Progress-based expiry/completion, pending-audio replay, current-session filtering, clearer verified-note labels. |
| `js/exercises.js` | Revised three-string and pinch-roll note combinations. |
| `js/app.js`, `index.html` | Accurate help/verified-note language and cache refresh. |
| `tests/dsp.test.cjs`, `tests/rhythm.test.cjs`, `tests/game.test.cjs` | New regressions and continuous-frame lifecycle fixture. |
| `tests/plucked-audio.test.cjs` | Realistic synthesized pluck, harmonic, decay, sustain, and rapid-note fixtures. |
| `tests/analysis-worker.test.cjs`, `tests/analysis-queue.test.cjs` | Worker context, settled progress, ordered delivery, and overload regressions. |
| `docs/REVIEW.md`, `docs/SCORING_REVIEW.md` | Updated architecture and this approval report. |

## Remaining limits

- **Pinch recognition remains experimental.** Synthetic fixtures support these selected combinations; they do not establish general polyphonic recognition. Harmonic-family pinches may intentionally stay unscored.
- Physical acoustic-guitar/iPhone Safari testing remains necessary, including quiet treble notes against loud bass, different microphones/rooms, speaker click leakage, sustained chords, and iOS interruptions. Headphones are still recommended with clicks/calibration.
- Very weak or overlapping attacks can remain uncertain. If no onset is detected at all, a played note may still appear missed. The new queue fixes software delivery losses; it cannot reconstruct acoustic attacks that the detector never resolves.
- There is a bounded processing budget, not unlimited latency tolerance. Overloads pause rather than pretending to grade unavailable audio.
- Timing calibration estimates player/device offset together. It does not separately measure hardware latency.
- The app hears pitches; it cannot identify the physical string or picking finger uniquely. Sustain length, rests/muting quality, and exhaustive simultaneous extra-string transcription are still not graded.
