# iPhone usability review

Local review branch: `iphone-usability-review`. Base: published `9c528ef03ee89d25f947a2d15f9cf8d17005ab3b`, verified against GitHub main. **These usability changes have not been pushed.**

## 1. What was improved

- Landscape Play replaces the four-section navigation with an obvious **Exercises** exit and **? Help** in the TAB header. Setup still disappears during playback. The score is hidden in this compact view; full results and ordinary portrait/desktop scoring remain available.
- Start/Pause, Restart, Listen, and tempo controls have 48-pixel height in landscape. An exact BPM field now sits between − and +; it no longer requires opening options. Its 16-pixel text helps avoid automatic iPhone input zoom.
- The layout retains left/right/bottom safe-area padding, adds top safe-area padding, and uses a `100vh` fallback followed by dynamic `100dvh` height.
- Practice offers **Tune first**, a return button naming the current exercise, and a labeled search field. Matching lesson groups open automatically; empty searches explain how to recover. Clearing the search restores the complete 24-exercise library.
- Tools offers **Choose an exercise** after tuning. The redundant beginner promotion card was removed; the introductory bass group remains first and open. The optional first-use tour remains available.
- Help now includes dedicated bass/chord-change and pinch topics, with a simple bass-count diagram and clear uncertainty guidance. Landscape Help is reachable during playback and pauses the activity. Existing TAB and finger diagrams, rolls, rhythm, calibration, troubleshooting, looping, and tour remain.
- Shortened the fretboard orientation caption and clarified progression entry. All detailed scale, triad, and tool controls remain in their existing expandable panels.

### Two workflows checked

**Beginner:** Practice → Tune first → tuner → Choose an exercise → search “forward” → Listen to Forward roll → rotate → Start. Microphone failure explains the HTTPS requirement and leaves Listen available. Real tuning and capture still need physical-device testing.

**Returning guitarist:** Practice → search “blues” → Front porch blues → type 75 BPM directly → choose Rhythm when desired → Start/Listen. Returning from Tools or Help keeps the selected exercise and tempo. **Return to Front porch blues** avoids reselecting it. A measure loop keeps repeated practice continuous.

### Files changed

| File | Purpose |
|---|---|
| `index.html` | Compact game navigation, visible exact tempo, practice shortcuts/search, Tools return, concise captions, cache versions |
| `app.css` | Touch sizes, compact landscape layout, safe-area/dynamic height rules, mobile form text |
| `js/app.js` | Exercise filtering, direct navigation, named return action, expanded Help |
| `docs/IPHONE_REVIEW.md` | Review and physical-device checklist |

Audio capture, pitch detection, scoring, musical timing, and exercise data were not changed. The seven modes, pentatonics/patterns, triad controls, progressions, metronome, standard/Drop D tuner, both game modes, calibration, loops, and local microphone processing remain. No backend or runtime dependency was introduced.

## 2. What was tested

- `node --test tests/*.cjs`: **82 passed, 0 failed, 0 skipped**. Includes synthetic guitar/harmonic tests, capture and worker timing, delayed scoring, rapid attacks/sustain, microphone ownership, pause/restart, tempo changes, loop boundaries, scale spellings, and tuner behavior.
- `git diff --check`: passes.
- Browser interactions used Chromium with application iframe viewports; these are layout/interaction checks, not real iPhone or Safari tests.
- Checked 390 × 844 portrait, 667 × 375 and 844 × 390 landscape, and 844 × 300 with constrained height. Rotation guidance and ordinary section navigation remain in portrait.
- Measured 667 × 375 and 844 × 300 Play documents: scroll size equals viewport size, with no page scrolling. At 844 × 300 during looped Listen, the canvas is 818 × 156; transport buttons are 48 pixels high and tempo step buttons are 46 pixels wide. At 844 × 390 the playing canvas has 246 pixels of height.
- Walked the beginner tuning/forward-roll route. Checked tuner Drop D selection and graceful microphone-unavailable feedback; HTTP preview cannot capture microphone audio.
- Searched “forward” and “blues”; checked zero-result recovery and clearing; selected Listen and Practice actions; typed 75 BPM using keyboard input and verified the summary changed to 75. Reload retained the exercise and tempo without restarting audio.
- Checked D Dorian rendering, first-inversion selection, Solo practice and chord stepping. Existing automated tests cover all seven mode spellings and tuner tolerances.
- Opened metronome subdivision options, selected triplets, started/stopped playback, and toggled an individual beat. Tuner and metronome remain separate tool tabs.
- Opened Help from Tools and landscape Play; verified all topics, the skippable tour, and returning to the exercise. Looped Listen remained usable with Exit, Help, Restart, pause, and tempo visible.

## 3. What still needs physical-device verification

Use the existing live version until this review is approved and deployed; these changes are currently local. After deployment, test on Safari with the acoustic guitar and phone stand you normally use.

| Check | Expected result / what to report |
|---|---|
| Rotation, notch, and Safari bars | Try both landscape directions. Expand/collapse the address bar. All six strings, Exit, Help, transport, and tempo controls should remain visible. Report iPhone model, iOS version, orientation, text size, and a screenshot if anything clips. |
| Exact tempo keyboard | Type 75, dismiss the keyboard, then start. The page should recover its available height, retain 75 BPM, and avoid unwanted zoom. Report whether Safari or a Home Screen shortcut was used. |
| Beginner flow and tuning | Tune each standard string, then try Drop D in the tuner only. Held readings should remain useful; in-tune state should remain stable. Return to standard before the game. Report which pitches flicker or fail. |
| Permission and audio handoff | Allow/deny microphone permission, retry, move between tuner and game, pause, and restart. Only the current tool should listen. Report stuck permission states or missing audio. |
| Guitar timing and sustain | Calibrate with headphones. Play a slow forward roll in Learn, then Rhythm. A ringing note should not count twice. Try blues at 75 BPM, pinches, and at least ten loop passes. Report exercise, BPM, mode, offset, and whether valid notes read early, late, missed, or uncertain. |
| Interruptions and comfort | Background Safari, lock/unlock, and return after an interruption. Audio should remain paused until resumed. Practice for 20 minutes; report heat, stutter, fatigue, hard-to-read labels, and unnecessary taps. |

No physical iPhone/Safari microphone testing was performed here. Pinch recognition is still experimental, and sustain duration or silence during rests is not graded. VoiceOver, larger Dynamic Type, keyboard dismissal, safe-area insets, and real Safari viewport transitions remain device checks.

## 4. Worthwhile future improvements

1. Use observations from the physical-device checklist to refine minimum canvas height and form-keyboard behavior before adding features.
2. Improve pitch confidence with consented real acoustic-guitar fixtures from multiple phones and rooms, retaining forgiving uncertainty.
3. Add authored count regions for exercises mixing triplets and sixteenths, and more short acoustic arrangements.
4. Consider an opt-in hands-free count-in/repeat control only if actual practice reveals a need. Keep the current navigation and screens small.
