import React, { useEffect, useRef } from 'react';
import { 
    PlayerConfig, Tank, Bullet, TrackMark, Particle, 
    Wall, Debris, TerrainZone, TerrainType, PowerUp, PowerUpType, WeaponType, Bunker, Tree 
} from '../types';
import { 
    GAME_WIDTH, GAME_HEIGHT, TANK_SPEED, TANK_ROTATION_SPEED, 
    BULLET_SPEED, TANK_SIZE, BULLET_SIZE, COOLDOWN_FRAMES, 
    TRACK_SPACING, COLORS, MAX_TRACKS, TRACK_FADE_DURATION, MAX_REPLAY_FRAMES,
    TANK_BASE_HEALTH, END_SEQUENCE_DURATION, TERRAIN_MODIFIERS,
    WALL_MAX_HEALTH, DEBRIS_MAX_HEALTH, POWERUP_CHANCE, POWERUP_SIZE,
    RESPAWN_TIME, XP_TO_LEVEL_UP, XP_PER_DISTANCE, XP_PER_KILL, XP_PER_WALL, WIN_SCORE,
    BUNKER_REPAIR_AMOUNT, TANK_HEAL_INTERVAL, MAX_STONE_COUNT
} from '../constants';
import { checkCollision, getSpawnPosition, getInitialAngle, generateLevel, findSafeSpawnPosition } from '../utils/gameLogic';
import { AudioSystem } from '../utils/audio';
import { drawTank, drawWreck, drawBunker, drawTree, drawZone, drawGroundTexture } from '../utils/tankUtils';

interface GameCanvasProps {
    playerConfigs: PlayerConfig[];
    onGameOver: (winnerName: string, scores: {name: string, score: number, profileId?: string}[], replayData: any[]) => void;
    onPause: () => void;
    isPaused: boolean;
    isReplayMode?: boolean;
    replayData?: any[];
    onExitReplay?: () => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ 
    playerConfigs, onGameOver, onPause, isPaused, 
    isReplayMode = false, replayData = [], onExitReplay 
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>(0);
    
    // Game State Refs
    const tanksRef = useRef<Tank[]>([]);
    const bulletsRef = useRef<Bullet[]>([]);
    const tracksRef = useRef<TrackMark[]>([]);
    const particlesRef = useRef<Particle[]>([]);
    const wallsRef = useRef<Wall[]>([]);
    const zonesRef = useRef<TerrainZone[]>([]);
    const debrisRef = useRef<Debris[]>([]);
    const powerUpsRef = useRef<PowerUp[]>([]);
    const bunkersRef = useRef<Bunker[]>([]);
    const treesRef = useRef<Tree[]>([]);
    
    // Visuals Cache
    const terrainDetailsRef = useRef<{x: number, y: number, type: 'grass'|'stone'|'dot', color: string}[]>([]);
    
    const endSequenceRef = useRef<{
        isActive: boolean;
        startTime: number;
        focusPoint: {x: number, y: number};
        winnerName: string;
    }>({ isActive: false, startTime: 0, focusPoint: {x: 0, y: 0}, winnerName: '' });

    // Slow Motion Effect
    const slowMoRef = useRef<{active: boolean, startTime: number, duration: number}>({ active: false, startTime: 0, duration: 2000 });

    const recordedFramesRef = useRef<any[]>([]);
    const replayIndexRef = useRef<number>(0);

    const keysPressed = useRef<Set<string>>(new Set());
    const lastTimeRef = useRef<number>(0);
    const trackIdCounter = useRef<number>(0);

