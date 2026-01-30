

import { Tank, Bunker, TerrainZone, TerrainType, Turret, Drone, Mecha, RepairStation, TankClass, MunitionsFactory, WeaponType, Debris, DebrisType } from '../types';
import { TANK_SIZE, COLORS, GAME_WIDTH, GAME_HEIGHT, SOLDIER_SIZE, TURRET_COST_WOOD, TURRET_COST_STONE, BUNKER_UPGRADE_COST_STONE_L2, BUNKER_UPGRADE_COST_WOOD_L2, MAX_WATER_CAPACITY, BUNKER_WATER_MAX_CAPACITY, REPAIR_STATION_COST_WATER, REPAIR_STATION_COST_WOOD, REPAIR_STATION_COST_STONE, FACTORY_COST_WOOD, FACTORY_COST_STONE, REPAIR_STATION_BUILD_HITS, FACTORY_BUILD_HITS } from '../constants';
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

    // Bruit (Noise) plus subtil
    pCtx.fillStyle = 'rgba(0,0,0,0.1)';
    for (let i = 0; i < 600; i++) {
        const x = Math.random() * 200;
        const y = Math.random() * 200;
        const s = Math.random() * 2;
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
export const drawZone = (ctx: CanvasRenderingContext2D, zone: TerrainZone, now: number = 0) => {
    ctx.save();
    
    if (zone.type === TerrainType.ASPHALT) {
        // Route (Style Industriel) - Reste opaque
        ctx.fillStyle = '#1c1917';
        ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
        
        // Marquage au sol
        ctx.strokeStyle = '#525252'; 
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

    } else if (zone.type === TerrainType.SAND) {
        // --- SABLE (Semi-Transparent pour fusionner avec le sol) ---
        // Opacité réduite : laisse voir le grain du sol en dessous
        ctx.globalAlpha = 0.5; 
        const seed = zone.x + zone.y;
        
        ctx.beginPath();
        const steps = 24;
        for(let i=0; i<=steps; i++) {
            const a = (i/steps)*Math.PI*2;
            const r = zone.width + Math.sin(a*4 + seed)*5; 
            ctx.lineTo(zone.x + Math.cos(a)*r, zone.y + Math.sin(a)*r);
        }
        ctx.closePath();
        
        // Contour flou (Transition douce)
        ctx.shadowColor = '#d97706'; 
        ctx.shadowBlur = 30; 
        ctx.fillStyle = '#fcd34d'; 
        ctx.fill();
        ctx.shadowBlur = 0;

        // Pas de clipping complexe ici pour garder la perf et la douceur
        // Juste un remplissage doux
        ctx.fillStyle = '#f59e0b'; // Amber 500
        ctx.fill();

    } else if (zone.type === TerrainType.MUD) {
        // --- BOUE (Semi-Transparent) ---
        ctx.globalAlpha = 0.6;
        const seed = zone.x * zone.y;
        
        ctx.beginPath();
        const steps = 18;
        for(let i=0; i<=steps; i++) {
            const a = (i/steps)*Math.PI*2;
            const noise = Math.sin(a*3 + seed) * 10 + Math.cos(a*7 + seed) * 5;
            const r = zone.width + noise; 
            ctx.lineTo(zone.x + Math.cos(a)*r, zone.y + Math.sin(a)*r);
        }
        ctx.closePath();
        
        // Contour flou
        ctx.shadowColor = '#451a03'; 
        ctx.shadowBlur = 20; 
        ctx.fillStyle = '#451a03';
        ctx.fill();
        ctx.shadowBlur = 0;

        // Texture simple par dessus
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        for(let i=0; i<3; i++) {
             const bx = zone.x + Math.sin(i*2.5 + seed)*zone.width*0.4;
             const by = zone.y + Math.cos(i*3.1 + seed)*zone.width*0.4;
             const bs = zone.width * 0.3;
             ctx.beginPath(); ctx.arc(bx, by, bs, 0, Math.PI*2); ctx.fill();
        }

    } else {
        // Fallback Herbe
        ctx.globalAlpha = 0.3;
        const gradient = ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, zone.width);
        gradient.addColorStop(0, '#3f6212'); 
        gradient.addColorStop(1, 'rgba(63, 98, 18, 0)'); 
        ctx.fillStyle = gradient;
        ctx.beginPath(); 
        ctx.arc(zone.x, zone.y, zone.width, 0, Math.PI * 2); 
        ctx.fill();
    }
    ctx.restore();
};

