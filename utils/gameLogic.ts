import { Entity, Tank, Vector2, Wall, TerrainZone, TerrainType, Checkpoint, Bunker, Tree } from '../types';
import { GAME_WIDTH, GAME_HEIGHT, TANK_SIZE, WALL_SIZE, WALL_MAX_HEALTH, TANK_HITBOX_SIZE, BUNKER_SIZE, BUNKER_MAX_HEALTH, TREE_SIZE, TREE_MAX_HEALTH } from '../constants';

export const checkCollision = (a: Entity, b: Entity): boolean => {
    // Use smaller hitbox if it's a tank for precision
    const aWidth = (a as any).playerId ? TANK_HITBOX_SIZE : a.width;
    const aHeight = (a as any).playerId ? TANK_HITBOX_SIZE : a.height;
    const bWidth = (b as any).playerId ? TANK_HITBOX_SIZE : b.width;
    const bHeight = (b as any).playerId ? TANK_HITBOX_SIZE : b.height;

    // Tank is center based coordinates
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
  const padding = 150;
  switch (playerId) {
    case 1: return { x: padding, y: padding };
    case 2: return { x: GAME_WIDTH - padding - TANK_SIZE, y: GAME_HEIGHT - padding - TANK_SIZE };
    case 3: return { x: GAME_WIDTH - padding - TANK_SIZE, y: padding };
    case 4: return { x: padding, y: GAME_HEIGHT - padding - TANK_SIZE };
    default: return { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 };
  }
};

export const getRaceSpawnPosition = (playerId: number): Vector2 => {
    // Start line Grid
    const startX = 200;
    const startY = GAME_HEIGHT / 2;
    const offset = (playerId - 1) * 60;
    return { x: startX, y: startY + offset - 100 };
}

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
    const padding = 100;
    const safeDist = 300;

    while(!safe && attempts < 100) {
        attempts++;
        x = padding + Math.random() * (GAME_WIDTH - padding * 2);
        y = padding + Math.random() * (GAME_HEIGHT - padding * 2);
        
        safe = true;
        const dummy: Entity = { id: 'spawn', x, y, width: TANK_SIZE, height: TANK_SIZE, angle: 0, vx: 0, vy: 0 };
        
        // Check Walls
        for(const w of walls) {
             if (checkCollision(dummy, w)) { safe = false; break; }
        }
        if (!safe) continue;

        // Check Bunkers
        for(const b of bunkers) {
             if (checkCollision(dummy, b)) { safe = false; break; }
        }
        if (!safe) continue;

        // Check Trees
        for(const t of trees) {
             const dist = Math.sqrt(Math.pow(x - t.x, 2) + Math.pow(y - t.y, 2));
             if (dist < TANK_SIZE/2 + t.size/2) { safe = false; break; }
        }
        if (!safe) continue;

        // Check Players
        for(const t of tanks) {
            if (t.health > 0) {
                const dist = Math.sqrt(Math.pow(t.x - x, 2) + Math.pow(t.y - y, 2));
                if (dist < safeDist) { safe = false; break; }
            }
        }
    }
    return { x: safe ? x : GAME_WIDTH/2, y: safe ? y : GAME_HEIGHT/2 };
};

export const getInitialAngle = (playerId: number): number => {
    switch (playerId) {
        case 1: return Math.PI / 4;
        case 2: return Math.PI + Math.PI / 4;
        case 3: return Math.PI * 0.75;
        case 4: return -Math.PI / 4;
        default: return 0;
    }
}