    // Initialize Game
    useEffect(() => {
        AudioSystem.init();

        if (isReplayMode) {
            replayIndexRef.current = 0;
            tracksRef.current = []; 
        } else {
            // Generate Map
            const activePlayerIds = playerConfigs.filter(p => p.active).map(p => p.id);
            const levelData = generateLevel(activePlayerIds);
            wallsRef.current = levelData.walls;
            zonesRef.current = levelData.zones;
            bunkersRef.current = levelData.bunkers;
            treesRef.current = levelData.trees;
            debrisRef.current = [];
            powerUpsRef.current = [];
            
            // Generate Visual Details
            const details = [];
            for(let i=0; i<300; i++) {
                const x = Math.random() * GAME_WIDTH;
                const y = Math.random() * GAME_HEIGHT;
                const type = Math.random() > 0.8 ? 'stone' : (Math.random() > 0.5 ? 'grass' : 'dot');
                let color = '#ffffff';
                if (type === 'grass') color = '#4d7c0f'; 
                if (type === 'stone') color = '#78716c';
                if (type === 'dot') color = '#57534e'; 
                details.push({x, y, type: type as any, color});
            }
            terrainDetailsRef.current = details;

            // Setup tanks
            const activePlayers = playerConfigs.filter(p => p.active);
            tanksRef.current = activePlayers.map(p => ({
                id: `p-${p.id}`,
                playerId: p.id,
                x: getSpawnPosition(p.id).x,
                y: getSpawnPosition(p.id).y,
                width: TANK_SIZE,
                height: TANK_SIZE,
                angle: getInitialAngle(p.id),
                color: p.color,
                vx: 0,
                vy: 0,
                health: TANK_BASE_HEALTH,
                maxHealth: TANK_BASE_HEALTH,
                score: 0,
                cooldown: 0,
                isMoving: false,
                distanceTraveled: 0,
                recoilX: 0,
                recoilY: 0,
                treadOffset: 0,
                weapon: WeaponType.NORMAL,
                ammo: 0,
                level: 1,
                xp: 0,
                deadUntil: 0,
                lap: 0, nextCheckpointIndex: 0, finishedRace: false, finishTime: 0,
                stoneCount: 0,
                lastHealTime: 0
            }));

            bulletsRef.current = [];
            tracksRef.current = [];
            particlesRef.current = [];
            recordedFramesRef.current = [];
            keysPressed.current.clear();
            trackIdCounter.current = 0;
            endSequenceRef.current = { isActive: false, startTime: 0, focusPoint: {x: 0, y: 0}, winnerName: '' };
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (isReplayMode) {
                if (e.code === 'Escape' && onExitReplay) onExitReplay();
                return;
            }
            keysPressed.current.add(e.code);
            if (e.code === 'KeyP' && !e.repeat && !endSequenceRef.current.isActive) {
                onPause();
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            keysPressed.current.delete(e.code);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            AudioSystem.stopAllEngines();
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isReplayMode]); 

    // Main Loop
    const animate = (time: number) => {
        if (isPaused) {
             AudioSystem.suspend();
             return;
        } else {
             AudioSystem.resume();
        }
        lastTimeRef.current = time;

        let timeScale = 1.0;
        
        // Handle Slow Mo
        if (slowMoRef.current.active) {
            const elapsed = time - slowMoRef.current.startTime;
            if (elapsed < slowMoRef.current.duration) {
                // Ramp up from 0.1 to 1.0
                timeScale = 0.1 + (elapsed / slowMoRef.current.duration) * 0.9;
            } else {
                slowMoRef.current.active = false;
            }
        }

        if (endSequenceRef.current.isActive) timeScale = 0.2;

        if (isReplayMode) {
            updateReplay();
            draw(time, 1, {x: GAME_WIDTH/2, y: GAME_HEIGHT/2}); 
        } else {
            updateGame(time, timeScale);
            
            // Camera Logic
            let zoom = 1;
            let center = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 };

            if (endSequenceRef.current.isActive) {
                const progress = (time - endSequenceRef.current.startTime) / END_SEQUENCE_DURATION;
                if (progress >= 1) {
                    finishGame();
                    return; 
                }
                const ease = 1 - Math.pow(1 - progress, 3); 
                zoom = 1 + ease * 1.5; 
                const startX = GAME_WIDTH / 2;
                const startY = GAME_HEIGHT / 2;
                const targetX = endSequenceRef.current.focusPoint.x;
                const targetY = endSequenceRef.current.focusPoint.y;
                center.x = startX + (targetX - startX) * ease;
                center.y = startY + (targetY - startY) * ease;
            }

            draw(time, zoom, center);
        }
        requestRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        if (!isPaused) {
            AudioSystem.resume();
            lastTimeRef.current = performance.now();
            requestRef.current = requestAnimationFrame(animate);
        } else {
            AudioSystem.suspend();
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        }
        return () => {
             if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isPaused]);

    const updateReplay = () => {
        if (replayIndexRef.current >= replayData.length) {
            if (onExitReplay) onExitReplay();
            return;
        }
        const frame = replayData[replayIndexRef.current];
        if (frame.tracks) {
            frame.tracks.forEach((t: any, i: number) => {
                tracksRef.current.push({
                    id: `rt-${replayIndexRef.current}-${i}`,
                    x: t.x, y: t.y, angle: t.angle, color: t.color, createdAt: performance.now(), opacity: 1
                });
            });
        }
        replayIndexRef.current++;
    };

    const finishGame = () => {
         AudioSystem.stopAllEngines();
         const scores = tanksRef.current.map(t => ({
             name: playerConfigs.find(c => c.id === t.playerId)?.name || "Inconnu",
             score: t.score,
             profileId: playerConfigs.find(c => c.id === t.playerId)?.profileId
         }));
         onGameOver(endSequenceRef.current.winnerName, scores, recordedFramesRef.current);
    }

    const checkLevelUp = (tank: Tank) => {
        const threshold = tank.level * XP_TO_LEVEL_UP;
        if (tank.xp >= threshold) {
            tank.xp -= threshold;
            tank.level++;
            tank.maxHealth += 1; 
            tank.health = tank.maxHealth;
            AudioSystem.uiClick(); 
            for(let i=0; i<20; i++) {
                particlesRef.current.push({
                    id: `lvl-${Math.random()}`,
                    x: tank.x, y: tank.y,
                    vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10,
                    life: 60, maxLife: 60, color: '#facc15', size: 4, type: 'spark'
                });
            }
        }
    }

    const triggerSlowMo = (now: number) => {
        slowMoRef.current = { active: true, startTime: now, duration: 2500 };
    }

    const updateGame = (now: number, timeScale: number) => {
        const newTracksForReplay: any[] = [];
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];

        tanksRef.current.forEach(tank => {
            if (tank.health <= 0) {
                AudioSystem.stopEngine(tank.id);
                if (tank.deadUntil > 0 && now >= tank.deadUntil && !endSequenceRef.current.isActive) {
                    const spawn = findSafeSpawnPosition(wallsRef.current, tanksRef.current, bunkersRef.current, treesRef.current);
                    tank.x = spawn.x;
                    tank.y = spawn.y;
                    tank.health = tank.maxHealth;
                    tank.deadUntil = 0;
                    tank.isMoving = false;
                    tank.vx = 0;
                    tank.vy = 0;
                    tank.stoneCount = 0; 
                    for(let i=0; i<30; i++) {
                        particlesRef.current.push({
                            id: `rsp-${Math.random()}`,
                            x: tank.x, y: tank.y,
                            vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10,
                            life: 40, maxLife: 40, color: '#3b82f6', size: 5, type: 'spark'
                        });
                    }
                }
                return;
            }

            const config = playerConfigs.find(c => c.id === tank.playerId);
            if (!config) return;
            const controls = config.controls;

            let currentTerrain: TerrainType = TerrainType.GRASS;
            for (const zone of zonesRef.current) {
                // Approximate circular check for round zones
                if (zone.shape === 'circle') {
                    const dist = Math.sqrt(Math.pow(tank.x - zone.x, 2) + Math.pow(tank.y - zone.y, 2));
                    if (dist < zone.width) currentTerrain = zone.type;
                } else {
                    if (tank.x >= zone.x && tank.x <= zone.x + zone.width &&
                        tank.y >= zone.y && tank.y <= zone.y + zone.height) {
                        currentTerrain = zone.type;
                    }
                }
            }
            let terrainMod = TERRAIN_MODIFIERS[currentTerrain];
            
            // Debris Interaction
            let onDebris = false;
            debrisRef.current.forEach(d => {
                const dist = Math.sqrt(Math.pow(tank.x - d.x, 2) + Math.pow(tank.y - d.y, 2));
                if (dist < TANK_SIZE/2 + d.size/2) {
                    onDebris = true;
                    if (tank.isMoving) {
                        if (tank.stoneCount < MAX_STONE_COUNT) {
                            d.health -= 2 * timeScale;
                            if (d.health <= 0) {
                                AudioSystem.crush();
                                tank.stoneCount = (tank.stoneCount || 0) + 1;
                            }
                            // Small feedback when collecting
                            tank.recoilX += (Math.random() - 0.5) * 0.5;
                            tank.recoilY += (Math.random() - 0.5) * 0.5;
                        } else {
                            // Heavy slowdown when driving over full
                            terrainMod *= 0.4;
                        }
                    }
                }
            });
            if (onDebris && tank.stoneCount < MAX_STONE_COUNT) terrainMod *= 0.5;

            // Bunker Interaction
            bunkersRef.current.forEach(bunker => {
                if (bunker.ownerId === tank.playerId && bunker.health > 0) {
                    if (checkCollision(tank, bunker)) {
                        if (now - tank.lastHealTime > TANK_HEAL_INTERVAL) {
                            if (tank.health < tank.maxHealth) {
                                tank.health = Math.min(tank.maxHealth, tank.health + 1);
                                tank.lastHealTime = now;
                                particlesRef.current.push({
                                    id: `heal-${Math.random()}`,
                                    x: tank.x, y: tank.y,
                                    vx: 0, vy: -1,
                                    life: 30, maxLife: 30, color: '#22c55e', size: 4, type: 'spark'
                                });
                            }
                        }
                        if (tank.stoneCount > 0 && bunker.health < bunker.maxHealth) {
                            tank.stoneCount--;
                            bunker.health = Math.min(bunker.maxHealth, bunker.health + BUNKER_REPAIR_AMOUNT);
                            AudioSystem.repair();
                        }
                    }
                }
            });

            for (let i = powerUpsRef.current.length - 1; i >= 0; i--) {
                const p = powerUpsRef.current[i];
                const dist = Math.sqrt(Math.pow(tank.x - p.x, 2) + Math.pow(tank.y - p.y, 2));
                if (dist < TANK_SIZE/2 + POWERUP_SIZE/2) {
                    if (p.type === PowerUpType.HEALTH) {
                        tank.health = Math.min(tank.maxHealth, tank.health + 4);
                    } else if (p.type === PowerUpType.HEAVY_AMMO) {
                        tank.weapon = WeaponType.HEAVY;
                        tank.ammo = 5;
                    } else if (p.type === PowerUpType.BOUNCE_AMMO) {
                        tank.weapon = WeaponType.BOUNCE;
                        tank.ammo = 10;
                    }
                    powerUpsRef.current.splice(i, 1);
                    AudioSystem.uiClick();
                }
            }

            tank.isMoving = false;
            let moveSpeed = 0;
            let rotateDir = 0;
            let shootPressed = false;
            const gp = gamepads[tank.playerId - 1]; 

            if (gp) {
                const deadzone = 0.2;
                if (Math.abs(gp.axes[0]) > deadzone) rotateDir = gp.axes[0];
                if (Math.abs(gp.axes[1]) > deadzone) {
                    moveSpeed = -gp.axes[1] * TANK_SPEED * terrainMod;
                    tank.isMoving = true;
                }
                if (gp.buttons[0].pressed || gp.buttons[5].pressed || gp.buttons[7].pressed) shootPressed = true;
            } 
            
            if (!endSequenceRef.current.isActive) {
                if (keysPressed.current.has(controls.left)) rotateDir = -1;
                if (keysPressed.current.has(controls.right)) rotateDir = 1;

                if (keysPressed.current.has(controls.up)) {
                    moveSpeed = TANK_SPEED * terrainMod;
                    tank.isMoving = true;
                } else if (keysPressed.current.has(controls.down)) {
                    moveSpeed = -TANK_SPEED * 0.6 * terrainMod; 
                    tank.isMoving = true;
                }
                if (keysPressed.current.has(controls.shoot)) shootPressed = true;
            }

            const speedBuff = 1 + (tank.level * 0.05);
            moveSpeed *= speedBuff;

            // Audio Engine Update
            AudioSystem.updateEngine(tank.id, tank.isMoving ? moveSpeed : 0, TANK_SPEED * 1.5);

            tank.angle += rotateDir * TANK_ROTATION_SPEED * timeScale;
            tank.vx = (Math.cos(tank.angle) * moveSpeed) * timeScale;
            tank.vy = (Math.sin(tank.angle) * moveSpeed) * timeScale;

            if (tank.isMoving) {
                tank.treadOffset += Math.abs(moveSpeed) * timeScale;
                tank.xp += XP_PER_DISTANCE * Math.abs(moveSpeed/TANK_SPEED) * timeScale;
                checkLevelUp(tank);
            }

            tank.x += tank.recoilX * timeScale;
            tank.y += tank.recoilY * timeScale;
            tank.recoilX *= 0.9;
            tank.recoilY *= 0.9;

            const nextX = tank.x + tank.vx;
            const nextY = tank.y + tank.vy;
            
            let collided = false;
            const margin = TANK_SIZE / 2;
            if (nextX < margin || nextX > GAME_WIDTH - margin) collided = true;
            if (nextY < margin || nextY > GAME_HEIGHT - margin) collided = true;
            
            const tankRect = { x: nextX - TANK_SIZE/2, y: nextY - TANK_SIZE/2, width: TANK_SIZE, height: TANK_SIZE, id: '', angle: 0, vx: 0, vy: 0 };
            wallsRef.current.forEach(w => {
                if (checkCollision(tankRect, w)) collided = true;
            });
            // Bunker Collision
            bunkersRef.current.forEach(b => {
                if (b.health > 0 && b.ownerId !== tank.playerId && checkCollision(tankRect, b)) collided = true;
            });
            // Tree Collision & Fire Damage
            treesRef.current.forEach(t => {
                if (t.health > 0) {
                    const dist = Math.sqrt(Math.pow(nextX - t.x, 2) + Math.pow(nextY - t.y, 2));
                    if (dist < TANK_SIZE/2 + t.size/3) {
                        collided = true;
                        // Fire Damage
                        if (t.isOnFire) {
                            tank.health -= 0.05 * timeScale;
                        }
                    }
                }
            });

            if (!collided) {
                tank.x = nextX;
                tank.y = nextY;
            } else {
                 tank.recoilX -= tank.vx * 0.25; 
                 tank.recoilY -= tank.vy * 0.25;
            }

            // TANK VS TANK COLLISION (Realistic Bounce)
            tanksRef.current.forEach(other => {
                if (tank === other || other.health <= 0 || tank.id > other.id) return; // Process pair only once
                
                if (checkCollision(tank, other)) {
                    const dx = tank.x - other.x;
                    const dy = tank.y - other.y;
                    const dist = Math.sqrt(dx*dx + dy*dy) || 1;
                    const overlap = TANK_SIZE - dist + 2; 
                    
                    if (overlap > 0) {
                         const nx = dx / dist;
                         const ny = dy / dist;
                         
                         // 1. Separate Tanks (No overlap)
                         const sep = overlap / 2;
                         tank.x += nx * sep;
                         tank.y += ny * sep;
                         other.x -= nx * sep;
                         other.y -= ny * sep;
                         
                         // 2. Apply Heavy Recoil to BOTH
                         const recoilStrength = 4.0;
                         tank.recoilX += nx * recoilStrength;
                         tank.recoilY += ny * recoilStrength;
                         other.recoilX -= nx * recoilStrength;
                         other.recoilY -= ny * recoilStrength;
                         
                         // 3. Audio
                         AudioSystem.metalImpact();
                    }
                }
            });

            if (tank.isMoving) {
                tank.distanceTraveled += Math.abs(moveSpeed * timeScale);
                if (tank.distanceTraveled > TRACK_SPACING) {
                    const trackColor = currentTerrain === TerrainType.MUD ? '#291100' : (currentTerrain === TerrainType.SAND ? '#a8a29e' : '#1c1917');
                    
                    // Create Left and Right Tracks
                    const cos = Math.cos(tank.angle);
                    const sin = Math.sin(tank.angle);
                    const offset = 14; 
                    
                    // Left
                    const lx = tank.x + sin * offset;
                    const ly = tank.y - cos * offset;
                    tracksRef.current.push({
                        id: `tl-${trackIdCounter.current++}`,
                        x: lx, y: ly, angle: tank.angle, color: trackColor, createdAt: now, opacity: 1
                    });

                    // Right
                    const rx = tank.x - sin * offset;
                    const ry = tank.y + cos * offset;
                    tracksRef.current.push({
                        id: `tr-${trackIdCounter.current++}`,
                        x: rx, y: ry, angle: tank.angle, color: trackColor, createdAt: now, opacity: 1
                    });

                    // For replay optimization, maybe simplify
                    newTracksForReplay.push({ x: tank.x, y: tank.y, angle: tank.angle, color: trackColor });
                    tank.distanceTraveled = 0;
                    if (tracksRef.current.length > MAX_TRACKS) tracksRef.current.shift();
                }
            }
            
            // Damage Effects
            if (tank.health < tank.maxHealth) {
                const healthPct = tank.health / tank.maxHealth;
                let effectType: 'smoke' | 'fire' | null = null;
                let chance = 0;
                if (healthPct < 0.3) { effectType = 'fire'; chance = 0.2; } 
                else if (healthPct < 0.6) { effectType = 'smoke'; chance = 0.1; }

                if (effectType && Math.random() < chance * timeScale) {
                    particlesRef.current.push({
                         id: `dmg-${Math.random()}`,
                         x: tank.x + (Math.random() - 0.5) * 10,
                         y: tank.y + (Math.random() - 0.5) * 10,
                         vx: (Math.random() - 0.5) * 0.5,
                         vy: -1 - Math.random(),
                         life: 40 + Math.random() * 20, maxLife: 60,
                         color: effectType === 'fire' ? (Math.random() > 0.5 ? '#f97316' : '#ef4444') : '#44403c',
                         size: 4 + Math.random() * 6, 
                         type: effectType
                     });
                }
            }

            if (tank.cooldown > 0) tank.cooldown -= 1 * timeScale;
            if (!endSequenceRef.current.isActive && shootPressed && tank.cooldown <= 0) {
                AudioSystem.shoot();
                const barrelLen = TANK_SIZE / 2 + 18;
                let bDamage = 1 + Math.floor(tank.level / 3); 
                let bSpeed = BULLET_SPEED;
                let bBounces = 0;
                if (tank.weapon === WeaponType.HEAVY) { bDamage += 2; bSpeed = BULLET_SPEED * 0.8; } 
                else if (tank.weapon === WeaponType.BOUNCE) { bBounces = 2; }

                tank.recoilX -= Math.cos(tank.angle) * 3;
                tank.recoilY -= Math.sin(tank.angle) * 3;

                bulletsRef.current.push({
                    id: `b-${now}-${tank.playerId}`,
                    ownerId: tank.playerId,
                    x: tank.x + Math.cos(tank.angle) * barrelLen,
                    y: tank.y + Math.sin(tank.angle) * barrelLen,
                    vx: Math.cos(tank.angle) * bSpeed,
                    vy: Math.sin(tank.angle) * bSpeed,
                    width: BULLET_SIZE,
                    height: BULLET_SIZE,
                    damage: bDamage,
                    angle: tank.angle,
                    type: tank.weapon,
                    bouncesLeft: bBounces
                });
                tank.cooldown = COOLDOWN_FRAMES;
                if (tank.ammo > 0) {
                    tank.ammo--;
                    if (tank.ammo <= 0) tank.weapon = WeaponType.NORMAL;
                }
            }
        });

        bulletsRef.current = bulletsRef.current.filter(bullet => {
            const nextX = bullet.x + bullet.vx * timeScale;
            const nextY = bullet.y + bullet.vy * timeScale;
            let destroyed = false;
            let bounced = false;

            if (nextX < 0 || nextX > GAME_WIDTH) {
                if (bullet.bouncesLeft > 0) { bullet.vx = -bullet.vx; bullet.bouncesLeft--; bounced = true; } else destroyed = true;
            }
            if (nextY < 0 || nextY > GAME_HEIGHT) {
                if (bullet.bouncesLeft > 0 && !bounced) { bullet.vy = -bullet.vy; bullet.bouncesLeft--; bounced = true; } else if (!bounced) destroyed = true;
            }
            
            if (!destroyed) {
                // Walls
                let wallHitIndex = -1;
                for(let i=0; i<wallsRef.current.length; i++) {
                    const w = wallsRef.current[i];
                    if (nextX > w.x && nextX < w.x + w.width && nextY > w.y && nextY < w.y + w.height) {
                        wallHitIndex = i;
                        break;
                    }
                }
                if (wallHitIndex !== -1) {
                    const wall = wallsRef.current[wallHitIndex];
                    if (bullet.bouncesLeft > 0) {
                        const prevX = bullet.x;
                        if (prevX <= wall.x || prevX >= wall.x + wall.width) bullet.vx = -bullet.vx;
                        else bullet.vy = -bullet.vy;
                        bullet.bouncesLeft--;
                        bounced = true;
                    } else {
                        wall.health -= (bullet.damage * (bullet.type === WeaponType.HEAVY ? 2 : 1));
                        AudioSystem.explode();
                        const shooter = tanksRef.current.find(t => t.playerId === bullet.ownerId);
                        if (shooter && shooter.health > 0) {
                            shooter.xp += XP_PER_WALL;
                            checkLevelUp(shooter);
                        }
                        // Wall debris
                        for(let i=0; i<3; i++) {
                            particlesRef.current.push({
                                id: `wd-${Math.random()}`,
                                x: nextX, y: nextY,
                                vx: (Math.random()-0.5)*5, vy: (Math.random()-0.5)*5,
                                life: 20, maxLife: 20, color: '#a8a29e', size: 3, type: 'dust'
                            });
                        }
                        if (wall.health <= 0) {
                            wallsRef.current.splice(wallHitIndex, 1);
                            for(let k=0; k<4; k++) {
                                debrisRef.current.push({
                                    id: `deb-${Math.random()}`,
                                    x: wall.x + Math.random() * wall.width,
                                    y: wall.y + Math.random() * wall.height,
                                    size: 10 + Math.random() * 15,
                                    rotation: Math.random() * Math.PI * 2,
                                    health: DEBRIS_MAX_HEALTH,
                                    color: '#57534e'
                                });
                            }
                            if (Math.random() < POWERUP_CHANCE) {
                                const types = [PowerUpType.HEALTH, PowerUpType.HEAVY_AMMO, PowerUpType.BOUNCE_AMMO];
                                const type = types[Math.floor(Math.random() * types.length)];
                                powerUpsRef.current.push({
                                    id: `pup-${Math.random()}`,
                                    x: wall.x + wall.width/2,
                                    y: wall.y + wall.height/2,
                                    type: type,
                                    rotation: 0
                                });
                            }
                        }
                        destroyed = true;
                    }
                }
                
                // Trees
                if (!destroyed) {
                    for(let i=0; i<treesRef.current.length; i++) {
                        const t = treesRef.current[i];
                        const dist = Math.sqrt(Math.pow(nextX - t.x, 2) + Math.pow(nextY - t.y, 2));
                        if (t.health > 0 && dist < t.size/2) {
                            t.health -= 1;
                            AudioSystem.explode(); // Small pop
                            // Leaves falling
                            for(let j=0; j<3; j++) particlesRef.current.push({
                                id: `leaf-${Math.random()}`, x: t.x, y: t.y, vx: (Math.random()-0.5)*5, vy: (Math.random()-0.5)*5,
                                life: 30, maxLife: 30, color: '#166534', size: 3, type: 'dust'
                            });
                            if (t.health <= 0) {
                                t.isOnFire = true;
                            } else if (Math.random() < 0.3) {
                                t.isOnFire = true;
                            }
                            destroyed = true;
                            break;
                        }
                    }
                }

                // Check Bunkers
                if (!destroyed) {
                    for(let i=0; i<bunkersRef.current.length; i++) {
                        const b = bunkersRef.current[i];
                        if (b.health > 0 && nextX > b.x && nextX < b.x + b.width && nextY > b.y && nextY < b.y + b.height) {
                            if (b.ownerId !== bullet.ownerId) {
                                b.health -= (bullet.damage * (bullet.type === WeaponType.HEAVY ? 2 : 1));
                                AudioSystem.explode();
                                if (b.health <= 0) {
                                    // TRIGGER BIG EXPLOSION & SLOW MO
                                    AudioSystem.bigExplosion();
                                    triggerSlowMo(now);
                                    // Shockwave
                                    particlesRef.current.push({
                                        id: `shock-${now}`, x: b.x + b.width/2, y: b.y + b.height/2,
                                        vx: 0, vy: 0, life: 100, maxLife: 100, color: 'rgba(255,255,255,0.5)', size: 10, type: 'shockwave'
                                    });
                                    // Massive Debris
                                    for(let k=0; k<20; k++) {
                                        particlesRef.current.push({
                                            id: `bd-${Math.random()}`, x: b.x + b.width/2, y: b.y + b.height/2,
                                            vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15, life: 100, maxLife: 100, color: '#f97316', size: 5 + Math.random()*5, type: 'fire'
                                        });
                                    }
                                }
                                destroyed = true;
                            }
                            break;
                        }
                    }
                }
            }

            if (bounced) destroyed = false;
            if (!destroyed) {
                bullet.x += bullet.vx * timeScale;
                bullet.y += bullet.vy * timeScale;
            }

            if (!destroyed) {
                let hit = false;
                tanksRef.current.forEach(tank => {
                    if (hit || tank.health <= 0 || tank.playerId === bullet.ownerId) return;
                    if (checkCollision(bullet, tank)) {
                        tank.health -= bullet.damage;
                        hit = true;
                        AudioSystem.explode();
                        
                        const dx = bullet.vx;
                        const dy = bullet.vy;
                        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
                        tank.recoilX += (dx/dist) * 8.0;
                        tank.recoilY += (dy/dist) * 8.0;

                        if (tank.stoneCount > 0) {
                            tank.stoneCount--;
                            const dropX = tank.x - (dx/dist) * 40;
                            const dropY = tank.y - (dy/dist) * 40;
                            debrisRef.current.push({
                                id: `dropped-${Math.random()}`,
                                x: dropX, y: dropY,
                                size: 15,
                                rotation: Math.random() * Math.PI * 2,
                                health: DEBRIS_MAX_HEALTH,
                                color: '#78716c'
                            });
                        }

                        for(let i=0; i<5; i++) {
                            particlesRef.current.push({
                                id: `sp-${Math.random()}`,
                                x: bullet.x, y: bullet.y,
                                vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
                                life: 15, maxLife: 15, color: '#fbbf24', size: 3, type: 'spark'
                            });
                        }
                        if (tank.health <= 0) {
                            const shooter = tanksRef.current.find(t => t.playerId === bullet.ownerId);
                            if (shooter) {
                                shooter.score += 1;
                                shooter.xp += XP_PER_KILL;
                                checkLevelUp(shooter);
                            }
                            tank.score = Math.max(0, tank.score - 1);
                            tank.deadUntil = now + RESPAWN_TIME;
                            for(let i=0; i<60; i++) {
                                const speed = 2 + Math.random() * 10;
                                const angle = Math.random() * Math.PI * 2;
                                particlesRef.current.push({
                                    id: `ex-${Math.random()}`,
                                    x: tank.x, y: tank.y,
                                    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                                    life: 50 + Math.random() * 100, maxLife: 150,
                                    color: Math.random() > 0.5 ? '#f97316' : '#ef4444',
                                    size: 5 + Math.random() * 15, type: 'fire'
                                });
                            }
                        }
                    }
                });
                if (hit) destroyed = true;
            }

            return !destroyed;
        });

        // Update trees (burning)
        treesRef.current.forEach(t => {
            if (t.isOnFire && t.health > 0) {
                if (Math.random() < 0.05 * timeScale) {
                    t.health -= 0.1;
                    particlesRef.current.push({
                        id: `fire-${Math.random()}`, x: t.x + (Math.random()-0.5)*20, y: t.y - 10 + (Math.random()-0.5)*20,
                        vx: 0, vy: -1, life: 40, maxLife: 40, color: '#f97316', size: 3, type: 'fire'
                    });
                }
            }
        });

        // Update particles
        particlesRef.current.forEach(p => {
             p.life -= 1 * timeScale;
             if (p.type === 'shockwave') {
                 p.size += 5 * timeScale; // Expand
             } else {
                 p.x += p.vx * timeScale;
                 p.y += p.vy * timeScale;
             }
        });
        particlesRef.current = particlesRef.current.filter(p => p.life > 0);
        
        debrisRef.current = debrisRef.current.filter(d => d.health > 0);

        if (tanksRef.current.some(t => t.score >= WIN_SCORE) && !endSequenceRef.current.isActive) {
             const winner = tanksRef.current.find(t => t.score >= WIN_SCORE);
             if (winner) {
                 const config = playerConfigs.find(c => c.id === winner.playerId);
                 endSequenceRef.current = {
                     isActive: true,
                     startTime: now,
                     focusPoint: {x: winner.x, y: winner.y},
                     winnerName: config?.name || 'Inconnu'
                 };
             }
        }

        if (recordedFramesRef.current.length < MAX_REPLAY_FRAMES && !endSequenceRef.current.isActive) {
            recordedFramesRef.current.push({
                tanks: tanksRef.current.map(t => ({...t})),
                bullets: bulletsRef.current.map(b => ({x: b.x, y: b.y, width: b.width})),
                particles: particlesRef.current.map(p => ({x: p.x, y: p.y, color: p.color, size: p.size, type: p.type})),
                walls: wallsRef.current.map(w => ({x: w.x, y: w.y, width: w.width, height: w.height, health: w.health})),
                bunkers: bunkersRef.current.map(b => ({...b})),
                debris: debrisRef.current.map(d => ({x: d.x, y: d.y, size: d.size, rotation: d.rotation, color: d.color})),
                powerups: powerUpsRef.current.map(p => ({x: p.x, y: p.y, type: p.type})),
                trees: treesRef.current.map(t => ({...t})),
                tracks: newTracksForReplay
            });
        }
    };

