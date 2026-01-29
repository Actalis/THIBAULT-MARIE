

import { Entity, Tank, Vector2, Wall, TerrainZone, TerrainType, Checkpoint, Bunker, Tree, Rock } from '../types';
import { GAME_WIDTH, GAME_HEIGHT, TANK_SIZE, WALL_SIZE, WALL_MAX_HEALTH, TANK_HITBOX_SIZE, BUNKER_SIZE, BUNKER_MAX_HEALTH, TREE_SIZE, TREE_MAX_HEALTH, BORDER_SIZE, ROCK_SIZE_MIN, ROCK_SIZE_MAX, ROCK_MAX_HEALTH } from '../constants';
import { generateRockShape } from './rockLogic';

export const checkCollision = (a: Entity, b: Entity): boolean => {
    if (!a || !b) return false;
    
    const aWidth = (a as any).playerId ? TANK_HITBOX_SIZE : a.width;
    const aHeight = (a as any).playerId ? TANK_HITBOX_SIZE : a.height;
    const bWidth = (b as any).playerId ? TANK_HITBOX_SIZE : b.width;
    const bHeight = (b as any).playerId ? TANK_HITBOX_SIZE : b.height;

    const ax = (a as any).playerId ? a.x - aWidth/2 : a.x;
    const ay = (a as any).playerId ? a.y - aHeight/2 : a.y;
    
    const bx = (b as any).playerId ? b.x - bWidth/2 : b.x;
    const by = (b as any).playerId ? b.y - bHeight/2 : b.y;

  return (
    ax < bx + bWidth &&
    ax + aWidth > bx &&
    ay < by + bHeight &&
    ay + aHeight > by
  );
};

export const getSpawnPosition = (playerId: number): Vector2 => {
  // Spawn deep in corners
  const padding = 100; 
  switch (playerId) {
    case 1: return { x: padding, y: padding };
    case 2: return { x: GAME_WIDTH - padding, y: GAME_HEIGHT - padding };
    case 3: return { x: GAME_WIDTH - padding, y: padding };
    case 4: return { x: padding, y: GAME_HEIGHT - padding };
    default: return { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 };
  }
};

export const getRaceSpawnPosition = (playerId: number): Vector2 => {
    // Grille de départ (2 lignes de 2)
    const startX = 280;
    const startY = 180;
    const col = (playerId - 1) % 2;
    const row = Math.floor((playerId - 1) / 2);
    
    return { 
        x: startX + col * 80, 
        y: startY + row * 80 
    };
}

export const getTurretSlots = (bunker: Bunker) => {
    // Exact corners of the bunker
    const inset = 0; 
    return [
        { idx: 0, x: bunker.x - inset, y: bunker.y - inset }, // Top-Left
        { idx: 1, x: bunker.x + bunker.width + inset, y: bunker.y - inset }, // Top-Right
        { idx: 2, x: bunker.x - inset, y: bunker.y + bunker.height + inset }, // Bottom-Left
        { idx: 3, x: bunker.x + bunker.width + inset, y: bunker.y + bunker.height + inset }, // Bottom-Right
    ];
};

export const findSafeSpawnPosition = (
    walls: Wall[], 
    tanks: Tank[], 
    bunkers: Bunker[] = [], 
    trees: Tree[] = []
): Vector2 => {
    let safe = false;
    let x = 0;
    let y = 0;
    let attempts = 0;
    const padding = 150;
    const safeDist = 250;

    while(!safe && attempts < 150) {
        attempts++;
        x = padding + Math.random() * (GAME_WIDTH - padding * 2);
        y = padding + Math.random() * (GAME_HEIGHT - padding * 2);
        
        safe = true;
        const dummy: Entity = { id: 'spawn', x, y, width: TANK_SIZE, height: TANK_SIZE, angle: 0, vx: 0, vy: 0 };
        
        for(const w of walls) { if (checkCollision(dummy, w)) { safe = false; break; } }
        if (!safe) continue;
        for(const b of bunkers) { if (checkCollision(dummy, b)) { safe = false; break; } }
        if (!safe) continue;
        for(const t of trees) { if (Math.sqrt(Math.pow(x - t.x, 2) + Math.pow(y - t.y, 2)) < TANK_SIZE/2 + t.size/2) { safe = false; break; } }
        if (!safe) continue;
        for(const t of tanks) { if (t.health > 0 && Math.sqrt(Math.pow(t.x - x, 2) + Math.pow(t.y - y, 2)) < safeDist) { safe = false; break; } }
    }
    return { x: safe ? x : GAME_WIDTH/2, y: safe ? y : GAME_HEIGHT/2 };
};

export const getInitialAngle = (playerId: number): number => {
    return 0; // Tous regardent à droite au départ de la course
}

