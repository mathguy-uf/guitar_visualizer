/* Musical time is measured in integer ticks: 960 per quarter note. */
(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.GuitarMusic = api;
})(globalThis, () => {
    'use strict';
    const PPQ = 960;
    const tuning = [64, 59, 55, 50, 45, 40]; // TAB order: high e first.
    const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
    const noteName = midi => ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'][((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
    const barTicks = meter => meter[0] * PPQ * 4 / meter[1];
    // Swing warps the second eighth inside each quarter. Triplets and other
    // tuplets remain straight. Positions and durations share the same mapping.
    function swungTick(tick, swing = 0, straight = false) {
        if (!swing || straight || tick < 0) return tick;
        const beat = Math.floor(tick / PPQ),
            fraction = tick / PPQ - beat;
        const split = 0.5 + Math.max(0, Math.min(1, swing)) / 6;
        return (beat + (fraction < .5 ? fraction * split * 2 : split + (fraction - .5) * (1 - split) * 2)) * PPQ;
    }

    function compile(exercise, swing = 0) {
        const groups = new Map();
        for (const e of exercise.events) {
            if (!Number.isInteger(e.tick) || e.tick < 0 || !Number.isInteger(e.duration) || e.duration <= 0) throw Error('Invalid event time');
            if (e.tick + e.duration > exercise.length) throw Error('Event exceeds exercise');
            const notes = e.notes || [];
            for (const n of notes)
                if (!(n.string >= 1 && n.string <= 6 && n.fret >= 0 && n.fret <= 24)) throw Error('Invalid TAB position');
            const tick = swungTick(e.tick, swing, e.straight);
            const end = swungTick(e.tick + e.duration, swing, e.straight);
            if (!groups.has(tick)) groups.set(tick, {
                tick,
                duration: end - tick,
                notes: [],
                rests: [],
                accent: false,
                rest: true
            });
            const group = groups.get(tick);
            group.duration = Math.max(group.duration, end - tick);
            group.accent ||= !!e.accent;
            if (!notes.length) group.rests.push({
                voice: e.voice || 'all',
                duration: end - tick
            });
            for (const n of notes) {
                const note = {
                    ...n,
                    midi: tuning[n.string - 1] + n.fret,
                    voice: e.voice || (n.string >= 4 ? 'bass' : 'treble'),
                    tie: !!e.tie,
                    duration: end - tick
                };
                group.notes.push(note);
                if (!e.tie) group.rest = false;
            }
        }
        return [...groups.values()].sort((a, b) => a.tick - b.tick).map((g, id) => ({
            ...g,
            id,
            targets: [...new Set(g.notes.filter(n => !n.tie).map(n => n.midi))]
        }));
    }
    class Transport {
        constructor(now = () => 0, bpm = 60) {
            this.now = now;
            this.bpm = bpm;
            this.tick = 0;
            this.running = false;
            this.anchor = 0;
            this.segments = [];
        }
        position(time = this.now()) {
            if (!this.running) return this.tick;
            const segment = [...this.segments].reverse().find(s => s.anchor <= time) || this.segments[0];
            return segment.tick + (time - segment.anchor) * segment.bpm / 60 * PPQ;
        }
        start(tick = this.tick) {
            this.tick = tick;
            this.anchor = this.now();
            this.running = true;
            this.segments = [{
                anchor: this.anchor,
                tick: this.tick,
                bpm: this.bpm
            }];
        }
        pause() {
            this.tick = this.position();
            this.running = false;
        }
        seek(tick) {
            this.tick = tick;
            this.anchor = this.now();
            if (this.running) this.segments = [{
                anchor: this.anchor,
                tick,
                bpm: this.bpm
            }];
        }
        setTempo(bpm) {
            this.tick = this.position();
            this.anchor = this.now();
            this.bpm = Math.max(30, Math.min(180, Number(bpm) || 60));
            if (this.running) this.segments.push({
                anchor: this.anchor,
                tick: this.tick,
                bpm: this.bpm
            });
        }
        timeAt(tick) {
            const segment = [...this.segments].reverse().find(s => s.tick <= tick) || this.segments[0];
            return segment ? segment.anchor + (tick - segment.tick) / PPQ * 60 / segment.bpm :
                this.anchor + (tick - this.tick) / PPQ * 60 / this.bpm;
        }
    }
    class Session {
        constructor(events, mode = 'rhythm', tolerance = .18) {
            this.events = events;
            this.mode = mode;
            this.tolerance = tolerance;
            this.results = new Map();
            this.uncertain = new Set();
            this.extras = 0;
            this.wrong = 0;
            this.streak = 0;
            this.best = 0;
            this.archived = {
                total: 0,
                hits: 0,
                onTime: 0,
                missed: 0,
                uncertain: 0,
                judged: 0,
                seconds: 0
            };
        }
        archiveBefore(tick, unscored = false) {
            const kept = [];
            for (const e of this.events) {
                const r = this.results.get(e.id);
                if (e.tick + e.duration >= tick || (e.targets.length && !r && !unscored)) {
                    kept.push(e);
                    continue;
                }
                if (e.targets.length) {
                    this.archived.total++;
                    if (r) {
                        if (r.kind === 'uncertain') this.archived.uncertain++;
                        else this.archived.judged++;
                        if (r.kind === 'missed') this.archived.missed++;
                        if (['correct', 'early', 'late'].includes(r.kind)) {
                            this.archived.hits++;
                            this.archived.seconds += Math.abs(r.seconds);
                        }
                        if (r.kind === 'correct') this.archived.onTime++;
                    }
                }
                this.results.delete(e.id);
                this.uncertain.delete(e.id);
            }
            this.events.splice(0, this.events.length, ...kept);
        }
        next() {
            return this.events.find(e => e.targets.length && !this.results.has(e.id));
        }
        expire(tick, bpm, secondsSince = null) {
            if (this.mode === 'learn') return;
            for (const e of this.events) {
                const elapsed = secondsSince ? secondsSince(e) : (tick - e.tick) / PPQ * 60 / bpm;
                if (e.targets.length && !this.results.has(e.id) && elapsed > this.tolerance + 1e-9) {
                    const uncertain = this.uncertain.delete(e.id);
                    this.results.set(e.id, {
                        kind: uncertain ? 'uncertain' : 'missed'
                    });
                    if (!uncertain) this.streak = 0;
                }
            }
        }
        input({
            tick,
            pitches,
            confidence = 1,
            time = null,
            timeAt = null,
            eventId = null
        }, bpm) {
            const available = this.events.filter(e => e.targets.length && !this.results.has(e.id));
            const error = e => timeAt && Number.isFinite(time) ? time - timeAt(e.tick) : (tick - e.tick) / PPQ * 60 / bpm;
            const matches = e => e.targets.every(m => pitches.some(p => Math.abs(p - m) <= .45));
            const nearest = list => list.reduce((best, e) => !best || Math.abs(error(e)) < Math.abs(error(best)) ? e : best, null);
            const inWindow = this.mode === 'learn' ? available.slice(0, 1) :
                available.filter(e => Math.abs(error(e)) <= this.tolerance + 1e-9);
            // A nearby different pitch must not steal a correct early/late note
            // when fast subdivisions have overlapping tolerance windows.
            const unclear = confidence < .60 || !pitches.length;
            const hinted = inWindow.find(e => e.id === eventId);
            const e = unclear ? hinted || nearest(inWindow) :
                nearest(inWindow.filter(matches)) || hinted || nearest(inWindow);
            if (unclear || (e && e.targets.length > 1 && (!matches(e) || confidence < .72))) {
                // Keep the event available until its deadline. A clear retry
                // can replace uncertainty; an ambiguous reading never scores extra.
                if (e && this.mode !== 'learn') this.uncertain.add(e.id);
                return {
                    kind: 'uncertain',
                    event: e || undefined
                };
            }
            if (!e) {
                this.extras++;
                this.streak = 0;
                return {
                    kind: 'extra'
                };
            }
            if (!matches(e)) {
                this.wrong++;
                this.streak = 0;
                return {
                    kind: 'wrong',
                    event: e
                };
            }
            const seconds = this.mode === 'learn' ? 0 : error(e);
            const kind = this.mode === 'learn' || Math.abs(seconds) <= .065 ? 'correct' : seconds < 0 ? 'early' : 'late';
            const unexpected = pitches.filter(p => !e.targets.some(m => Math.abs(p - m) <= .45));
            this.extras += unexpected.length;
            const result = {
                kind,
                seconds,
                event: e,
                extra: unexpected.length
            };
            this.uncertain.delete(e.id);
            this.results.set(e.id, result);
            this.streak++;
            this.best = Math.max(this.best, this.streak);
            return result;
        }
        summary() {
            const values = [...this.results.values()];
            const hits = values.filter(r => ['correct', 'early', 'late'].includes(r.kind));
            const judged = values.filter(r => r.kind !== 'uncertain');
            const hitCount = hits.length + this.archived.hits,
                judgedCount = judged.length + this.archived.judged;
            return {
                total: this.events.filter(e => e.targets.length).length + this.archived.total,
                hits: hitCount,
                onTime: values.filter(r => r.kind === 'correct').length + this.archived.onTime,
                missed: values.filter(r => r.kind === 'missed').length + this.archived.missed,
                uncertain: values.filter(r => r.kind === 'uncertain').length + this.archived.uncertain,
                wrong: this.wrong,
                extras: this.extras,
                best: this.best,
                accuracy: judgedCount ? Math.round(100 * hitCount / judgedCount) : null,
                meanMs: hitCount ? Math.round((hits.reduce((s, r) => s + Math.abs(r.seconds), 0) + this.archived.seconds) / hitCount * 1000) : null
            };
        }
    }
    return {
        PPQ,
        tuning,
        frequency,
        noteName,
        barTicks,
        swungTick,
        compile,
        Transport,
        Session
    };
});
