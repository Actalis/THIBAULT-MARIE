

import { Tank, Bunker, TerrainZone, TerrainType, Turret, Drone, Mecha } from '../types';
import { TANK_SIZE, COLORS, GAME_WIDTH, GAME_HEIGHT, SOLDIER_SIZE, TURRET_COST_WOOD, TURRET_COST_STONE, BUNKER_UPGRADE_COST_STONE_L2, BUNKER_UPGRADE_COST_WOOD_L2 } from '../constants';
import { getTurretSlots } from './gameLogic';

// --- GESTION DU CACHE TEXTURE (Pour la performance) ---
let cachedGroundPattern: CanvasPattern | null = null;

const initGroundPattern = (ctx: CanvasRenderingContext2D) => {
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 200;
    patternCanvas.height = 200;
    const pCtx = patternCanvas.getContext('2d');
    if (!pCtx) return;

    // Fond
    pCtx.fillStyle = COLORS.background;
    pCtx.fillRect(0, 0, 200, 200);

    // Bruit (Noise)
    pCtx.fillStyle = 'rgba(0,0,0,0.15)';
    for (let i = 0; i < 400; i++) {
        const x = Math.random() * 200;
        const y = Math.random() * 200;
        const s = Math.random() * 2 + 1;
        pCtx.fillRect(x, y, s, s);
    }
    
    cachedGroundPattern = ctx.createPattern(patternCanvas, 'repeat');
};

// --- DESSIN DU SOL ---
export const drawGroundTexture = (ctx: CanvasRenderingContext2D) => {
    if (!cachedGroundPattern) {
        initGroundPattern(ctx);
    }
    if (cachedGroundPattern) {
        ctx.fillStyle = cachedGroundPattern;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    } else {
        ctx.fillStyle = COLORS.background;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
};

// --- DESSIN DES ZONES (Routes, Boue, Sable) ---
export const drawZone = (ctx: CanvasRenderingContext2D, zone: TerrainZone) => {
    ctx.save();
    
    if (zone.type === TerrainType.ASPHALT) {
        // Route
        ctx.fillStyle = '#1c1917';
        ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
        
        // Marquage au sol
        ctx.strokeStyle = '#d4d4d4'; 
        ctx.lineWidth = 4; 
        ctx.setLineDash([40, 40]);
        ctx.beginPath();
        if (zone.width > zone.height) { // Horizontal
            ctx.moveTo(zone.x, zone.y + zone.height/2); 
            ctx.lineTo(zone.x + zone.width, zone.y + zone.height/2);
        } else { // Vertical
            ctx.moveTo(zone.x + zone.width/2, zone.y); 
            ctx.lineTo(zone.x + zone.width/2, zone.y + zone.height);
        }
        ctx.stroke();
        
        // Bordures de route
        ctx.setLineDash([]);
        ctx.strokeStyle = '#404040';
        ctx.lineWidth = 2;
        ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);

    } else {
        // Terrains Naturels (Boue, Sable) avec dégradés
        let colorStart = COLORS.grass; 
        let colorEnd = 'rgba(0,0,0,0)';
        
        if (zone.type === TerrainType.MUD) { 
            colorStart = '#5d4037'; 
            colorEnd = 'rgba(93, 64, 55, 0)'; 
        } else if (zone.type === TerrainType.SAND) { 
            colorStart = COLORS.sand; // Updated sand color
            colorEnd = 'rgba(230, 194, 136, 0)'; // Fade out matching sand
        }
        
        // Sécurité pour le gradient
        if (zone.width > 0) {
            try {
                const gradient = ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, zone.width);
                gradient.addColorStop(0, colorStart); 
                gradient.addColorStop(0.8, colorStart); 
                gradient.addColorStop(1, colorEnd);
                ctx.fillStyle = gradient;
            } catch (e) {
                ctx.fillStyle = colorStart;
            }
        } else {
            ctx.fillStyle = colorStart;
        }
        
        ctx.beginPath(); 
        ctx.arc(zone.x, zone.y, zone.width, 0, Math.PI * 2); 
        ctx.fill();
    }
    ctx.restore();
};