export const generateLevel = (activePlayerIds: number[]): { walls: Wall[], zones: TerrainZone[], bunkers: Bunker[], trees: Tree[], rocks: Rock[] } => {
    const walls: Wall[] = [];
    const zones: TerrainZone[] = [];
    const bunkers: Bunker[] = [];
    const trees: Tree[] = [];
    const rocks: Rock[] = [];
    
    // --- BORDURES ---
    walls.push({id: 'b-top', x: 0, y: 0, width: GAME_WIDTH, height: BORDER_SIZE, health: 99999, maxHealth: 99999, color: '#000', isBorder: true, angle: 0, vx: 0, vy: 0});
    walls.push({id: 'b-bottom', x: 0, y: GAME_HEIGHT - BORDER_SIZE, width: GAME_WIDTH, height: BORDER_SIZE, health: 99999, maxHealth: 99999, color: '#000', isBorder: true, angle: 0, vx: 0, vy: 0});
    walls.push({id: 'b-left', x: 0, y: 0, width: BORDER_SIZE, height: GAME_HEIGHT, health: 99999, maxHealth: 99999, color: '#000', isBorder: true, angle: 0, vx: 0, vy: 0});
    walls.push({id: 'b-right', x: GAME_WIDTH - BORDER_SIZE, y: 0, width: BORDER_SIZE, height: GAME_HEIGHT, health: 99999, maxHealth: 99999, color: '#000', isBorder: true, angle: 0, vx: 0, vy: 0});

    // 1. Zones Naturelles
    const clusterCount = 8;
    for(let i=0; i<clusterCount; i++) {
        let x, y;
        x = 200 + Math.random() * (GAME_WIDTH - 400);
        y = 200 + Math.random() * (GAME_HEIGHT - 400);
        const type = Math.random() > 0.5 ? TerrainType.SAND : TerrainType.MUD;
        zones.push({ id: `z-single-${i}`, x: x, y: y, width: 120 + Math.random() * 180, height: 120 + Math.random() * 180, type: type, shape: 'circle' });
    }

    // Routes (Battle)
    const roadWidth = 140;
    zones.push({ id: 'z-road-h', x: -50, y: GAME_HEIGHT / 2 - roadWidth/2, width: GAME_WIDTH + 100, height: roadWidth, type: TerrainType.ASPHALT, shape: 'rect' });
    zones.push({ id: 'z-road-v', x: GAME_WIDTH / 2 - roadWidth/2, y: -50, width: roadWidth, height: GAME_HEIGHT + 100, type: TerrainType.ASPHALT, shape: 'rect' });

    // Eau Centrale
    zones.push({ id: 'z-water-main', x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, width: 180, height: 180, type: TerrainType.WATER, shape: 'circle' });

    // 2. Bunkers
    const isHorde = activePlayerIds.length === 1;
    const idsToSpawn = isHorde ? [1, 2, 3, 4] : activePlayerIds;
    const colors: Record<number, string> = { 1: '#e11d48', 2: '#2563eb', 3: '#16a34a', 4: '#ca8a04' };
    
    idsToSpawn.forEach(pid => {
        const spawn = getSpawnPosition(pid);
        bunkers.push({
            id: `bunker-${pid}`,
            ownerId: isHorde ? activePlayerIds[0] : pid,
            x: spawn.x - BUNKER_SIZE/2, y: spawn.y - BUNKER_SIZE/2,
            width: BUNKER_SIZE, height: BUNKER_SIZE,
            health: BUNKER_MAX_HEALTH, maxHealth: BUNKER_MAX_HEALTH,
            color: isHorde ? colors[activePlayerIds[0]] : (colors[pid] || '#555'),
            angle: 0, vx: 0, vy: 0,
            storedStone: 0, storedWood: 0, storedElectronics: 0,
            level: 1, upgradeHits: 0, lastDroneSpawn: 0, lastMechaSpawn: 0, hasShield: false,
            turretBuildStatus: [0, 0, 0, 0]
        });
    });

    // 3. Arbres et Rochers
    const cols = Math.floor(GAME_WIDTH / WALL_SIZE);
    const rows = Math.floor(GAME_HEIGHT / WALL_SIZE);
    const safeRadius = 220; 
    const spawnPoints = [1,2,3,4].map(id => getSpawnPosition(id));
    const occupancy = new Set<string>();
    const markOccupied = (c: number, r: number) => occupancy.add(`${c},${r}`);
    const isOccupied = (c: number, r: number) => occupancy.has(`${c},${r}`);

    for(let c = 1; c < cols - 1; c++) {
        for(let r = 1; r < rows - 1; r++) {
            const wx = c * WALL_SIZE;
            const wy = r * WALL_SIZE;
            let safe = true;
            for(let i=0; i<4; i++) { if (Math.sqrt(Math.pow(wx - spawnPoints[i].x, 2) + Math.pow(wy - spawnPoints[i].y, 2)) < safeRadius) { safe = false; break; } }
            if (Math.sqrt(Math.pow(wx - GAME_WIDTH/2, 2) + Math.pow(wy - GAME_HEIGHT/2, 2)) < 250) safe = false;

            if (safe && !isOccupied(c, r)) {
                const rand = Math.random();
                if (rand < 0.15) {
                    const treeX = wx + WALL_SIZE/2 + (Math.random()-0.5)*20;
                    const treeY = wy + WALL_SIZE/2 + (Math.random()-0.5)*20;
                    let overlaps = false;
                    for(const b of bunkers) { if (treeX > b.x - 20 && treeX < b.x + b.width + 20 && treeY > b.y - 20 && treeY < b.y + b.height + 20) overlaps = true; }
                    if (!overlaps) {
                        trees.push({ id: `t-${c}-${r}`, x: treeX, y: treeY, size: TREE_SIZE, health: TREE_MAX_HEALTH, maxHealth: TREE_MAX_HEALTH, growth: 1.0, isOnFire: false, wobbleX: 0, wobbleY: 0, wobbleVelX: 0, wobbleVelY: 0, regrowAt: 0 });
                        markOccupied(c, r);
                    }
                } else if (rand < 0.30) {
                    const rockSize = ROCK_SIZE_MIN + Math.random() * (ROCK_SIZE_MAX - ROCK_SIZE_MIN);
                    const rockX = wx + WALL_SIZE/2 + (Math.random()-0.5)*10;
                    const rockY = wy + WALL_SIZE/2 + (Math.random()-0.5)*10;
                    let overlaps = false;
                    for(const b of bunkers) { if (rockX > b.x - 40 && rockX < b.x + b.width + 40 && rockY > b.y - 40 && rockY < b.y + b.height + 40) overlaps = true; }
                    if (!overlaps) {
                        rocks.push({ id: `rock-${c}-${r}`, x: rockX, y: rockY, width: rockSize, height: rockSize, angle: 0, vx: 0, vy: 0, health: ROCK_MAX_HEALTH, maxHealth: ROCK_MAX_HEALTH, rotation: Math.random() * Math.PI * 2, shapePoints: generateRockShape(rockSize) });
                        markOccupied(c, r);
                    }
                }
            }
        }
    }
    return { walls, zones, bunkers, trees, rocks };
};