const drawHealthBar = (ctx: CanvasRenderingContext2D, x: number, y: number, current: number, max: number, width: number) => {
    // Calcul de la taille d'un segment
    const segmentCount = Math.ceil(max);
    const spacing = 2; // Espace entre les carrés
    const totalSpacing = (segmentCount - 1) * spacing;
    const segmentWidth = (width - totalSpacing) / segmentCount;
    
    // Centrage
    const startX = x - width / 2;

    for (let i = 0; i < segmentCount; i++) {
        // Position du segment
        const segX = startX + i * (segmentWidth + spacing);
        
        // Couleur
        // Si le point de vie courant (i+1) est inférieur ou égal à la santé actuelle, il est plein
        // Sinon il est vide (gris foncé)
        if (i < current) {
            const pct = current / max;
            ctx.fillStyle = pct > 0.5 ? '#22c55e' : (pct > 0.25 ? '#fbbf24' : '#ef4444');
        } else {
            ctx.fillStyle = '#1c1917'; // Vide
        }

        // Dessin du carré/rectangle
        ctx.fillRect(segX, y, segmentWidth, 6); // Hauteur fixe de 6px
        
        // Contour léger pour la netteté
        if (i < current) {
            ctx.fillStyle = 'rgba(255,255,255,0.3)'; // Highlight
            ctx.fillRect(segX, y, segmentWidth, 3);
        }
    }
};