// Map Generator
export const generateLevel = (activePlayerIds: number[]): { walls: Wall[], zones: TerrainZone[], bunkers: Bunker[], trees: Tree[] } => {
    const walls: Wall[] = [];
    const zones: TerrainZone[] = [];
    const bunkers: Bunker[] = [];
    const trees: Tree[] = [];
    
    // 1. Generate Organic Zone Clusters
    // Instead of single circles, we generate clusters of overlapping circles
    const clusterCount = 12;
    
    for(let i=0; i<clusterCount; i++) {
        const centerX = Math.random() * GAME_WIDTH;
        const centerY = Math.random() * GAME_HEIGHT;
        const type = Math.random() > 0.5 ? TerrainType.SAND : TerrainType.MUD;
        const subBlobs = 3 + Math.floor(Math.random() * 4); // 3 to 6 circles per zone

        for(let j=0; j<subBlobs; j++) {
            const offsetX = (Math.random() - 0.5) * 150;
            const offsetY = (Math.random() - 0.5) * 150;
            zones.push({
                id: `z-cluster-${i}-${j}`,
                x: centerX + offsetX,
                y: centerY + offsetY,
                width: 60 + Math.random() * 80, // Radius X
                height: 60 + Math.random() * 80, // Radius Y
                type: type,
                shape: 'circle'
            });
        }
    }

    // Asphalt Roads (still rects for structure)
    zones.push({
        id: 'z-road-1',
        x: 0, y: GAME_HEIGHT / 2 - 80, width: GAME_WIDTH, height: 160, type: TerrainType.ASPHALT, shape: 'rect'
    });
    zones.push({
        id: 'z-road-2',
        x: GAME_WIDTH / 2 - 80, y: 0, width: 160, height: GAME_HEIGHT, type: TerrainType.ASPHALT, shape: 'rect'
    });

    // 2. Generate Bunkers at Spawn Points
    const colors: Record<number, string> = { 1: '#e11d48', 2: '#2563eb', 3: '#16a34a', 4: '#ca8a04' };
    
    activePlayerIds.forEach(pid => {
        const spawn = getSpawnPosition(pid);
        bunkers.push({
            id: `bunker-${pid}`,
            ownerId: pid,
            x: spawn.x - BUNKER_SIZE/2, 
            y: spawn.y - BUNKER_SIZE/2,
            width: BUNKER_SIZE,
            height: BUNKER_SIZE,
            health: BUNKER_MAX_HEALTH,
            maxHealth: BUNKER_MAX_HEALTH,
            color: colors[pid] || '#555',
            angle: 0, vx: 0, vy: 0
        });
    });

    // 3. Generate Destructible Walls & Trees
    const cols = Math.floor(GAME_WIDTH / WALL_SIZE);
    const rows = Math.floor(GAME_HEIGHT / WALL_SIZE);
    const safeRadius = 250;
    const spawnPoints = [1,2,3,4].map(id => getSpawnPosition(id));

    for(let c = 2; c < cols - 2; c++) {
        for(let r = 2; r < rows - 2; r++) {
            // Determine if safe from spawn
            const wx = c * WALL_SIZE;
            const wy = r * WALL_SIZE;
            let safe = true;
            for(let i=0; i<4; i++) {
                const sp = spawnPoints[i];
                const dist = Math.sqrt( Math.pow(wx - sp.x, 2) + Math.pow(wy - sp.y, 2) );
                if (dist < safeRadius) { safe = false; break; }
            }

            if (safe) {
                const rand = Math.random();
                if (rand < 0.08) {
                    // Wall
                    walls.push({
                        id: `w-${c}-${r}`,
                        x: wx, y: wy, width: WALL_SIZE, height: WALL_SIZE,
                        angle: 0, vx: 0, vy: 0,
                        health: WALL_MAX_HEALTH, maxHealth: WALL_MAX_HEALTH, color: '#78716c'
                    });
                } else if (rand < 0.18) {
                    // Tree (higher density)
                    trees.push({
                        id: `t-${c}-${r}`,
                        x: wx + WALL_SIZE/2 + (Math.random()-0.5)*20, 
                        y: wy + WALL_SIZE/2 + (Math.random()-0.5)*20,
                        size: TREE_SIZE,
                        health: TREE_MAX_HEALTH,
                        maxHealth: TREE_MAX_HEALTH,
                        isOnFire: false
                    });
                }
            }
        }
    }

    return { walls, zones, bunkers, trees };
};

export const generateRaceTrack = (): { walls: Wall[], zones: TerrainZone[], checkpoints: Checkpoint[] } => {
    const walls: Wall[] = [];
    const zones: TerrainZone[] = [];
    const checkpoints: Checkpoint[] = [];

    // Simple Loop Track logic
    const margin = 100;
    const trackWidth = 300;
    
    // Outer Box Walls
    for(let x=0; x<GAME_WIDTH; x+=WALL_SIZE) walls.push(createWall(x, 0));
    for(let x=0; x<GAME_WIDTH; x+=WALL_SIZE) walls.push(createWall(x, GAME_HEIGHT - WALL_SIZE));
    for(let y=0; y<GAME_HEIGHT; y+=WALL_SIZE) walls.push(createWall(0, y));
    for(let y=0; y<GAME_HEIGHT; y+=WALL_SIZE) walls.push(createWall(GAME_WIDTH - WALL_SIZE, y));

    // Inner Island
    const innerX = margin + trackWidth;
    const innerY = margin + trackWidth;
    const innerW = GAME_WIDTH - (margin + trackWidth) * 2;
    const innerH = GAME_HEIGHT - (margin + trackWidth) * 2;

    for(let x=innerX; x<innerX + innerW; x+=WALL_SIZE) {
        for(let y=innerY; y<innerY + innerH; y+=WALL_SIZE) {
            walls.push(createWall(x, y));
        }
    }

    zones.push({
        id: 'track-surface',
        x: margin, y: margin, width: GAME_WIDTH - margin*2, height: GAME_HEIGHT - margin*2,
        type: TerrainType.ASPHALT, shape: 'rect'
    });
    
    zones.push({id: 'mud-1', x: GAME_WIDTH - 400, y: GAME_HEIGHT/2, width: 100, height: 200, type: TerrainType.MUD, shape: 'circle'});

    const cpSize = 200;
    checkpoints.push({id: 0, x: GAME_WIDTH - trackWidth - margin, y: margin, width: trackWidth, height: trackWidth});
    checkpoints.push({id: 1, x: GAME_WIDTH - trackWidth - margin, y: GAME_HEIGHT - trackWidth - margin, width: trackWidth, height: trackWidth});
    checkpoints.push({id: 2, x: margin, y: GAME_HEIGHT - trackWidth - margin, width: trackWidth, height: trackWidth});
    checkpoints.push({id: 3, x: margin, y: margin, width: trackWidth, height: trackWidth});

    return { walls, zones, checkpoints };
};

const createWall = (x: number, y: number): Wall => ({
    id: `w-${x}-${y}`,
    x, y, width: WALL_SIZE, height: WALL_SIZE,
    angle: 0, vx: 0, vy: 0,
    health: 9999, maxHealth: 9999, color: '#44403c'
});