
import { TerrainZone, Tank, Particle, TerrainType } from '../types';
import { TANK_SIZE, WATER_COLLECT_INTERVAL } from '../constants';
import { AudioSystem } from './audio';

// --- SIMULATION PHYSIQUE DE L'EAU (Algorithme Ripple) ---

const COLS = 60; // Résolution de la grille d'eau
const ROWS = 60;
const DAMPING = 0.96;

let buffer1: Float32Array;
let buffer2: Float32Array;
let isInitialized = false;

// Initialisation de la grille
const initWaterGrid = () => {
    if (isInitialized) return;
    buffer1 = new Float32Array(COLS * ROWS).fill(0);
    buffer2 = new Float32Array(COLS * ROWS).fill(0);
    isInitialized = true;
};

// Perturber l'eau à une position donnée
export const disturbWater = (x: number, y: number, strength: number, zone: TerrainZone) => {
    if (!isInitialized) initWaterGrid();

    // Convertir coord monde -> coord grille
    // On assume que la zone est centrée sur le lac principal
    const gridX = Math.floor(((x - zone.x) / (zone.width * 2) + 0.5) * COLS);
    const gridY = Math.floor(((y - zone.y) / (zone.height * 2) + 0.5) * ROWS);

    if (gridX > 1 && gridX < COLS - 2 && gridY > 1 && gridY < ROWS - 2) {
        // Impact sur une petite zone
        buffer1[gridX + gridY * COLS] += strength;
        buffer1[(gridX+1) + gridY * COLS] += strength * 0.5;
        buffer1[(gridX-1) + gridY * COLS] += strength * 0.5;
        buffer1[gridX + (gridY+1) * COLS] += strength * 0.5;
        buffer1[gridX + (gridY-1) * COLS] += strength * 0.5;
    }
};

export const updateWaterPhysics = () => {
    if (!isInitialized) return;

    // Propagation des ondes
    for (let y = 1; y < ROWS - 1; y++) {
        for (let x = 1; x < COLS - 1; x++) {
            const idx = x + y * COLS;
            const val = (
                buffer1[x - 1 + y * COLS] +
                buffer1[x + 1 + y * COLS] +
                buffer1[x + (y - 1) * COLS] +
                buffer1[x + (y + 1) * COLS]
            ) / 2 - buffer2[idx];
            
            buffer2[idx] = val * DAMPING;
        }
    }

    // Swap buffers
    const temp = buffer1;
    buffer1 = buffer2;
    buffer2 = temp;
};

// --- VISUELS ---

export const drawWater = (ctx: CanvasRenderingContext2D, zone: TerrainZone, now: number) => {
    if (zone.type !== TerrainType.WATER) return;
    if (!isInitialized) initWaterGrid();

    ctx.save();
    
    // Découpage de la zone (Clip)
    ctx.beginPath();
    if (zone.shape === 'rect') {
        ctx.rect(zone.x, zone.y, zone.width, zone.height);
    } else {
        ctx.arc(zone.x, zone.y, zone.width, 0, Math.PI * 2);
    }
    ctx.clip();

    // Fond bleu de base
    ctx.fillStyle = '#0ea5e9'; 
    ctx.fill();

    // Rendu des reflets basé sur la simulation
    // On ne dessine pas pixel par pixel (trop lent), on dessine des formes simples là où l'onde est haute
    // Ou on dessine une grille déformée
    
    const cellW = (zone.width * 2) / COLS;
    const cellH = (zone.height * 2) / ROWS;
    
    // Pour optimiser, on ne dessine que les points avec une hauteur significative
    // Et on applique un dégradé global
    
    // Reflets Speculaires du soleil (simulé)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    
    for (let y = 1; y < ROWS - 1; y += 1) {
        for (let x = 1; x < COLS - 1; x += 1) {
            const h = buffer1[x + y * COLS];
            
            if (Math.abs(h) > 0.1) {
                const posX = (zone.x - zone.width) + x * cellW;
                const posY = (zone.y - zone.height) + y * cellH;
                
                // Dessiner un reflet
                const intensity = Math.min(1, Math.abs(h) / 5);
                if (h > 0) {
                    ctx.fillStyle = `rgba(255, 255, 255, ${intensity * 0.6})`;
                    ctx.fillRect(posX, posY, cellW + 1, cellH + 1);
                } else {
                    ctx.fillStyle = `rgba(0, 50, 100, ${intensity * 0.4})`; // Ombre
                    ctx.fillRect(posX, posY, cellW + 1, cellH + 1);
                }
            }
        }
    }
    
    // Bordure brillante
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.5)';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.restore();
};

// --- PHYSIQUE & INTERACTION ---
export const resolveWaterInteraction = (
    tank: Tank, 
    zone: TerrainZone, 
    now: number, 
    particlesRef: Particle[]
) => {
    if (zone.type !== TerrainType.WATER || tank.health <= 0) return;

    // Détection collision Tank - Zone Eau
    let inWater = false;
    let distFromCenter = 0;
    
    const dx = tank.x - zone.x;
    const dy = tank.y - zone.y;
    const distSq = dx*dx + dy*dy;
    
    if (zone.shape === 'rect') {
        if (tank.x >= zone.x && tank.x <= zone.x + zone.width && tank.y >= zone.y && tank.y <= zone.y + zone.height) {
            inWater = true;
        }
    } else {
        if (distSq < zone.width * zone.width) {
            inWater = true;
            distFromCenter = Math.sqrt(distSq);
        }
    }

    if (inWater) {
        // 1. Déformer l'eau si le tank bouge
        if (tank.isMoving) {
            const speed = Math.sqrt(tank.vx*tank.vx + tank.vy*tank.vy);
            if (speed > 0.1) {
                // Perturber la grille derrière le tank
                const wakeX = tank.x - Math.cos(tank.angle) * 20;
                const wakeY = tank.y - Math.sin(tank.angle) * 20;
                disturbWater(wakeX, wakeY, speed * 2, zone);
                
                // Son d'éclaboussure léger si pas déjà joué
                if (Math.random() < 0.05) {
                    // AudioSystem.splash(); // TODO implémenter
                }
            }
        }

        // 2. Collecte d'eau temporisée (1 unité toutes les 5 secondes)
        if (!tank.lastWaterCollectTime) tank.lastWaterCollectTime = 0;
        
        if (now - tank.lastWaterCollectTime > WATER_COLLECT_INTERVAL) {
            tank.waterCount = (tank.waterCount || 0) + 1;
            tank.lastWaterCollectTime = now;
            AudioSystem.pickup(); // Son de collecte
            
            // Feedback visuel (petit +1 bleu)
            particlesRef.push({
                id: `water-pop-${now}`,
                x: tank.x, y: tank.y - 30,
                vx: 0, vy: -1,
                life: 60, maxLife: 60, size: 0, color: '#38bdf8', type: 'spark' // Type spark générique pour le moment
            });
            // Onde circulaire à la collecte
            disturbWater(tank.x, tank.y, 10, zone);
        }
    }
};
