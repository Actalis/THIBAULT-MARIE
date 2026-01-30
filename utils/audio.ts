

import { TerrainType } from '../types';
import { Assets } from './AssetManager';

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

    updateEngine: (tankId: string, speed: number, maxSpeed: number, terrain: TerrainType = TerrainType.GRASS, isBlocked: boolean = false) => {
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
        const isMoving = speedRatio > 0.05;
        
        let baseFreq = 80;
        let baseVol = 0.2;
        
        // Terrain Sound Modification
        if (terrain === TerrainType.MUD) {
            baseFreq = 60; // Deeper, struggling
            engine.filter.Q.value = 0.5; // More muffled
        } else if (terrain === TerrainType.ASPHALT) {
            baseFreq = 100; // Higher, cleaner
            engine.filter.Q.value = 2; // More resonance
        } else {
            engine.filter.Q.value = 1; // Default
        }

        let targetFreq = isMoving ? baseFreq + (speedRatio * 200) : 0; 
        const targetVol = isMoving ? baseVol + (speedRatio * 0.2) : 0; 

        // LOGIQUE DE BLOCAGE : Si le tank force contre un mur, le son devient grave (moteur qui peine)
        if (isMoving && isBlocked) {
            targetFreq /= 3;
            engine.filter.Q.value = 0.5; // Son plus étouffé
        }

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

    // --- SOUND FX ---

    cinematicBoom: () => {
        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();

        // Deep Drum / Timpani
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(100, ctx.currentTime); // Lower pitch
        osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 1.5);
        
        gain.gain.setValueAtTime(2.0, ctx.currentTime); // LOUDER
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 3.0); // Longer tail

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 3.0);

        // Noise Burst impact (High freq snap)
        const bSize = ctx.sampleRate * 0.5;
        const b = ctx.createBuffer(1, bSize, ctx.sampleRate);
        const d = b.getChannelData(0);
        for(let i=0; i<bSize; i++) d[i] = Math.random() * 2 - 1;
        const n = ctx.createBufferSource();
        n.buffer = b;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.8, ctx.currentTime);
        ng.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        
        n.connect(ng);
        ng.connect(ctx.destination);
        n.start();
    },

    waterDrop: () => {
        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        // Son grave qui descend (Bloop profond)
        osc.frequency.setValueAtTime(350, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
        
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.02); // Attaque douce
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
    },

    cinematicBrass: (pitch: number = 200) => {
        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();

        // Sawtooth for brassy sound
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(pitch, ctx.currentTime);
        
        filter.type = 'lowpass';
        filter.Q.value = 2;
        filter.frequency.setValueAtTime(pitch * 2, ctx.currentTime);
        filter.frequency.linearRampToValueAtTime(pitch * 4, ctx.currentTime + 0.1); // Brass "swell"

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.8);
    },

    shoot: () => {
        const source = Assets.playSound('shoot_light', 0.6);
        if (source) return;

        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

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
        filter.frequency.value = 500;

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
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.2);
        
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
    },

    pickup: () => {
        const source = Assets.playSound('pickup', 0.5);
        if (source) return;

        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    },

    bushImpact: () => {
        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();

        const bufferSize = ctx.sampleRate * 0.4; // Slightly longer for rustle
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        // Bandpass lower and broader for a softer leaf sound
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(400, ctx.currentTime); // Lower frequency (was 800)
        filter.Q.value = 0.5; // Wider band (was 1)

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.2, ctx.currentTime); // Lower volume (was 0.4)
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4); // Gentle fade out

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
    },

    win: () => {
        const source = Assets.playSound('win', 0.6);
        if (source) return;

        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        const now = ctx.currentTime;
        
        // Epic Bass Drop
        const bassOsc = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(100, now);
        bassOsc.frequency.exponentialRampToValueAtTime(30, now + 2);
        bassGain.gain.setValueAtTime(0.8, now);
        bassGain.gain.exponentialRampToValueAtTime(0.01, now + 3);
        bassOsc.connect(bassGain);
        bassGain.connect(ctx.destination);
        bassOsc.start();
        bassOsc.stop(now + 3);

        // Major chord build-up (Cinematic)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(261.63, now); // C4
        osc.frequency.setValueAtTime(329.63, now + 0.5); // E4
        osc.frequency.setValueAtTime(392.00, now + 1.0); // G4
        osc.frequency.setValueAtTime(523.25, now + 1.5); // C5
        
        // Lowpass filter swell
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, now);
        filter.frequency.linearRampToValueAtTime(2000, now + 2);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 2);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 6);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(now + 6);
    }
};