    const draw = (now: number, zoom: number, center: {x: number, y: number}) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        // Use new Texture ground
        drawGroundTexture(ctx);

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        ctx.translate(cx, cy);
        ctx.scale(zoom, zoom);
        ctx.translate(-center.x, -center.y);

        // Zones
        zonesRef.current.forEach(zone => drawZone(ctx, zone));

        // Details
        terrainDetailsRef.current.forEach(d => {
            ctx.fillStyle = d.color;
            ctx.globalAlpha = 0.3;
            if (d.type === 'dot') ctx.fillRect(d.x, d.y, 2, 2);
            else ctx.fillRect(d.x, d.y, 4, 4);
            ctx.globalAlpha = 1.0;
        });

        // Tracks
        tracksRef.current.forEach(track => {
            const age = now - track.createdAt;
            // Never disappear completely (min 0.1)
            const fade = Math.max(0.1, 1 - (age / TRACK_FADE_DURATION));
            
            ctx.save();
            ctx.translate(track.x, track.y);
            ctx.rotate(track.angle + Math.PI / 2);
            ctx.fillStyle = track.color;
            ctx.globalAlpha = fade;
            ctx.fillRect(-4, -6, 8, 12); // Narrower individual tracks
            ctx.restore();
        });

        // Bunkers (Bottom Layer)
        bunkersRef.current.forEach(b => drawBunker(ctx, b));

