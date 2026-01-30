

import { TerrainZone, Tank, Particle, TerrainType } from '../types';
import { WATER_COLLECT_INTERVAL, MAX_WATER_CAPACITY } from '../constants';
import { AudioSystem } from './audio';

// --- VISUELS EAU "WEB DESIGN STYLE" ---
// Au lieu d'une simulation physique lourde, on utilise des gradients radiaux lissés
// qui suivent le mouvement du tank pour créer une traînée fluide et moderne.

// Perturber l'eau : On ne fait rien de physique, c'est purement visuel via le renderer
export const disturbWater = (x: number, y: number, strength: number, zone: TerrainZone) => {
    // No-op
};

export const updateWaterPhysics = () => {
    // No-op
};

// --- RENDER ---

export const drawWater = (ctx: CanvasRenderingContext2D, zone: TerrainZone, now: number) => {
    if (zone.type !== TerrainType.WATER) return;

    ctx.save();
    
    // 1. FORME ORGANIQUE (BLOB)
    const steps = 30;
    const baseRadius = zone.width; 
    const seed = zone.x + zone.y;
    
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        // Bruit très lent pour respiration organique
        const noise = Math.sin(angle * 3 + seed + now/5000) * 8 + Math.cos(angle * 5 + seed) * 4;
        const r = baseRadius + noise;
        
        const px = zone.x + Math.cos(angle) * r;
        const py = zone.y + Math.sin(angle) * r;
        
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();

    // 2. RIVAGE LUMINEUX (Glow effect)
    ctx.shadowColor = '#0ea5e9'; // Sky 500 (plus clair)
    ctx.shadowBlur = 20;
    
    // Fond Global Semi-Transparent
    ctx.globalAlpha = 0.5; // SEMI-TRANSPARENT
    ctx.fillStyle = '#0c4a6e'; // Sky 900
    ctx.fill();
    ctx.shadowBlur = 0; // Reset

    // 3. MASQUE pour l'intérieur
    ctx.clip(); 

    // Fond dégradé profond
    const gradient = ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, zone.width);
    gradient.addColorStop(0, '#0c4a6e'); // Sky 900
    gradient.addColorStop(1, 'rgba(12, 74, 110, 0.5)'); // Bords plus clairs
    ctx.fillStyle = gradient; 
    ctx.fill();

    // 4. EFFET CAUSTIQUE "WEB DESIGN" (Traînées fluides simulées)
    // On dessine des cercles translucides qui bougent doucement
    ctx.globalCompositeOperation = 'source-over'; // Standard blending is fine with low opacity

    const time = now / 3000;
    const numBlobs = 8;
    
    for (let i = 0; i < numBlobs; i++) {
        const angle = i * ((Math.PI * 2) / numBlobs) + time;
        const dist = (zone.width * 0.4) + Math.sin(time * 2 + i) * 30;
        
        const x = zone.x + Math.cos(angle) * dist;
        const y = zone.y + Math.sin(angle) * dist;
        
        // Taille variable
        const size = 60 + Math.sin(time * 3 + i) * 20;

        // Blob semi-transparent
        ctx.fillStyle = 'rgba(56, 189, 248, 0.1)'; 
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    // 5. REFLET SPECULAIRE FLUIDE (Surface)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.ellipse(zone.x - 20, zone.y - 20, zone.width * 0.6, zone.height * 0.3, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
};

// --- INTERACTION & COLLECTE ---
export const resolveWaterInteraction = (
    tank: Tank, 
    zone: TerrainZone, 
    now: number, 
    particlesRef: Particle[]
) => {
    if (zone.type !== TerrainType.WATER || tank.health <= 0) return;

    // Détection
    let inWater = false;
    if (zone.shape === 'rect') {
        if (tank.x >= zone.x && tank.x <= zone.x + zone.width && tank.y >= zone.y && tank.y <= zone.y + zone.height) inWater = true;
    } else {
        const dx = tank.x - zone.x;
        const dy = tank.y - zone.y;
        if (dx*dx + dy*dy < (zone.width - 15) * (zone.width - 15)) inWater = true;
    }

    if (inWater) {
        // --- EFFET DE TRAÎNÉE (Sillage Tank) ---
        // On dessine un cercle lumineux sous le tank via particules "soft"
        if (tank.isMoving && Math.random() > 0.6) {
             particlesRef.push({
                id: `wake-glow-${now}-${Math.random()}`,
                x: tank.x, y: tank.y,
                vx: 0, vy: 0,
                life: 60, maxLife: 60, size: 20, // Grand
                color: 'rgba(56, 189, 248, 0.1)', // Très subtil
                type: 'ripple' 
            });
        }

        // --- COLLECTE D'EAU ---
        // Vérification Capacité MAX
        if (tank.waterCount < MAX_WATER_CAPACITY) {
            if (!tank.lastWaterCollectTime) tank.lastWaterCollectTime = 0;
            
            if (now - tank.lastWaterCollectTime > WATER_COLLECT_INTERVAL) {
                tank.waterCount++;
                tank.lastWaterCollectTime = now;
                
                AudioSystem.waterDrop(); // "Bloop"
                
                // Effet visuel "Pop" bulle bleue
                particlesRef.push({
                    id: `water-pop-${now}`,
                    x: tank.x, y: tank.y - 30,
                    vx: 0, vy: -1.5,
                    life: 40, maxLife: 40, size: 0, 
                    color: '#38bdf8', 
                    type: 'spark'
                });
            }
        }
    }
};
