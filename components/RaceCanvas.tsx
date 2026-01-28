import React, { useEffect, useRef } from 'react';
import { 
    PlayerConfig, Tank, Bullet, TrackMark, Particle, 
    Wall, Debris, TerrainZone, TerrainType, PowerUp, WeaponType, Checkpoint, PowerUpType
} from '../types';
import { 
    GAME_WIDTH, GAME_HEIGHT, TANK_SPEED, TANK_ROTATION_SPEED, 
    BULLET_SPEED, TANK_SIZE, BULLET_SIZE, COOLDOWN_FRAMES, 
    TRACK_SPACING, COLORS, MAX_TRACKS, TRACK_FADE_DURATION,
    TANK_BASE_HEALTH, END_SEQUENCE_DURATION, TERRAIN_MODIFIERS,
    WALL_MAX_HEALTH, DEBRIS_MAX_HEALTH, RESPAWN_TIME, XP_PER_DISTANCE, LAPS_TO_WIN
} from '../constants';
import { checkCollision, getRaceSpawnPosition, getInitialAngle, generateRaceTrack, findSafeSpawnPosition } from '../utils/gameLogic';
import { AudioSystem } from '../utils/audio';
import { drawTank, drawWreck } from '../utils/tankUtils';

interface RaceCanvasProps {
    playerConfigs: PlayerConfig[];
    onGameOver: (winnerName: string, scores: {name: string, score: number, profileId?: string}[]) => void;
    onPause: () => void;
    isPaused: boolean;
}