        // Debris
        debrisRef.current.forEach(d => {
            if (d.health <= 0) return;
            ctx.save();
            ctx.translate(d.x, d.y);
            ctx.rotate(d.rotation);
            ctx.fillStyle = d.color;
            ctx.globalAlpha = d.health / DEBRIS_MAX_HEALTH;
            ctx.fillRect(-d.size/2, -d.size/2, d.size, d.size);
            ctx.restore();
        });

        // Trees
        treesRef.current.forEach(t => drawTree(ctx, t, now));

        // Powerups
        powerUpsRef.current.forEach(p => {
             ctx.save();
             ctx.translate(p.x, p.y);
             const scale = 1 + Math.sin(now / 200) * 0.2;
             ctx.scale(scale, scale);
             ctx.fillStyle = COLORS[p.type];
             ctx.beginPath();
             ctx.arc(0, 0, POWERUP_SIZE/2, 0, Math.PI*2);
             ctx.fill();
             ctx.strokeStyle = '#fff';
             ctx.lineWidth = 2;
             ctx.stroke();
             ctx.restore();
        });

        // Walls
        wallsRef.current.forEach(w => {
            ctx.save();
            ctx.translate(w.x, w.y);
            ctx.fillStyle = w.health < w.maxHealth ? COLORS.wallDamaged : COLORS.wall;
            ctx.fillRect(0, 0, w.width, w.height);
            ctx.fillStyle = '#44403c'; 
            ctx.fillRect(0, w.height - 8, w.width, 8);
            if (w.health < w.maxHealth) {
                ctx.strokeStyle = '#292524';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(w.width/2, w.height/2);
                ctx.lineTo(w.width/4, w.height/4);
                ctx.stroke();
            }
            ctx.restore();
        });