// --- DESSIN DU TANK (Détaillé) ---
export const drawTank = (ctx: CanvasRenderingContext2D, tank: Tank, isReplayMode: boolean, now: number) => {
    if (!tank || isNaN(tank.x) || isNaN(tank.y)) return;

    let renderX = tank.x;
    let renderY = tank.y;

    // Shake effect (Au sol seulement)
    if (tank.stunnedUntil > now && tank.altitude <= 0) {
        renderX += (Math.random() - 0.5) * 4;
        renderY += (Math.random() - 0.5) * 4;
    } else if (tank.isMoving && !tank.isSoldier) { 
        renderX += (Math.random() - 0.5) * 1.5;
        renderY += (Math.random() - 0.5) * 1.5;
    }

    // Gestion EJECTION / ALTITUDE
    const altitude = tank.altitude || 0;
    const isAirborne = altitude > 0;
    
    // 1. OMBRE (Toujours au sol)
    ctx.save();
    ctx.translate(renderX, renderY);
    ctx.rotate(tank.angle + Math.PI / 2);
    
    if (tank.isSoldier) {
        // Ombre soldat (rétrécit avec l'altitude)
        const shadowScale = Math.max(0.2, 1 - (altitude / 200));
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath(); 
        ctx.ellipse(0, 0, (SOLDIER_SIZE/2) * shadowScale, (SOLDIER_SIZE/4) * shadowScale, 0, 0, Math.PI*2);
        ctx.fill();
    } else {
        // Ombre tank normale (déjà gérée dans le render du tank via shadowBlur, mais on peut renforcer ici si besoin)
    }
    ctx.restore();

    // 2. CORPS (Décalé par l'altitude + Effet de zoom)
    ctx.save();
    // Le tank/soldat est dessiné plus haut (Y - altitude)
    // Et on scale pour simuler qu'il se rapproche de la caméra (Z-axis)
    ctx.translate(renderX, renderY - altitude);
    
    // Effet "proche caméra" : Scale up
    const zScale = 1 + (altitude / 100); 
    ctx.scale(zScale, zScale);
    
    ctx.rotate(tank.angle + Math.PI / 2);

    if (tank.isSoldier) {
        // --- PARACHUTE (Si en train de tomber) ---
        // On le dessine DERRIERE le soldat, et en GRANDE TAILLE
        if (isAirborne && tank.verticalVelocity < 0) {
            ctx.save();
            ctx.translate(0, -10); // Un peu au dessus de la tête
            // Cordes
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-15, -40); ctx.lineTo(0, 0); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(15, -40); ctx.lineTo(0, 0); ctx.stroke();
            
            // Toile du parachute (Plus grand pour visibilité)
            ctx.fillStyle = tank.color; // Couleur du joueur
            ctx.beginPath();
            ctx.arc(0, -40, 25, Math.PI, 0); // Demi-cercle large
            ctx.lineTo(25, -40);
            ctx.quadraticCurveTo(0, -50, -25, -40);
            ctx.fill();
            ctx.strokeStyle = '#222'; ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
        }

        // --- SOLDAT (Corps) ---
        // Corps
        ctx.fillStyle = tank.color;
        ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 5;
        ctx.beginPath(); ctx.arc(0, 0, SOLDIER_SIZE/2, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0; // Reset
        
        // Casque
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.arc(2, -2, 3, 0, Math.PI*2); ctx.fill();
        
        // Bras & Arme (Mitraillette)
        ctx.fillStyle = '#111'; 
        ctx.fillRect(4, -SOLDIER_SIZE/2, 3, 14); // Canon
        ctx.fillStyle = '#333';
        ctx.fillRect(2, -SOLDIER_SIZE/4, 4, 6); // Crosse
        
        // Animation de marche (pieds) ou jambes qui pendent (air)
        if (isAirborne) {
            // Jambes qui pendent et s'agitent
            const legWiggle = Math.sin(now / 50) * 2;
            ctx.fillStyle = '#000';
            ctx.fillRect(-6, 2 + legWiggle, 4, 4); 
            ctx.fillRect(2, 2 - legWiggle, 4, 4); 
        } else if (tank.isMoving) {
            const step = Math.sin(now / 100) * 3;
            ctx.fillStyle = '#000';
            ctx.fillRect(-6, 2 + step, 4, 4); // Pied gauche
            ctx.fillRect(2, 2 - step, 4, 4); // Pied droit
        }

    } else {
        // --- TANK (Reste inchangé) ---
        const scale = 1 + (tank.level - 1) * 0.1;
        ctx.scale(scale, scale);

        // Ombre portée globale
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 12; ctx.shadowOffsetX = 6; ctx.shadowOffsetY = 6;

        // AJUSTEMENTS SELON LA CLASSE
        let bodyWidth = TANK_SIZE - 4;
        let barrelW = 14;
        let barrelL = TANK_SIZE/2 + 14;

        if (tank.tankClass === TankClass.HEAVY) {
            bodyWidth += 4; // Corps plus large
            barrelW += 4; // Canon plus gros
            barrelL -= 4; // Canon plus court
        } else if (tank.tankClass === TankClass.SNIPER) {
            bodyWidth -= 4; // Corps plus fin
            barrelW -= 4; // Canon plus fin
            barrelL += 20; // Canon beaucoup plus long
        } else if (tank.tankClass === TankClass.SCOUT) {
            bodyWidth -= 8; // Corps très petit
            barrelL -= 10; // Canon court
        }

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
        // On centre le corps ajusté
        ctx.fillRect(-bodyWidth/2, -TANK_SIZE/2 + 2, bodyWidth, TANK_SIZE - 4);
        
        // Biseautage / Volume (Highlight haut, Ombre bas)
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; 
        ctx.fillRect(-bodyWidth/2, -TANK_SIZE/2 + 2, bodyWidth, 6); // Top light
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; 
        ctx.fillRect(-bodyWidth/2, TANK_SIZE/2 - 8, bodyWidth, 6); // Bottom shadow

        // --- VISUEL SOUS L'EAU (Half Submerged) ---
        if (tank.isInWater) {
            // Calque bleu semi-transparent sur la moitié inférieure
            // Le tank est tourné de 90° dans le canvas (haut vers bas), donc "bas" est Y+
            ctx.fillStyle = 'rgba(14, 165, 233, 0.6)'; // Sky 500 avec alpha
            // On dessine un rectangle qui couvre la moitié "arrière" du tank
            ctx.fillRect(-TANK_SIZE/2, 0, TANK_SIZE, TANK_SIZE/2);
            
            // On ajoute une teinte bleue globale
            ctx.fillStyle = 'rgba(14, 165, 233, 0.2)';
            ctx.fillRect(-TANK_SIZE/2, -TANK_SIZE/2, TANK_SIZE, TANK_SIZE);
        }

        // --- BONBONNES D'EAU (ARRIÈRE DU TANK) ---
        // Max 4 bonbonnes, affichées en ligne à l'arrière
        if (tank.waterCount > 0) {
            const bottleRadius = 4;
            const startX = -((Math.min(tank.waterCount, 4) - 1) * (bottleRadius * 2 + 2)) / 2;
            const yPos = TANK_SIZE/2 - 2; // Tout à l'arrière

            for(let i=0; i < Math.min(tank.waterCount, 4); i++) {
                ctx.save();
                ctx.translate(startX + i * (bottleRadius * 2 + 2), yPos);
                
                // Bonbonne Bleue
                ctx.fillStyle = '#0ea5e9'; // Sky 500
                ctx.shadowColor = '#0ea5e9'; ctx.shadowBlur = 4;
                ctx.beginPath(); ctx.arc(0, 0, bottleRadius, 0, Math.PI*2); ctx.fill();
                
                // Reflet
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(-1, -1, 1.5, 0, Math.PI*2); ctx.fill();
                
                ctx.restore();
            }
        }

        // --- RESSOURCES COLLECTÉES (PIERRES & BRANCHES) ---
        // Dessin des PIERRES sur le tank
        if (tank.stoneCount && tank.stoneCount > 0) {
            const stoneCount = Math.min(8, tank.stoneCount);
            const seed = tank.id.charCodeAt(0);
            
            for(let i=0; i<stoneCount; i++) {
                ctx.save();
                // Position pseudo-aléatoire sur le châssis
                const sx = ((seed * (i+2) * 11) % 20) - 10;
                const sy = ((seed * (i+3) * 17) % 30) - 15;
                
                ctx.translate(sx, sy);
                ctx.fillStyle = '#78716c'; // Gris Pierre
                ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 2;
                
                // Forme irrégulière
                ctx.beginPath();
                ctx.arc(0, 0, 3 + (i%2), 0, Math.PI*2);
                ctx.fill();
                ctx.restore();
            }
        }

        // Dessin des BRANCHES sur le tank
        if (tank.attachedBranches && tank.attachedBranches > 0) {
            const branchColor = '#4a3728';
            ctx.fillStyle = branchColor;
            const seed = tank.id.charCodeAt(tank.id.length-1); 
            const count = Math.min(10, tank.attachedBranches); 
            
            for(let i=0; i<count; i++) {
                ctx.save();
                const rx = ((seed * (i+1) * 7) % 30) - 15;
                const ry = ((seed * (i+1) * 13) % 30) - 15;
                const rAngle = ((seed * (i+1)) % 360) * Math.PI / 180;
                
                ctx.translate(rx, ry);
                ctx.rotate(rAngle);
                ctx.fillStyle = i % 2 === 0 ? branchColor : '#1e5428'; 
                ctx.fillRect(-6, -1, 12, 2); 
                ctx.restore();
            }
        }

        // 3. TOURELLE
        ctx.shadowBlur = 5; ctx.shadowOffsetX = 2;
        
        // Canon
        ctx.fillStyle = '#4b5563'; 
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

    // BARRE DE VIE (Ne pas afficher si en l'air ou mort, sauf pour voir qui c'est)
    if (!isAirborne) {
        drawHealthBar(ctx, renderX, renderY - (tank.isSoldier ? 20 : 50), tank.health, tank.maxHealth, tank.isSoldier ? 30 : 60);
    }
};

// --- NOUVELLES FONCTIONS DESSIN ---

export const drawBunker = (ctx: CanvasRenderingContext2D, bunker: Bunker, now: number) => {
    if (bunker.health <= 0) return;

    ctx.save();
    ctx.translate(bunker.x + bunker.width / 2, bunker.y + bunker.height / 2);

    // --- STYLE PILLBOX / BÉTON ARMÉ ---
    
    // Ombre portée
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(-bunker.width/2 + 5, -bunker.height/2 + 5, bunker.width, bunker.height, 10);
    ctx.fill();

    // Base Béton (Pillbox) - Arrondi
    const baseColor = bunker.level >= 2 ? '#4b5563' : '#374151'; // Plus clair si amélioré
    ctx.fillStyle = baseColor;
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 4;
    
    ctx.beginPath();
    ctx.roundRect(-bunker.width/2, -bunker.height/2, bunker.width, bunker.height, 8);
    ctx.fill();
    ctx.stroke();

    // Toit (Cercle blindé)
    ctx.fillStyle = '#1f2937'; // Sombre
    ctx.beginPath();
    ctx.arc(0, 0, bunker.width/3, 0, Math.PI*2);
    ctx.fill();
    
    // Slit (Meurtrière) - Rectangle noir pour tirer
    ctx.fillStyle = '#000';
    ctx.fillRect(-15, 10, 30, 6);

    // Rivets / Renforts aux coins
    ctx.fillStyle = '#9ca3af'; // Métal clair
    const corners = [
        {x: -bunker.width/2 + 8, y: -bunker.height/2 + 8},
        {x: bunker.width/2 - 8, y: -bunker.height/2 + 8},
        {x: -bunker.width/2 + 8, y: bunker.height/2 - 8},
        {x: bunker.width/2 - 8, y: bunker.height/2 - 8}
    ];
    corners.forEach(c => {
        ctx.beginPath(); ctx.arc(c.x, c.y, 3, 0, Math.PI*2); ctx.fill();
    });

    // Drapeau / Couleur du joueur (Petit cercle)
    ctx.fillStyle = bunker.color;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Level indicator (Barres sur le côté)
    if (bunker.level >= 2) {
        ctx.fillStyle = '#fbbf24'; // Or
        ctx.fillRect(-bunker.width/2 - 4, -10, 4, 20); // Barre verticale latérale
    }

    // Resource Indicators (Texte bien visible sur le toit)
    const startX = -bunker.width/2 + 10;
    let currentY = -bunker.height/2 + 15; // En haut à gauche, DANS le bunker
    
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 2; // Ombre texte pour lisibilité
    
    // Wood Indicator
    if (bunker.storedWood > 0) {
        ctx.fillStyle = '#fcd34d'; // Jaune clair pour contraste sur fond gris
        ctx.fillText(`W:${bunker.storedWood}`, startX, currentY);
        currentY += 14;
    }
    // Stone Indicator
    if (bunker.storedStone > 0) {
        ctx.fillStyle = '#d6d3d1'; // Gris clair pour contraste
        ctx.fillText(`S:${bunker.storedStone}`, startX, currentY);
    }
    ctx.shadowBlur = 0; // Reset
    
    // Water Bottles (Autour du bunker, comme avant)
    if (bunker.storedWater > 0) {
         const maxWater = BUNKER_WATER_MAX_CAPACITY;
         const displayCount = Math.min(bunker.storedWater, maxWater);
         const radius = bunker.width / 2 + 8; 
         for (let i = 0; i < displayCount; i++) {
            const angle = (i / maxWater) * Math.PI * 2 + (now / 5000); 
            const bx = Math.cos(angle) * radius;
            const by = Math.sin(angle) * radius;
            
            ctx.fillStyle = '#0ea5e9';
            ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI*2); ctx.fill();
         }
    }

    // Shield effect if any
    if (bunker.hasShield) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.3 + Math.sin(now/200)*0.1;
        ctx.beginPath();
        ctx.arc(0, 0, bunker.width/2 + 15, 0, Math.PI*2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    }
    
    // Turret Build Status (Ghost turrets on corners)
    const tCorners = [
        {x: -bunker.width/2, y: -bunker.height/2}, // TL
        {x: bunker.width/2, y: -bunker.height/2},  // TR
        {x: -bunker.width/2, y: bunker.height/2}, // BL
        {x: bunker.width/2, y: bunker.height/2}   // BR
    ];
    
    bunker.turretBuildStatus.forEach((status, i) => {
        if (status >= 0) { 
             ctx.save();
             ctx.translate(tCorners[i].x, tCorners[i].y);
             ctx.globalAlpha = 0.5;
             ctx.fillStyle = '#333'; // Base sombre
             ctx.beginPath(); ctx.arc(0,0, 8, 0, Math.PI*2); ctx.fill();
             
             if (status > 0) {
                 ctx.strokeStyle = '#4ade80'; // Vert construction
                 ctx.lineWidth = 2;
                 ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(4, 4); ctx.moveTo(4, -4); ctx.lineTo(-4, 4); ctx.stroke();
             }
             ctx.restore();
        }
    });

    ctx.restore();

    drawHealthBar(ctx, bunker.x + bunker.width/2, bunker.y - 10, bunker.health, bunker.maxHealth, bunker.width);
};