// --- DESSIN DU TANK (Détaillé) ---
export const drawTank = (ctx: CanvasRenderingContext2D, tank: Tank, isReplayMode: boolean, now: number) => {
    if (!tank || isNaN(tank.x) || isNaN(tank.y)) return;

    let renderX = tank.x;
    let renderY = tank.y;

    // Shake effect
    if (tank.stunnedUntil > now) {
        renderX += (Math.random() - 0.5) * 4;
        renderY += (Math.random() - 0.5) * 4;
    } else if (tank.isMoving) {
        renderX += (Math.random() - 0.5) * 1.5;
        renderY += (Math.random() - 0.5) * 1.5;
    }

    ctx.save();
    ctx.translate(renderX, renderY);
    ctx.rotate(tank.angle + Math.PI / 2);

    if (tank.isSoldier) {
        // --- SOLDAT ---
        ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 5;
        ctx.fillStyle = tank.color;
        ctx.beginPath(); ctx.arc(0, 0, SOLDIER_SIZE/2, 0, Math.PI*2); ctx.fill();
        // Casque
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.arc(2, -2, 3, 0, Math.PI*2); ctx.fill();
        // Arme
        ctx.fillStyle = '#111'; ctx.fillRect(3, -SOLDIER_SIZE/2, 3, 12);
    } else {
        // --- TANK ---
        const scale = 1 + (tank.level - 1) * 0.1;
        ctx.scale(scale, scale);

        // Ombre portée globale
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 12; ctx.shadowOffsetX = 6; ctx.shadowOffsetY = 6;

        // 1. CHENILLES (Tracks)
        ctx.fillStyle = '#27272a'; // Gris très foncé
        ctx.fillRect(-TANK_SIZE/2 - 6, -TANK_SIZE/2, 12, TANK_SIZE); // Gauche
        ctx.fillRect(TANK_SIZE/2 - 6, -TANK_SIZE/2, 12, TANK_SIZE);  // Droite
        
        // Détails des maillons (Animation)
        ctx.shadowColor = 'transparent'; // Pas d'ombre sur les maillons
        const treadPattern = (tank.treadOffset || 0) % 10;
        ctx.fillStyle = '#3f3f46'; // Gris plus clair
        for(let i=0; i<6; i++) {
            const yPos = -TANK_SIZE/2 + ((i * 10 + treadPattern) % TANK_SIZE);
            if (yPos + 2 <= TANK_SIZE/2) { // Eviter de dessiner hors chenille
                ctx.fillRect(-TANK_SIZE/2 - 6, yPos, 12, 2);
                ctx.fillRect(TANK_SIZE/2 - 6, yPos, 12, 2);
            }
        }

        // 2. CORPS (Châssis)
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'; ctx.shadowBlur = 10;
        ctx.fillStyle = tank.color;
        ctx.fillRect(-TANK_SIZE/2 + 2, -TANK_SIZE/2 + 2, TANK_SIZE - 4, TANK_SIZE - 4);
        
        // Biseautage / Volume (Highlight haut, Ombre bas)
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; 
        ctx.fillRect(-TANK_SIZE/2 + 2, -TANK_SIZE/2 + 2, TANK_SIZE - 4, 6); // Top light
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; 
        ctx.fillRect(-TANK_SIZE/2 + 2, TANK_SIZE/2 - 8, TANK_SIZE - 4, 6); // Bottom shadow

        // --- CAMOUFLAGE (BRANCHES RAMASSÉES) ---
        // Dessiné sur le corps, avant la tourelle
        if (tank.attachedBranches && tank.attachedBranches > 0) {
            const branchColor = '#4a3728';
            ctx.fillStyle = branchColor;
            // Dessin pseudo-aléatoire basé sur l'ID et le nombre pour que ce soit stable mais varié
            const seed = tank.id.charCodeAt(tank.id.length-1); 
            const count = Math.min(10, tank.attachedBranches); // Max 10 branches visuelles
            
            for(let i=0; i<count; i++) {
                ctx.save();
                // Position aléatoire stable
                const rx = ((seed * (i+1) * 7) % 30) - 15;
                const ry = ((seed * (i+1) * 13) % 30) - 15;
                const rAngle = ((seed * (i+1)) % 360) * Math.PI / 180;
                
                ctx.translate(rx, ry);
                ctx.rotate(rAngle);
                ctx.fillStyle = i % 2 === 0 ? branchColor : '#1e5428'; // Alterne bois/feuille
                ctx.fillRect(-6, -1, 12, 2); // Branche
                ctx.restore();
            }
        }

        // 3. TOURELLE
        ctx.shadowBlur = 5; ctx.shadowOffsetX = 2;
        
        // Canon
        ctx.fillStyle = '#4b5563'; 
        const barrelW = 14; 
        const barrelL = TANK_SIZE/2 + 14;
        ctx.fillRect(-barrelW/2, -barrelL + 10, barrelW, barrelL); 
        // Bout du canon
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(-barrelW/2 - 2, -barrelL + 10, barrelW + 4, 6);

        // Dôme Tourelle
        ctx.fillStyle = '#374151'; 
        ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI*2); ctx.fill();
        
        // Ecoutille
        ctx.fillStyle = '#1f2937'; 
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = tank.color; // Petite touche de couleur sur l'écoutille
        ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();

    // BARRE DE VIE
    drawHealthBar(ctx, renderX, renderY - (tank.isSoldier ? 20 : 50), tank.health, tank.maxHealth, tank.isSoldier ? 20 : 50);
};