export const generateRaceTrack = (): { walls: Wall[], zones: TerrainZone[], checkpoints: Checkpoint[], trees: Tree[], rocks: Rock[] } => {
    const walls: Wall[] = [];
    const zones: TerrainZone[] = [];
    const checkpoints: Checkpoint[] = [];
    const trees: Tree[] = [];
    const rocks: Rock[] = [];
    
    // --- BORDURES ---
    walls.push({id: 'b-top', x: 0, y: 0, width: GAME_WIDTH, height: 10, health: 99999, maxHealth: 99999, color: '#333', isBorder: true, angle: 0, vx: 0, vy: 0});
    walls.push({id: 'b-bottom', x: 0, y: GAME_HEIGHT - 10, width: GAME_WIDTH, height: 10, health: 99999, maxHealth: 99999, color: '#333', isBorder: true, angle: 0, vx: 0, vy: 0});
    walls.push({id: 'b-left', x: 0, y: 0, width: 10, height: GAME_HEIGHT, health: 99999, maxHealth: 99999, color: '#333', isBorder: true, angle: 0, vx: 0, vy: 0});
    walls.push({id: 'b-right', x: GAME_WIDTH - 10, y: 0, width: 10, height: GAME_HEIGHT, health: 99999, maxHealth: 99999, color: '#333', isBorder: true, angle: 0, vx: 0, vy: 0});

    // --- 1. DÉCOR DE FOND (Terrain Battle Style) ---
    // Quelques flaques de boue et sable aléatoires
    const clusterCount = 15;
    for(let i=0; i<clusterCount; i++) {
        let x = Math.random() * GAME_WIDTH;
        let y = Math.random() * GAME_HEIGHT;
        const type = Math.random() > 0.5 ? TerrainType.SAND : TerrainType.MUD;
        zones.push({ id: `z-bg-${i}`, x: x, y: y, width: 150 + Math.random() * 200, height: 150 + Math.random() * 200, type: type, shape: 'circle' });
    }
    
    // Un petit lac au centre pour décorer
    zones.push({ id: 'z-lake-race', x: GAME_WIDTH/2, y: GAME_HEIGHT/2, width: 150, height: 150, type: TerrainType.WATER, shape: 'circle' });

    // --- 2. CIRCUIT (Asphalte) ---
    const trackWidth = 220; // Large pour doubler
    
    // Points définissant le circuit (Boucle)
    const points = [
        {x: 200, y: 200},   // 0. Départ (Haut Gauche)
        {x: 900, y: 150},   // 1. Ligne droite haut
        {x: 1700, y: 200},  // 2. Coin Haut Droit
        {x: 1700, y: 600},  // 3. Descente Droite
        {x: 1300, y: 600},  // 4. Intérieur
        {x: 1300, y: 850},  // 5. Chicane bas
        {x: 1700, y: 850},  // 6. Extérieur bas
        {x: 1700, y: 950},  // 7. Coin Bas Droit
        {x: 200, y: 950},   // 8. Longue ligne droite bas
        {x: 200, y: 550}    // 9. Remontée vers départ
    ];

    // Génération des segments de route
    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const steps = Math.ceil(dist / 50); // Tous les 50px
        
        for (let j = 0; j <= steps; j++) {
            const t = j / steps;
            const tx = p1.x + dx * t;
            const ty = p1.y + dy * t;
            
            zones.push({
                id: `track-${i}-${j}`,
                x: tx - trackWidth/2,
                y: ty - trackWidth/2,
                width: trackWidth,
                height: trackWidth,
                type: TerrainType.ASPHALT,
                shape: 'rect'
            });
        }
    }

    // --- 3. CHECKPOINTS ---
    // Doivent être traversés pour valider le tour
    // On les place perpendiculairement à la piste
    const cpSize = trackWidth + 20; 
    
    // 0: Après départ
    checkpoints.push({id: 0, x: 500, y: 150, width: 20, height: cpSize}); 
    // 1: Droite
    checkpoints.push({id: 1, x: 1700 - cpSize/2, y: 400, width: cpSize, height: 20});
    // 2: Milieu
    checkpoints.push({id: 2, x: 1300 - cpSize/2, y: 725, width: cpSize, height: 20});
    // 3: Ligne droite bas
    checkpoints.push({id: 3, x: 900, y: 950 - cpSize/2, width: 20, height: cpSize});
    // 4: Remontée
    checkpoints.push({id: 4, x: 200 - cpSize/2, y: 750, width: cpSize, height: 20});
    // 5: LIGNE D'ARRIVÉE (Sur le départ)
    checkpoints.push({id: 5, x: 200 - 10, y: 200 - cpSize/2, width: 20, height: cpSize});

    // --- 4. OBSTACLES (Arbres & Rochers) ---
    // Génération dense mais qui respecte la piste
    const grid = 60;
    const cols = Math.ceil(GAME_WIDTH / grid);
    const rows = Math.ceil(GAME_HEIGHT / grid);
    
    // Fonction distance point à segment pour exclure la piste
    const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
        const l2 = (x1-x2)*(x1-x2) + (y1-y2)*(y1-y2);
        if (l2 === 0) return Math.sqrt((px-x1)*(px-x1) + (py-y1)*(py-y1));
        let t = ((px-x1)*(x2-x1) + (py-y1)*(y2-y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        const projX = x1 + t * (x2-x1);
        const projY = y1 + t * (y2-y1);
        return Math.sqrt((px-projX)*(px-projX) + (py-projY)*(py-projY));
    };

    const isSafeFromTrack = (x: number, y: number) => {
        const safetyMargin = trackWidth/2 + 40; // Marge de sécurité
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            if (distToSegment(x, y, p1.x, p1.y, p2.x, p2.y) < safetyMargin) return false;
        }
        return true;
    };

    for(let c = 1; c < cols - 1; c++) {
        for(let r = 1; r < rows - 1; r++) {
            const x = c * grid + (Math.random()-0.5)*30;
            const y = r * grid + (Math.random()-0.5)*30;
            
            if (isSafeFromTrack(x, y)) {
                const rand = Math.random();
                if (rand < 0.25) {
                    // ARBRE (avec variation taille pour sapins)
                    const isSapling = Math.random() < 0.4;
                    trees.push({
                        id: `rt-${c}-${r}`,
                        x, y,
                        size: TREE_SIZE,
                        health: TREE_MAX_HEALTH, maxHealth: TREE_MAX_HEALTH,
                        growth: isSapling ? 0.3 : 1.0,
                        isOnFire: false, wobbleX: 0, wobbleY: 0, wobbleVelX: 0, wobbleVelY: 0, regrowAt: 0
                    });
                } else if (rand < 0.40) {
                    // ROCHER
                    const s = ROCK_SIZE_MIN + Math.random()*(ROCK_SIZE_MAX-ROCK_SIZE_MIN);
                    rocks.push({
                        id: `rr-${c}-${r}`,
                        x, y,
                        width: s, height: s,
                        angle: 0, vx: 0, vy: 0,
                        health: ROCK_MAX_HEALTH, maxHealth: ROCK_MAX_HEALTH,
                        rotation: Math.random()*6,
                        shapePoints: generateRockShape(s)
                    });
                }
            }
        }
    }

    return { walls, zones, checkpoints, trees, rocks };
};