const RaceCanvas: React.FC<RaceCanvasProps> = ({ 
    playerConfigs, onGameOver, onPause, isPaused 
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
    const checkpointsRef = useRef<Checkpoint[]>([]);
    const debrisRef = useRef<Debris[]>([]);
    
    const endSequenceRef = useRef<{
        isActive: boolean;
        startTime: number;
        focusPoint: {x: number, y: number};
        winnerName: string;
    }>({ isActive: false, startTime: 0, focusPoint: {x: 0, y: 0}, winnerName: '' });

    const keysPressed = useRef<Set<string>>(new Set());
    const lastTimeRef = useRef<number>(0);
    const trackIdCounter = useRef<number>(0);

    // Initialize Game
    useEffect(() => {
        AudioSystem.init();

        const levelData = generateRaceTrack();
        wallsRef.current = levelData.walls;
        zonesRef.current = levelData.zones;
        checkpointsRef.current = levelData.checkpoints;
        debrisRef.current = [];

        const activePlayers = playerConfigs.filter(p => p.active);
        tanksRef.current = activePlayers.map(p => ({
            id: `p-${p.id}`,
            playerId: p.id,
            x: getRaceSpawnPosition(p.id).x,
            y: getRaceSpawnPosition(p.id).y,
            width: TANK_SIZE,
            height: TANK_SIZE,
            angle: 0, // Face Right
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
            lap: 1,
            nextCheckpointIndex: 0,
            finishedRace: false,
            finishTime: 0,
            stoneCount: 0,
            lastHealTime: 0
        }));

        bulletsRef.current = [];
        tracksRef.current = [];
        particlesRef.current = [];
        keysPressed.current.clear();
        trackIdCounter.current = 0;
        endSequenceRef.current = { isActive: false, startTime: 0, focusPoint: {x: 0, y: 0}, winnerName: '' };

        const handleKeyDown = (e: KeyboardEvent) => {
            keysPressed.current.add(e.code);
            if (e.code === 'KeyP' && !e.repeat && !endSequenceRef.current.isActive) {
                onPause();
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => keysPressed.current.delete(e.code);

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            AudioSystem.stopAllEngines();
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []); 

    const animate = (time: number) => {
        if (isPaused) {
            AudioSystem.suspend();
            return;
        } else {
            AudioSystem.resume();
        }
        lastTimeRef.current = time;

        let timeScale = 1.0;
        if (endSequenceRef.current.isActive) timeScale = 0.2;

        updateGame(time, timeScale);
        
        // Camera
        let zoom = 0.8; // Zoom out for race
        let center = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 };

        if (endSequenceRef.current.isActive) {
            const progress = (time - endSequenceRef.current.startTime) / END_SEQUENCE_DURATION;
            if (progress >= 1) {
                finishGame();
                return; 
            }
            const ease = 1 - Math.pow(1 - progress, 3); 
            zoom = 0.8 + ease * 1.5; 
            const startX = GAME_WIDTH / 2;
            const startY = GAME_HEIGHT / 2;
            center.x = startX + (endSequenceRef.current.focusPoint.x - startX) * ease;
            center.y = startY + (endSequenceRef.current.focusPoint.y - startY) * ease;
        }

        draw(time, zoom, center);
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
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [isPaused]);


    const finishGame = () => {
         AudioSystem.stopAllEngines();
         const scores = tanksRef.current.map(t => ({
             name: playerConfigs.find(c => c.id === t.playerId)?.name || "Inconnu",
             // Award 1 point for winning the race, instead of 10
             score: t.score + (t.finishedRace ? 1 : 0),
             profileId: playerConfigs.find(c => c.id === t.playerId)?.profileId
         }));
         onGameOver(endSequenceRef.current.winnerName, scores);
    }

    const updateGame = (now: number, timeScale: number) => {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];

        tanksRef.current.forEach(tank => {
            if (tank.health <= 0) {
                AudioSystem.stopEngine(tank.id);
                if (tank.deadUntil > 0 && now >= tank.deadUntil && !endSequenceRef.current.isActive) {
                    const spawn = findSafeSpawnPosition(wallsRef.current, tanksRef.current);
                    tank.x = spawn.x; tank.y = spawn.y; tank.health = tank.maxHealth; tank.deadUntil = 0; tank.isMoving = false;
                }
                return;
            }

            const config = playerConfigs.find(c => c.id === tank.playerId);
            if (!config) return;
            const controls = config.controls;

            let currentTerrain: TerrainType = TerrainType.ASPHALT; // Default for race
            for (const zone of zonesRef.current) {
                if (tank.x >= zone.x && tank.x <= zone.x + zone.width &&
                    tank.y >= zone.y && tank.y <= zone.y + zone.height) {
                    currentTerrain = zone.type;
                }
            }
            let terrainMod = TERRAIN_MODIFIERS[currentTerrain];
            
            // Checkpoints Logic
            const nextCP = checkpointsRef.current[tank.nextCheckpointIndex];
            if (tank.x > nextCP.x && tank.x < nextCP.x + nextCP.width &&
                tank.y > nextCP.y && tank.y < nextCP.y + nextCP.height) {
                    tank.nextCheckpointIndex = (tank.nextCheckpointIndex + 1) % checkpointsRef.current.length;
                    if (tank.nextCheckpointIndex === 0) {
                        tank.lap++;
                        AudioSystem.lap();
                        if (tank.lap > LAPS_TO_WIN && !tank.finishedRace) {
                            tank.finishedRace = true;
                            if (!endSequenceRef.current.isActive) {
                                endSequenceRef.current = {
                                    isActive: true,
                                    startTime: now,
                                    focusPoint: {x: tank.x, y: tank.y},
                                    winnerName: config.name
                                };
                            }
                        }
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
                if (Math.abs(gp.axes[1]) > deadzone) { moveSpeed = -gp.axes[1] * TANK_SPEED * terrainMod; tank.isMoving = true; }
                if (gp.buttons[0].pressed || gp.buttons[5].pressed || gp.buttons[7].pressed) shootPressed = true;
            } 
            
            if (!endSequenceRef.current.isActive) {
                if (keysPressed.current.has(controls.left)) rotateDir = -1;
                if (keysPressed.current.has(controls.right)) rotateDir = 1;
                if (keysPressed.current.has(controls.up)) { moveSpeed = TANK_SPEED * terrainMod; tank.isMoving = true; } 
                else if (keysPressed.current.has(controls.down)) { moveSpeed = -TANK_SPEED * 0.6 * terrainMod; tank.isMoving = true; }
                if (keysPressed.current.has(controls.shoot)) shootPressed = true;
            }

            const speedBuff = 1 + (tank.level * 0.05);
            moveSpeed *= speedBuff;

            // Engine Audio Update
            AudioSystem.updateEngine(tank.id, tank.isMoving ? moveSpeed : 0, TANK_SPEED * 1.5);

            tank.angle += rotateDir * TANK_ROTATION_SPEED * timeScale;
            tank.vx = (Math.cos(tank.angle) * moveSpeed) * timeScale;
            tank.vy = (Math.sin(tank.angle) * moveSpeed) * timeScale;

            if (tank.isMoving) {
                tank.treadOffset += Math.abs(moveSpeed) * timeScale;
                tank.xp += XP_PER_DISTANCE * Math.abs(moveSpeed/TANK_SPEED) * timeScale;
            }

            tank.x += tank.recoilX * timeScale; tank.y += tank.recoilY * timeScale;
            tank.recoilX *= 0.9; tank.recoilY *= 0.9;

            const nextX = tank.x + tank.vx; const nextY = tank.y + tank.vy;
            let collided = false;
            
            const tankRect = { x: nextX - TANK_SIZE/2, y: nextY - TANK_SIZE/2, width: TANK_SIZE, height: TANK_SIZE, id: '', angle: 0, vx: 0, vy: 0 };
            wallsRef.current.forEach(w => { if (checkCollision(tankRect, w)) collided = true; });

            if (!collided) { tank.x = nextX; tank.y = nextY; } 
            else { tank.recoilX -= tank.vx * 0.25; tank.recoilY -= tank.vy * 0.25; }

            // Combat logic (Simplified for race - bumping slows down)
            tanksRef.current.forEach(other => {
                if (tank === other || other.health <= 0) return;
                if (checkCollision(tank, other)) {
                    const dx = tank.x - other.x; const dy = tank.y - other.y;
                    const dist = Math.sqrt(dx*dx + dy*dy) || 1;
                    const nx = dx / dist; const ny = dy / dist;
                    const overlap = TANK_SIZE - dist + 4;
                    if (overlap > 0) { tank.x += nx * overlap * 0.5; tank.y += ny * overlap * 0.5; }
                    tank.recoilX += nx * 12.0; tank.recoilY += ny * 12.0;
                }
            });

            if (tank.isMoving) {
                tank.distanceTraveled += Math.abs(moveSpeed * timeScale);
                if (tank.distanceTraveled > TRACK_SPACING) {
                    const trackColor = currentTerrain === TerrainType.MUD ? '#291100' : (currentTerrain === TerrainType.SAND ? '#a8a29e' : '#1c1917');
                    tracksRef.current.push({id: `t-${trackIdCounter.current++}`, x: tank.x, y: tank.y, angle: tank.angle, color: trackColor, createdAt: now, opacity: 1});
                    tank.distanceTraveled = 0;
                    if (tracksRef.current.length > MAX_TRACKS) tracksRef.current.shift();
                }
            }

            if (tank.cooldown > 0) tank.cooldown -= 1 * timeScale;
            if (shootPressed && tank.cooldown <= 0 && !endSequenceRef.current.isActive) {
                 AudioSystem.shoot();
                 const barrelLen = TANK_SIZE / 2 + 18;
                 
                 // Recoil
                 tank.recoilX -= Math.cos(tank.angle) * 3;
                 tank.recoilY -= Math.sin(tank.angle) * 3;

                 bulletsRef.current.push({
                    id: `b-${now}-${tank.playerId}`,
                    ownerId: tank.playerId,
                    x: tank.x + Math.cos(tank.angle) * barrelLen,
                    y: tank.y + Math.sin(tank.angle) * barrelLen,
                    vx: Math.cos(tank.angle) * BULLET_SPEED,
                    vy: Math.sin(tank.angle) * BULLET_SPEED,
                    width: BULLET_SIZE, height: BULLET_SIZE,
                    damage: 1, angle: tank.angle, type: WeaponType.NORMAL, bouncesLeft: 0
                 });
                 tank.cooldown = COOLDOWN_FRAMES;
            }
        });

        bulletsRef.current = bulletsRef.current.filter(bullet => {
            const nextX = bullet.x + bullet.vx * timeScale;
            const nextY = bullet.y + bullet.vy * timeScale;
            let destroyed = false;

            if (nextX < 0 || nextX > GAME_WIDTH || nextY < 0 || nextY > GAME_HEIGHT) destroyed = true;
            
            if (!destroyed) {
                for(let i=0; i<wallsRef.current.length; i++) {
                    const w = wallsRef.current[i];
                    if (nextX > w.x && nextX < w.x + w.width && nextY > w.y && nextY < w.y + w.height) {
                         AudioSystem.explode();
                         destroyed = true;
                         break;
                    }
                }
            }

            if (!destroyed) {
                tanksRef.current.forEach(tank => {
                    if (tank.health <= 0 || tank.playerId === bullet.ownerId) return;
                    if (checkCollision(bullet, tank)) {
                        tank.health -= bullet.damage;
                        AudioSystem.explode();
                        
                        // Knockback
                        const dist = Math.sqrt(bullet.vx*bullet.vx + bullet.vy*bullet.vy) || 1;
                        tank.recoilX += (bullet.vx/dist) * 8.0;
                        tank.recoilY += (bullet.vy/dist) * 8.0;

                        if (tank.health <= 0) {
                            tank.deadUntil = now + 5000; // 5 sec respawn in race
                            // Killer logic
                        }
                        destroyed = true;
                    }
                });
            }

            if (!destroyed) {
                bullet.x += bullet.vx * timeScale;
                bullet.y += bullet.vy * timeScale;
            }
            return !destroyed;
        });

        particlesRef.current.forEach(p => {
            p.x += p.vx * timeScale; p.y += p.vy * timeScale;
            p.life -= 1 * timeScale;
        });
        particlesRef.current = particlesRef.current.filter(p => p.life > 0);
    };

    const draw = (now: number, zoom: number, center: {x: number, y: number}) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = COLORS.background;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        ctx.translate(cx, cy);
        ctx.scale(zoom, zoom);
        ctx.translate(-center.x, -center.y);

        // Zones
        zonesRef.current.forEach(zone => {
            ctx.fillStyle = COLORS[zone.type.toLowerCase() as keyof typeof COLORS] || '#000';
            ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
        });

        // Checkpoints (Visual)
        checkpointsRef.current.forEach((cp, idx) => {
             ctx.strokeStyle = idx === 0 ? '#fff' : 'rgba(255,255,255,0.3)';
             ctx.lineWidth = 4;
             ctx.setLineDash([20, 20]);
             ctx.strokeRect(cp.x, cp.y, cp.width, cp.height);
             ctx.setLineDash([]);
             if (idx === 3) { // Start/Finish
                 // Checkerboard
                 const size = 20;
                 for(let y=0; y<cp.height; y+=size) {
                     for(let x=0; x<cp.width; x+=size) {
                         if ((x/size + y/size) % 2 === 0) {
                             ctx.fillStyle = '#fff';
                             ctx.fillRect(cp.x + x, cp.y + y, size, size);
                         }
                     }
                 }
             }
        });

        tracksRef.current.forEach(track => {
            const age = now - track.createdAt;
            // Higher opacity for tracks
            const opacity = Math.max(0.3, 1 - (age / TRACK_FADE_DURATION));
            ctx.save();
            ctx.translate(track.x, track.y);
            ctx.rotate(track.angle + Math.PI / 2);
            ctx.fillStyle = track.color;
            ctx.globalAlpha = opacity * 0.8; 
            ctx.fillRect(-30, -16, 12, 32); ctx.fillRect(10, -16, 12, 32);
            ctx.restore();
        });

        wallsRef.current.forEach(w => {
            ctx.fillStyle = '#333';
            ctx.fillRect(w.x, w.y, w.width, w.height);
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 2;
            ctx.strokeRect(w.x, w.y, w.width, w.height);
        });

        tanksRef.current.filter(t => t.health > 0).forEach(tank => drawTank(ctx, tank, false, now));
        tanksRef.current.filter(t => t.health <= 0).forEach(tank => drawWreck(ctx, tank, now, false));

        bulletsRef.current.forEach(b => {
             ctx.fillStyle = COLORS.bullet;
             ctx.beginPath();
             ctx.arc(b.x, b.y, b.width/2, 0, Math.PI*2);
             ctx.fill();
        });
    };

    return (
        <div className="relative w-full h-full flex items-center justify-center bg-black">
            <canvas ref={canvasRef} width={GAME_WIDTH} height={GAME_HEIGHT} className="w-full h-auto aspect-video max-h-screen object-contain bg-[#0f0f10]"/>
            <div className="absolute top-8 left-8 flex flex-col space-y-4 pointer-events-none">
                <div className="text-white font-bold mb-2 border-b border-white pb-1">3 TOURS POUR GAGNER</div>
                {tanksRef.current.map((tank) => {
                    const cfg = playerConfigs.find(c => c.id === tank.playerId);
                    if(!cfg) return null;
                    return (
                        <div key={tank.id} className="flex items-center space-x-4 text-white drop-shadow-md text-lg font-bold font-mono">
                            <div className="w-1 h-8" style={{backgroundColor: cfg.color}}></div>
                            <span>{cfg.name}</span>
                            <div className="text-amber-500 font-bold">TOUR {tank.lap}/{LAPS_TO_WIN}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default RaceCanvas;