const drawHealthBar = (ctx: CanvasRenderingContext2D, x: number, y: number, current: number, max: number, width: number) => {
    const pct = Math.max(0, Math.min(1, current / max));
    // Fond
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(x - width/2 - 2, y - 2, width + 4, 8);
    // Barre colorée
    ctx.fillStyle = pct > 0.5 ? '#22c55e' : (pct > 0.25 ? '#fbbf24' : '#ef4444');
    ctx.fillRect(x - width/2, y, width * pct, 4);
    // Reflet glossy
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x - width/2, y, width * pct, 2);
};

// --- BUNKER ---
export const drawBunker = (ctx: CanvasRenderingContext2D, bunker: Bunker, now: number) => {
    if (!bunker || isNaN(bunker.x)) return;

    ctx.save();
    ctx.translate(bunker.x, bunker.y);

    if (bunker.health <= 0) {
        ctx.fillStyle = '#1c1917'; 
        ctx.beginPath(); ctx.arc(bunker.width/2, bunker.height/2, bunker.width/2.5, 0, Math.PI*2); ctx.fill();
        ctx.restore(); 
        return;
    }

    const hpPercent = Math.max(0, bunker.health / bunker.maxHealth);
    const damage = 1 - hpPercent;

    // Bouclier Électrique
    if (bunker.hasShield) {
        const pulse = Math.sin(now / 200) * 4;
        ctx.beginPath(); ctx.arc(bunker.width/2, bunker.height/2, bunker.width/1.5 + pulse, 0, Math.PI*2);
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.4 + Math.sin(now/100)*0.2})`; 
        ctx.lineWidth = 3; ctx.stroke();
    }

    // Corps Métallique
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 20;
    // Visuel différent pour niveau 2
    if (bunker.level >= 2) {
        // Forme plus high-tech
        ctx.fillStyle = '#1e293b'; // Bleu nuit métallique
        ctx.beginPath();
        // Octogone arrondi
        const s = bunker.width;
        ctx.moveTo(s*0.2, 0); ctx.lineTo(s*0.8, 0); ctx.lineTo(s, s*0.2); ctx.lineTo(s, s*0.8);
        ctx.lineTo(s*0.8, s); ctx.lineTo(s*0.2, s); ctx.lineTo(0, s*0.8); ctx.lineTo(0, s*0.2);
        ctx.closePath();
        ctx.fill();
        
        // Détails Tech
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.stroke();
    } else {
        // Niveau 1 standard
        ctx.fillStyle = '#44403c'; 
        ctx.fillRect(0, 0, bunker.width, bunker.height);
        
        // Plaques de blindage (Détail)
        ctx.strokeStyle = '#57534e'; ctx.lineWidth = 2;
        ctx.strokeRect(4, 4, bunker.width-8, bunker.height-8);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(15, 15); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bunker.width, 0); ctx.lineTo(bunker.width-15, 15); ctx.stroke();
    }

    
    // Assombrissement Dégâts
    if (damage > 0.1) {
        ctx.fillStyle = `rgba(0,0,0,${damage * 0.7})`;
        ctx.fillRect(0, 0, bunker.width, bunker.height);
    }

    // Fissures
    if (damage > 0.3) {
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(10, 10); ctx.lineTo(35, 35); ctx.lineTo(25, 50);
        if(damage > 0.6) { ctx.moveTo(bunker.width-10, 20); ctx.lineTo(bunker.width-40, 50); }
        ctx.stroke();
    }

    // --- INDICATEUR D'UPGRADE DISPONIBLE (Lumière Verte Clignotante) ---
    // Condition : Niveau 1, Assez de ressources
    if (bunker.level === 1 && bunker.storedWood >= BUNKER_UPGRADE_COST_WOOD_L2 && bunker.storedStone >= BUNKER_UPGRADE_COST_STONE_L2) {
        const pulse = (Math.sin(now / 150) + 1) / 2; // 0 à 1 rapide
        
        ctx.save();
        ctx.translate(bunker.width/2, bunker.height/2);
        
        // Aura
        ctx.fillStyle = `rgba(34, 197, 94, ${pulse * 0.5})`; 
        ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI*2); ctx.fill();
        
        // Lumière centrale
        ctx.fillStyle = `rgba(74, 222, 128, ${0.5 + pulse * 0.5})`;
        ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 20 * pulse;
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
        
        // Texte "UPGRADE"
        if (pulse > 0.5) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px "Rajdhani"';
            ctx.textAlign = 'center';
            ctx.fillText("READY", 0, 4);
        }
        
        ctx.restore();
    }

    // --- EFFETS SPECIAUX DE DOMMAGES (Fumée et Feu) ---
    // Procedural effects using canvas drawing instead of particle system for performance in this view
    if (hpPercent < 0.5) {
        // FUMÉE (Cercles gris qui montent)
        ctx.fillStyle = 'rgba(50, 50, 50, 0.4)';
        for(let i=0; i<3; i++) {
            const offset = (now / 1000 + i * 1.5) % 1; // 0 to 1 loop
            const x = bunker.width/2 + Math.sin(now/500 + i)*20;
            const y = bunker.height/2 - offset * 40;
            const size = 10 + offset * 15;
            ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI*2); ctx.fill();
        }
    }
    
    if (hpPercent < 0.25) {
        // FEU (Triangles oranges/jaunes)
        for(let i=0; i<5; i++) {
            const flicker = Math.random() * 0.3 + 0.7;
            const fx = bunker.width/2 + (Math.random()-0.5) * 40;
            const fy = bunker.height/2 + (Math.random()-0.5) * 40;
            ctx.fillStyle = Math.random() > 0.5 ? '#ef4444' : '#fbbf24'; // Rouge ou Jaune
            ctx.beginPath();
            ctx.moveTo(fx, fy);
            ctx.lineTo(fx - 5, fy + 10 * flicker);
            ctx.lineTo(fx + 5, fy + 10 * flicker);
            ctx.fill();
        }
    }

    // --- VISUALISATION DES RESSOURCES ---
    // Afficher chaque item individuellement (Empilage)
    
    // BOIS
    if (bunker.storedWood > 0) {
        ctx.fillStyle = '#4a3728'; // Marron
        ctx.save();
        const startX = 20;
        const startY = bunker.height - 25;
        ctx.translate(startX, startY); // Coin bas gauche intérieur
        
        // Empilage style pyramide/tas
        const cols = 3;
        const visualCount = Math.min(bunker.storedWood, 12); // Cap visuel pour ne pas déborder
        for(let i=0; i<visualCount; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            // Décalage pour effet tas
            const offsetX = col * 6 + (row % 2) * 3;
            const offsetY = -row * 4; 
            
            ctx.fillRect(offsetX, offsetY, 14, 3); // Bûche
            // Détail bois
            ctx.fillStyle = '#6d543e';
            ctx.fillRect(offsetX+2, offsetY, 2, 3);
            ctx.fillStyle = '#4a3728';
        }
        
        // CHIFFRE GROS AU DESSUS DU TAS
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.font = 'bold 16px "Rajdhani"';
        ctx.textAlign = 'center';
        ctx.fillText(`${bunker.storedWood}`, 15, -Math.floor(visualCount/cols)*4 - 5);
        ctx.shadowBlur = 0;

        ctx.restore();
    }

    // PIERRES
    if (bunker.storedStone > 0) {
        ctx.fillStyle = '#78716c'; // Gris
        ctx.save();
        const startX = bunker.width - 40;
        const startY = bunker.height - 25;
        ctx.translate(startX, startY); // Coin bas droit intérieur
        
        const cols = 3;
        const visualCount = Math.min(bunker.storedStone, 12);
        for(let i=0; i<visualCount; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            
            const offsetX = col * 7 + (row % 2) * 3;
            const offsetY = -row * 5;
            
            ctx.beginPath();
            // Forme irrégulière simple
            const s = 3 + (i%2);
            ctx.arc(offsetX, offsetY, s, 0, Math.PI*2);
            ctx.fill();
            
            // Ombre
            ctx.strokeStyle = '#44403c';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // CHIFFRE GROS AU DESSUS DU TAS
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.font = 'bold 16px "Rajdhani"';
        ctx.textAlign = 'center';
        ctx.fillText(`${bunker.storedStone}`, 15, -Math.floor(visualCount/cols)*5 - 5);
        ctx.shadowBlur = 0;

        ctx.restore();
    }

    // --- EMPLACEMENTS DE TOURELLE (SLOTS) ---
    // On dessine les slots aux 4 coins si pas déjà construits
    const canBuild = bunker.storedWood >= TURRET_COST_WOOD && bunker.storedStone >= TURRET_COST_STONE;
    const slots = getTurretSlots(bunker); // [TL, TR, BL, BR]
    
    // Pour ne pas dépendre du state global ici, on suppose que si le bunker.turretBuildStatus[i] n'est pas -1, on dessine le slot
    if (bunker.turretBuildStatus) {
        bunker.turretBuildStatus.forEach((status, i) => {
            // Si status est -1, la tourelle est construite et gérée par l'entité Turret, on ne dessine pas le slot
            if (status !== -1) {
                // Position relative au bunker pour le dessin local
                // getTurretSlots retourne des coords absolues, on doit convertir en relatif
                const absX = slots[i].x;
                const absY = slots[i].y;
                const relX = absX - bunker.x;
                const relY = absY - bunker.y;

                ctx.save();
                ctx.translate(relX, relY);
                
                // Indicateur de slot
                ctx.beginPath();
                ctx.arc(0, 0, 10, 0, Math.PI*2);
                
                if (canBuild) {
                    // Prêt à construire
                    ctx.fillStyle = 'rgba(34, 197, 94, 0.3)'; // Vert transparent
                    ctx.strokeStyle = '#22c55e'; // Vert
                    ctx.lineWidth = 2;
                    // Effet de pulse
                    const pulse = Math.sin(now/200) * 2;
                    ctx.shadowColor = '#22c55e';
                    ctx.shadowBlur = 5 + pulse;
                } else {
                    // Pas assez de ressources
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; 
                    ctx.strokeStyle = '#57534e'; // Gris foncé
                    ctx.lineWidth = 1;
                    ctx.shadowBlur = 0;
                }
                
                ctx.fill();
                ctx.stroke();

                // Indicateur de progression (1 tir sur 2)
                if (status === 1) {
                    ctx.fillStyle = '#fbbf24'; // Jaune pour "en cours"
                    ctx.beginPath();
                    ctx.arc(0, 0, 5, 0, Math.PI*2);
                    ctx.fill();
                }

                ctx.restore();
            }
        });
    }
    
    // BARRE DE VIE = BANDE DE COULEUR
    // La bande se réduit en largeur selon la vie
    ctx.fillStyle = '#0f0f10'; // Fond de la jauge (noir/vide)
    ctx.fillRect(0, bunker.height - 12, bunker.width, 12);
    
    ctx.fillStyle = bunker.color; // Couleur du joueur
    ctx.fillRect(0, bunker.height - 12, bunker.width * hpPercent, 12);
    
    // Effet visuel sur la bande (Glassy)
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(0, bunker.height - 12, bunker.width * hpPercent, 6);

    // Centre High-Tech
    if (bunker.level >= 2) {
        ctx.fillStyle = '#52525b'; 
        ctx.beginPath(); ctx.arc(bunker.width/2, bunker.height/2, 28, 0, Math.PI*2); ctx.fill();
        
        // LED Status
        const blink = Math.sin(now / 500) > 0;
        ctx.fillStyle = blink && damage < 0.8 ? '#10b981' : '#ef4444';
        ctx.beginPath(); ctx.arc(bunker.width/2, bunker.height/2, 6, 0, Math.PI*2); ctx.fill();
    }
    
    // Suppression du texte récapitulatif en haut (remplacé par les chiffres sur les piles)

    ctx.restore();
}

// --- AUTRES ENTITÉS ---

export const drawTurret = (ctx: CanvasRenderingContext2D, turret: Turret, color: string, now: number) => {
    ctx.save(); ctx.translate(turret.x, turret.y);
    // Base
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 8;
    ctx.fillStyle = '#44403c'; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI*2); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.stroke();
    
    // Rotation Canon
    ctx.rotate(turret.angle); 
    ctx.fillStyle = '#1f2937'; ctx.fillRect(-10, -10, 20, 20); // Pivot
    ctx.fillStyle = '#374151'; ctx.fillRect(0, -5, 26, 10); // Canon
    ctx.fillStyle = '#111'; ctx.fillRect(26, -5, 4, 10); // Bout
    
    ctx.restore();
};

export const drawGhostTurret = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
};

export const drawDrone = (ctx: CanvasRenderingContext2D, drone: Drone, color: string, now: number) => {
    ctx.save(); ctx.translate(drone.x, drone.y);
    const bob = Math.sin(now / 150) * 3; ctx.translate(0, bob);
    
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 15 - bob; 
    
    // Corps
    ctx.fillStyle = '#1e293b'; 
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI*2); ctx.fill();
    
    // Oeil / Core
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill();

    // Hélices
    const spin = now / 40;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.save(); ctx.rotate(spin); ctx.fillRect(-14, -2, 28, 4); ctx.fillRect(-2, -14, 4, 28); ctx.restore();
    
    ctx.restore();
};

export const drawMecha = (ctx: CanvasRenderingContext2D, mecha: Mecha, color: string, now: number) => {
    ctx.save(); ctx.translate(mecha.x, mecha.y);
    const walk = Math.sin(now/150)*4;
    
    // Jambes
    ctx.fillStyle = '#333';
    ctx.fillRect(-18, -10+walk, 8, 20); // Gauche
    ctx.fillRect(10, -10-walk, 8, 20);  // Droite

    // Corps
    ctx.fillStyle = color; 
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(15, 0); ctx.lineTo(0, 20); ctx.lineTo(-15, 0); ctx.fill();
    
    // Cockpit
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(-6, -8, 12, 8);
    
    ctx.restore();
};

export const drawWreck = (ctx: CanvasRenderingContext2D, tank: Tank, now: number, isReplayMode: boolean) => {
    if(!tank) return;
    ctx.save(); ctx.translate(tank.x, tank.y); ctx.rotate(tank.angle + Math.PI / 2);
    
    ctx.fillStyle = '#292524'; // Carbonisé
    ctx.fillRect(-TANK_SIZE/2, -TANK_SIZE/2, TANK_SIZE, TANK_SIZE);
    
    // Fumée (si récent) - Optionnel pour ne pas surcharger
    ctx.fillStyle = '#000'; 
    ctx.beginPath(); ctx.arc(5, 5, 10, 0, Math.PI*2); ctx.fill();
    
    ctx.restore();
};
