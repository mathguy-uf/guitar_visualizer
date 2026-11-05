(function() {
    'use strict';
    let context = null,
        stream = null,
        owner = null,
        onLost = null,
        generation = 0;

    function release(who) {
        if (who && who !== owner) return;
        generation++;
        const lost = onLost;
        onLost = null;
        owner = null;
        stream?.getTracks().forEach(t => t.stop());
        stream = null;
        lost?.();
    }

    function ensureContext() {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) throw Error('Audio is not supported in this browser.');
        if (!context || context.state === 'closed') context = new Audio({
            latencyHint: 'interactive'
        });
        return context;
    }
    async function acquire(who, lost) {
        release();
        owner = who;
        onLost = lost;
        const token = generation;
        const ctx = ensureContext();
        // Resume on the initiating touch, before awaiting microphone permission.
        const resumed = ctx.resume();
        try {
            if (!navigator.mediaDevices?.getUserMedia) throw Error('Microphone access needs HTTPS in a supported browser. You can still listen to exercises.');
            const acquired = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                },
                video: false
            });
            if (token !== generation || owner !== who) {
                acquired.getTracks().forEach(t => t.stop());
                throw new DOMException('Microphone request cancelled', 'AbortError');
            }
            stream = acquired;
            await resumed;
            if (token !== generation) throw new DOMException('Microphone request cancelled', 'AbortError');
            const track = stream.getAudioTracks()[0];
            track.addEventListener('ended', () => {
                if (owner === who) release(who);
            });
            return {
                context: ctx,
                stream,
                source: ctx.createMediaStreamSource(stream)
            };
        } catch (error) {
            if (token === generation) release(who);
            throw error;
        }
    }
    async function listen(handle, callback) {
        if (!handle.context.audioWorklet || typeof Worker === 'undefined') throw Error('Live listening needs AudioWorklet support. You can still use Listen to learn the pattern.');
        await handle.context.audioWorklet.addModule('js/capture-worklet.js');
        const worker = new Worker('js/analysis-worker.js');
        const node = new AudioWorkletNode(handle.context, 'guitar-capture');
        const mute = handle.context.createGain();
        mute.gain.value = 0;
        let inFlight = false,
            pending = null,
            active = true;
        const send = data => {
            inFlight = true;
            worker.postMessage(data, [data.samples.buffer]);
        };
        node.port.onmessage = ({
            data
        }) => {
            if (inFlight) pending = data;
            else send(data);
        };
        worker.onmessage = ({
            data
        }) => {
            if (!active) return;
            inFlight = false;
            callback(data);
            if (active && pending) {
                const newest = pending;
                pending = null;
                send(newest);
            }
        };
        worker.onerror = () => callback({
            type: 'error',
            message: 'Listening stopped unexpectedly. Pause and tap Start to try again.'
        });
        handle.source.connect(node);
        node.connect(mute).connect(handle.context.destination);
        let version = 0;
        return {
            target(expected) {
                worker.postMessage({
                    type: 'target',
                    expected,
                    version: ++version
                });
                return version;
            },
            floor(floor) {
                worker.postMessage({
                    type: 'floor',
                    floor
                });
            },
            reset() {
                worker.postMessage({
                    type: 'reset'
                });
            },
            stop() {
                active = false;
                pending = null;
                node.port.onmessage = null;
                worker.onmessage = null;
                worker.onerror = null;
                handle.source.disconnect();
                node.disconnect();
                mute.disconnect();
                worker.terminate();
            }
        };
    }

    function click(ctx, time, accent = false, destination = ctx.destination) {
        const osc = ctx.createOscillator(),
            gain = ctx.createGain();
        osc.frequency.value = accent ? 1300 : 900;
        gain.gain.setValueAtTime(.0001, time);
        gain.gain.exponentialRampToValueAtTime(.08, time + .002);
        gain.gain.exponentialRampToValueAtTime(.0001, time + .035);
        osc.connect(gain).connect(destination);
        osc.start(time);
        osc.stop(time + .04);
        osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
        };
    }

    function pluck(ctx, time, midi, duration = .5, destination = ctx.destination) {
        const osc = ctx.createOscillator(),
            gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = GuitarMusic.frequency(midi);
        gain.gain.setValueAtTime(.0001, time);
        gain.gain.exponentialRampToValueAtTime(.10, time + .006);
        gain.gain.exponentialRampToValueAtTime(.0001, time + Math.max(.08, duration));
        osc.connect(gain).connect(destination);
        osc.start(time);
        osc.stop(time + Math.max(.1, duration) + .02);
        osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
        };
    }

    function message(error) {
        return error.name === 'NotAllowedError' ? 'Microphone permission was denied. Allow it in Safari’s website settings, then try again. Listen works without a microphone.' : error.name === 'NotFoundError' ? 'No microphone was found. Connect one, or use Listen.' : error.message || 'Could not start the microphone. Please try again.';
    }
    window.GuitarAudio = {
        acquire,
        release,
        listen,
        ensureContext,
        click,
        pluck,
        message,
        get owner() {
            return owner;
        }
    };
    window.addEventListener('pagehide', () => {
        release();
        context?.suspend();
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) release();
    });
})();