export const drawRepairStation = (ctx: CanvasRenderingContext2D, station: RepairStation, now: number, ownerTank?: Tank, ownerBunker?: Bunker) => {
    ctx.save();
    ctx.translate(station.x + station.width/2, station.y + station.height/2);

    if (!station.isBuilt) {
        // Blueprint
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = '#22c55e'; // Green dashed
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(-station.width/2, -station.height/2, station.width, station.height);
        
        if (station.buildHits > 0) {
            ctx.fillStyle = '#22c55e';
            const progress = station.buildHits / REPAIR_STATION_BUILD_HITS;
            ctx.fillRect(-station.width/2, station.height/2 + 5, station.width * progress, 4);
        }
        
        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText("REPAIR", 0, 0);

    } else {
        // Built
        ctx.fillStyle = '#3f3f46'; // Dark gray pad
        ctx.fillRect(-station.width/2, -station.height/2, station.width, station.height);
        
        // Cross
        ctx.fillStyle = '#22c55e'; // Green Cross
        ctx.fillRect(-5, -15, 10, 30);
        ctx.fillRect(-15, -5, 30, 10);
        
        // Active/Charging effect
        const pulse = Math.sin(now/200) * 0.2 + 0.8;
        ctx.strokeStyle = `rgba(34, 197, 94, ${pulse})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(-station.width/2 + 2, -station.height/2 + 2, station.width - 4, station.height - 4);
    }
    
    ctx.restore();
};

export const drawMunitionsFactory = (ctx: CanvasRenderingContext2D, factory: MunitionsFactory, now: number, ownerTank?: Tank, ownerBunker?: Bunker) => {
    ctx.save();
    ctx.translate(factory.x + factory.width/2, factory.y + factory.height/2);

    if (!factory.isBuilt) {
        // Blueprint
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = '#f59e0b'; // Amber dashed
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(-factory.width/2, -factory.height/2, factory.width, factory.height);
        
        if (factory.buildHits > 0) {
            ctx.fillStyle = '#f59e0b';
            const progress = factory.buildHits / FACTORY_BUILD_HITS;
            ctx.fillRect(-factory.width/2, factory.height/2 + 5, factory.width * progress, 4);
        }
        
        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText("AMMO", 0, 0);

    } else {
        // Built
        ctx.fillStyle = '#292524'; // Very dark stone
        ctx.fillRect(-factory.width/2, -factory.height/2, factory.width, factory.height);
        
        // Industrial stripes
        ctx.fillStyle = '#f59e0b';
        for(let i=0; i<3; i++) {
            ctx.fillRect(-factory.width/2 + 5 + i*15, -factory.height/2, 10, factory.height);
        }
        
        // Production Bar
        if (factory.readyAmmoType === null) {
            ctx.fillStyle = '#444';
            ctx.fillRect(-factory.width/2 + 2, -factory.height/2 + 2, 4, factory.height - 4);
            
            ctx.fillStyle = '#ef4444'; // Progress bar
            const h = (factory.productionProgress / 100) * (factory.height - 4);
            ctx.fillRect(-factory.width/2 + 2, factory.height/2 - 2 - h, 4, h);
        } else {
            // Ammo Box ready
            ctx.fillStyle = '#10b981'; // Green light
            ctx.beginPath(); ctx.arc(0, -15, 3, 0, Math.PI*2); ctx.fill();
            
            // Crate
            ctx.fillStyle = '#78350f'; // Wood
            ctx.fillRect(-10, -5, 20, 20);
            ctx.strokeStyle = '#fbbf24';
            ctx.strokeRect(-10, -5, 20, 20);
            
            // Icon
            ctx.fillStyle = '#fbbf24';
            ctx.textAlign = 'center';
            ctx.fillText(factory.readyAmmoType === 'HEAVY' ? 'HVY' : 'BNC', 0, 8);
        }
    }

    ctx.restore();
};

export const drawTurret = (ctx: CanvasRenderingContext2D, turret: Turret, color: string, now: number) => {
    if (turret.health <= 0) return;
    ctx.save();
    ctx.translate(turret.x, turret.y);
    
    // Base
    ctx.fillStyle = '#374151';
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI*2); ctx.fill();
    
    // Rotating part
    ctx.rotate(turret.angle);
    // Barrel
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, -6, 25, 12);
    // Head
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
    
    ctx.restore();
    
    drawHealthBar(ctx, turret.x, turret.y - 25, turret.health, turret.maxHealth, 30);
};

export const drawDrone = (ctx: CanvasRenderingContext2D, drone: Drone, color: string, now: number) => {
    ctx.save();
    ctx.translate(drone.x, drone.y);
    
    // Propellers
    ctx.rotate(now / 50);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(-12, -2, 24, 4);
    ctx.fillRect(-2, -12, 4, 24);
    
    // Body
    ctx.rotate(-now / 50); // cancel rotation
    ctx.fillStyle = '#1f2937';
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.fill();
    
    ctx.restore();
    
    drawHealthBar(ctx, drone.x, drone.y - 15, drone.health, drone.maxHealth, 20);
};

export const drawDebris = (ctx: CanvasRenderingContext2D, debris: Debris) => {
    ctx.save();
    ctx.translate(debris.x, debris.y);
    ctx.rotate(debris.rotation);
    
    if (debris.type === DebrisType.TANK_WRECK) {
        // Tank Wreck
        ctx.fillStyle = '#1c1917'; // dark stone
        ctx.fillRect(-debris.size/2, -debris.size/2, debris.size, debris.size);
        // Broken turret hint
        ctx.fillStyle = '#292524';
        ctx.rotate(0.5);
        ctx.fillRect(-10, -10, 20, 20);
    } else if (debris.type === DebrisType.STONE) {
         ctx.fillStyle = debris.color || '#a8a29e';
         ctx.beginPath(); ctx.arc(0,0, debris.size/2, 0, Math.PI*2); ctx.fill();
    } else {
         // Generic
         ctx.fillStyle = debris.color;
         ctx.fillRect(-debris.size/2, -debris.size/2, debris.size, debris.size);
    }
    ctx.restore();
};

export const drawWreck = (ctx: CanvasRenderingContext2D, tank: Tank, now: number, isReplay: boolean) => {
    ctx.save();
    ctx.translate(tank.x, tank.y);
    ctx.rotate(tank.angle);
    
    ctx.fillStyle = '#292524'; 
    ctx.fillRect(-tank.width/2, -tank.height/2, tank.width, tank.height);
    
    ctx.fillStyle = '#1c1917';
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill();
    
    // Fumée
    if (Math.random() > 0.8) {
         ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
         ctx.beginPath();
         ctx.arc((Math.random()-0.5)*20, (Math.random()-0.5)*20, 5 + Math.random()*5, 0, Math.PI*2);
         ctx.fill();
    }
    
    ctx.restore();
};