        // Tanks
        tanksRef.current.filter(t => t.health <= 0).forEach(tank => drawWreck(ctx, tank, now, isReplayMode));
        tanksRef.current.filter(t => t.health > 0).forEach(tank => drawTank(ctx, tank, isReplayMode, now));

        // Bullets
        bulletsRef.current.forEach(b => {
             ctx.fillStyle = COLORS.bullet;
             ctx.beginPath();
             ctx.arc(b.x, b.y, b.width/2, 0, Math.PI*2);
             ctx.fill();
        });

        // Particles
        particlesRef.current.forEach(p => {
             const lifeRatio = p.life / (p.maxLife || 60);
             ctx.globalAlpha = lifeRatio; 
             ctx.fillStyle = p.color;
             if (p.type === 'shockwave') {
                 ctx.strokeStyle = `rgba(255, 255, 255, ${lifeRatio})`;
                 ctx.lineWidth = 4;
                 ctx.beginPath();
                 ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                 ctx.stroke();
             }
             else if (p.type === 'smoke' || p.type === 'dust' || p.type === 'fire') {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * (2 - lifeRatio), 0, Math.PI*2); 
                ctx.fill();
             } else {
                 ctx.fillRect(p.x, p.y, p.size, p.size);
             }
             ctx.globalAlpha = 1.0;
        });

        // Vignette
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        const gradient = ctx.createRadialGradient(GAME_WIDTH/2, GAME_HEIGHT/2, GAME_HEIGHT/2, GAME_WIDTH/2, GAME_HEIGHT/2, GAME_WIDTH);
        gradient.addColorStop(0, "transparent");
        gradient.addColorStop(1, "rgba(0,0,0,0.5)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0,0, GAME_WIDTH, GAME_HEIGHT);

        if (isReplayMode) {
            ctx.fillStyle = '#ef4444';
            ctx.font = '30px "Rajdhani"';
            ctx.fillText("MODE REPLAY", 40, 60);
        }
    };

    return (
        <div className="relative w-full h-full flex items-center justify-center bg-black">
            <canvas
                ref={canvasRef}
                width={GAME_WIDTH}
                height={GAME_HEIGHT}
                className="w-full h-auto aspect-video max-h-screen object-contain bg-[#0f0f10]"
            />
            
            {!isReplayMode && (
                <div className="absolute top-8 left-8 flex flex-col space-y-4 pointer-events-none">
                    <div className="text-white font-bold mb-2 border-b border-white pb-1">PREMIER A {WIN_SCORE} ÉTOILES</div>
                    {tanksRef.current.map((tank) => {
                        const cfg = playerConfigs.find(c => c.id === tank.playerId);
                        if(!cfg) return null;
                        return (
                            <div key={tank.id} className="flex items-center space-x-4 text-white drop-shadow-md text-lg font-bold font-mono" style={{opacity: tank.health > 0 ? 1 : 0.5}}>
                                <div className="w-1 h-8" style={{backgroundColor: cfg.color}}></div>
                                <span>{cfg.name}</span>
                                <div className="flex text-amber-500">
                                   {Array.from({length: tank.score}).map((_, i) => <span key={i}>★</span>)}
                                </div>
                                {tank.ammo > 0 && (
                                     <div className="ml-4 px-2 py-1 bg-neutral-800 border border-neutral-600 rounded text-xs">
                                         {tank.weapon === WeaponType.HEAVY ? 'LOURD' : 'REBOND'} x{tank.ammo}
                                     </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default GameCanvas;