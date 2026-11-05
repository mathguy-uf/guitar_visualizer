/* Rhythm guides and repeating practice selections share the musical tick clock. */
(function(root, factory) {
    const music = typeof module === 'object' && module.exports ? require('./music.js') : root.GuitarMusic;
    const api = factory(music);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.GuitarRhythm = api;
})(globalThis, M => {
    'use strict';
    const Q = M.PPQ;
    const mod = (n, d) => ((n % d) + d) % d;
    const xAt = (tick, cursor, pixelsPerQuarter, playheadX) => playheadX + (tick - cursor) / Q * pixelsPerQuarter;

    function countStyle(exercise) {
        if (exercise.meter[1] === 8 && exercise.meter[0] % 3 === 0) return 'compound';
        if (exercise.count) return exercise.count;
        const times = exercise.events.flatMap(e => [e.tick, e.duration]);
        if (times.some(t => t % 240 !== 0) && times.every(t => t % 320 === 0)) return 'triplet';
        if (times.some(t => t % 480 !== 0)) return 'sixteenth';
        if (times.some(t => t % Q !== 0)) return 'eighth';
        return 'quarter';
    }

    function sustainEnd(events, event, note, limit = Infinity) {
        let end = event.tick + note.duration;
        for (const later of events) {
            if (Math.abs(later.tick - end) > 1e-6) continue;
            const tied = later.notes.find(n => n.tie && n.midi === note.midi && n.string === note.string);
            if (tied) end = later.tick + tied.duration;
        }
        return Math.min(end, limit);
    }

    function selection(exercise, swing = 0, first = 1, last = null) {
        const bar = M.barTicks(exercise.meter),
            total = Math.ceil(exercise.length / bar);
        first = Math.max(1, Math.min(total, Math.trunc(first) || 1));
        last = Math.max(first, Math.min(total, Math.trunc(last) || total));
        const start = (first - 1) * bar,
            end = Math.min(exercise.length, last * bar),
            groups = new Map();
        const add = (tick, note, rest = null) => {
            if (!groups.has(tick)) groups.set(tick, {
                tick,
                notes: [],
                rests: [],
                duration: 0,
                accent: false,
                sourceTick: start + tick
            });
            const g = groups.get(tick);
            if (note) {
                const existing = g.notes.find(n => n.string === note.string && n.fret === note.fret);
                if (existing) {
                    existing.duration = Math.max(existing.duration, note.duration);
                    existing.tie &&= note.tie;
                } else g.notes.push(note);
                g.duration = Math.max(g.duration, note.duration);
            }
            if (rest) {
                g.rests.push(rest);
                g.duration = Math.max(g.duration, rest.duration);
            }
            return g;
        };
        for (const event of M.compile(exercise, swing)) {
            if (event.tick >= end) break;
            if (event.tick >= start) {
                for (const n of event.notes) {
                    add(event.tick - start, {
                        ...n,
                        duration: Math.min(n.duration, end - event.tick),
                        tie: event.tick === start ? false : n.tie
                    }).accent = event.accent;
                }
                for (const rest of event.rests || []) {
                    add(event.tick - start, null, {
                        ...rest,
                        duration: Math.min(rest.duration, end - event.tick)
                    });
                }
                if (!event.notes.length && !event.rests?.length) add(event.tick - start, null, {
                    voice: 'all',
                    duration: Math.min(event.duration, end - event.tick)
                });
            } else {
                // A sustained note crossing into the selection needs a fresh
                // pluck at its beginning, once per pass, rather than a missing tie.
                for (const n of event.notes)
                    if (event.tick + n.duration > start) {
                        add(0, {
                            ...n,
                            tie: false,
                            duration: Math.min(event.tick + n.duration, end) - start
                        });
                    }
            }
        }
        const events = [...groups.values()].sort((a, b) => a.tick - b.tick).map((g, id) => ({
            ...g,
            id,
            targets: [...new Set(g.notes.filter(n => !n.tie).map(n => n.midi))]
        }));
        const chords = [];
        const initial = exercise.chords.filter(c => c.tick <= start).at(-1);
        if (initial) chords.push({
            tick: 0,
            chord: initial.chord
        });
        for (const c of exercise.chords)
            if (c.tick > start && c.tick < end) chords.push({
                tick: c.tick - start,
                chord: c.chord
            });
        return {
            events,
            chords,
            start,
            end,
            length: end - start,
            first,
            last,
            bar,
            total
        };
    }
    class Timeline {
        constructor(exercise, {
            swing = 0,
            first = 1,
            last = null,
            loop = false
        } = {}) {
            Object.assign(this, selection(exercise, swing, first, last));
            this.exercise = exercise;
            this.swing = swing;
            this.loop = loop;
            this.template = this.events;
            this.events = [];
            this.nextCycle = 0;
            this.style = countStyle(exercise);
            this.counts = [];
            const [beats, denominator] = exercise.meter;
            const divisions = this.style === 'sixteenth' ? 4 : this.style === 'triplet' ? 3 : this.style === 'eighth' ? 2 : 1;
            const step = this.style === 'compound' ? Q * 4 / denominator : Q / divisions;
            for (let raw = this.start; raw < this.end; raw += step) {
                const part = Math.round(mod(raw, Q) / step),
                    beat = Math.floor(mod(raw, this.bar) / (this.style === 'compound' ? step : Q)) + 1;
                const label = this.style === 'compound' || part === 0 ? String(beat) : this.style === 'sixteenth' ? ['', 'e', '&', 'a'][part] : this.style === 'triplet' ? ['', 'trip', 'let'][part] : '&';
                const strong = this.style === 'compound' ? (beat - 1) % 3 === 0 : part === 0;
                this.counts.push({
                    tick: M.swungTick(raw, swing, ['compound', 'triplet'].includes(this.style)) - this.start,
                    label,
                    spoken: label === String(beat) ? label : `${beat} ${label}`,
                    strong,
                    measure: Math.floor(raw / this.bar) + 1,
                    barStart: raw % this.bar === 0,
                    sourceTick: raw
                });
            }
            this.ensureThrough(0);
        }
        ensureThrough(tick) {
            const last = this.loop ? Math.floor(Math.max(0, tick) / this.length) + 1 : 0;
            while (this.nextCycle <= last) {
                const cycle = this.nextCycle++;
                for (let i = 0; i < this.template.length; i++) {
                    const e = this.template[i];
                    this.events.push({
                        ...e,
                        id: cycle * this.template.length + i,
                        tick: e.tick + cycle * this.length,
                        cycle
                    });
                }
            }
        }
        guides(from, to) {
            const first = this.loop ? Math.max(0, Math.floor(from / this.length)) : 0;
            const last = this.loop ? Math.max(0, Math.floor(to / this.length)) : 0;
            const out = [];
            for (let cycle = first; cycle <= last; cycle++)
                for (const g of this.counts) {
                    const tick = g.tick + cycle * this.length;
                    if (tick >= from && tick <= to) out.push({
                        ...g,
                        tick,
                        cycle
                    });
                }
            return out;
        }
        infoAt(tick) {
            const cycle = this.loop ? Math.max(0, Math.floor(tick / this.length)) : 0;
            const local = this.loop ? mod(Math.max(0, tick), this.length) : Math.max(0, Math.min(this.length - 1e-6, tick));
            return {
                cycle,
                local,
                pass: cycle + 1,
                measure: this.first + Math.floor(local / this.bar)
            };
        }
        countAt(tick) {
            const info = this.infoAt(tick);
            return [...this.counts].reverse().find(g => g.tick <= info.local + 1e-6) || this.counts[0];
        }
        chordAt(tick) {
            const {
                local,
                cycle
            } = this.infoAt(tick);
            const current = this.chords.filter(c => c.tick <= local).at(-1);
            const next = this.chords.find(c => c.tick > local && c.chord !== current?.chord);
            const wrapped = !next && this.loop ? this.chords.find(c => c.chord !== current?.chord) : null;
            return {
                current: current?.chord || 'Open strings',
                next: next?.chord || wrapped?.chord || null,
                nextTick: next ? cycle * this.length + next.tick : wrapped ? (cycle + 1) * this.length + wrapped.tick : null
            };
        }
    }
    return {
        countStyle,
        xAt,
        sustainEnd,
        selection,
        Timeline
    };
});
