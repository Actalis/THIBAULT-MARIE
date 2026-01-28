// Advanced Web Audio API Engine
let audioCtx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

// Map to store engine nodes per tank
// Structure: Source (Noise) -> Filter (RPM) -> Gain (Volume) -> Destination
const engines = new Map<string, { source: AudioBufferSourceNode, filter: BiquadFilterNode, gain: GainNode }>();

const getContext = () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        createNoiseBuffer();
    }
    return audioCtx;
};

// Create a Brown Noise buffer for a deep rumble engine sound
const createNoiseBuffer = () => {
    if (!audioCtx) return;
    const bufferSize = audioCtx.sampleRate * 2; // 2 seconds loop
    noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Brown noise algorithm (integrate white noise)
        lastOut = (lastOut + (0.02 * white)) / 1.02;
        data[i] = lastOut * 3.5; // Boost gain
    }
};

export const AudioSystem = {
    init: () => {
        getContext();
    },

    resume: () => {
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    },

    suspend: () => {
        if (audioCtx && audioCtx.state === 'running') {
            audioCtx.suspend();
        }
    },

    updateEngine: (tankId: string, speed: number, maxSpeed: number) => {
        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();
        if (!noiseBuffer) createNoiseBuffer();
        
        let engine = engines.get(tankId);

        // If tank is moving, ensure engine sound exists
        if (!engine) {
            const source = ctx.createBufferSource();
            source.buffer = noiseBuffer;
            source.loop = true;

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.Q.value = 1;

            const gain = ctx.createGain();
            gain.gain.value = 0;

            source.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            
            source.start();
            engine = { source, filter, gain };
            engines.set(tankId, engine);
        }

        // Modulate Pitch (Filter Frequency) and Volume based on speed
        // Minimum RPM (idle) vs Max RPM
        const speedRatio = Math.abs(speed) / maxSpeed;
        
        // Idle sound vs Moving sound
        // If speed is basically 0, volume should be 0 (requested: "s'éteindre quand il avance pas")
        const isMoving = speedRatio > 0.05;
        
        const targetFreq = isMoving ? 80 + (speedRatio * 200) : 0; 
        const targetVol = isMoving ? 0.2 + (speedRatio * 0.2) : 0; 

        // Smooth transitions
        engine.filter.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.1);
        engine.gain.gain.setTargetAtTime(targetVol, ctx.currentTime, 0.1);
    },

    stopEngine: (tankId: string) => {
        const engine = engines.get(tankId);
        if (engine) {
            const ctx = getContext();
            // Quick Fade out
            engine.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
            
            // Actually stop and remove after fade
            setTimeout(() => {
                // Check if it still exists (might have been restarted)
                const currentEngine = engines.get(tankId);
                if (currentEngine === engine) {
                    try { engine.source.stop(); } catch(e) {}
                    engine.source.disconnect();
                    engines.delete(tankId);
                }
            }, 150);
        }
    },

    stopAllEngines: () => {
        engines.forEach((engine) => {
            try { engine.source.stop(); } catch(e) {}
            engine.source.disconnect();
        });
        engines.clear();
    },

    shoot: () => {
        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Impulse shot
        osc.type = 'square';
        osc.frequency.setValueAtTime(120, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    },

    explode: () => {
        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();

        const bufferSize = ctx.sampleRate * 0.5; 
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500; // Lower frequency for heavier explosion

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.8, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        noise.start();
    },

    bigExplosion: () => {
        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();

        const bufferSize = ctx.sampleRate * 2.0; 
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        // Low rumble
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(100, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 1.5);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(1.0, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 2.0);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
    },
    
    metalImpact: () => {
        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();
        
        // Metallic Clang
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'square'; // Harsh metallic base
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.2);
        
        // Filter to make it sound like heavy metal
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(400, ctx.currentTime);
        filter.Q.value = 5;

        gain.gain.setValueAtTime(0.6, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    },
    
    uiClick: () => {
        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.05);
        
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
    },
    
    lap: () => {
        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.setValueAtTime(800, ctx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    },

    crush: () => {
        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();

        const bufferSize = ctx.sampleRate * 0.2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, ctx.currentTime);
        filter.frequency.linearRampToValueAtTime(50, ctx.currentTime + 0.2);
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
    },

    repair: () => {
        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.1);
        osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.2);
        
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
    }
};