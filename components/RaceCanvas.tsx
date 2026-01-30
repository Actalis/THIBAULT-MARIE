

import React, { useEffect, useRef, useState } from 'react';
import { 
    PlayerConfig, Tank, Bullet, TrackMark, Particle, 
    Wall, Debris, TerrainZone, TerrainType, PowerUp, WeaponType, Checkpoint, Tree, Rock
} from '../types';
import { 
    GAME_WIDTH, GAME_HEIGHT, TANK_SPEED, TANK_ROTATION_SPEED, 
    BULLET_SPEED, TANK_SIZE, BULLET_SIZE, COOLDOWN_FRAMES, 
    TRACK_SPACING, COLORS, MAX_TRACKS, TRACK_FADE_DURATION,
    TANK_BASE_HEALTH, TERRAIN_MODIFIERS,
    WALL_MAX_HEALTH, DEBRIS_MAX_HEALTH, XP_PER_DISTANCE, LAPS_TO_WIN, RACE_REPLAY_SECONDS,
    TREE_SOLID_THRESHOLD
} from '../constants';
import { checkCollision, getRaceSpawnPosition, generateRaceTrack } from '../utils/gameLogic';
import { AudioSystem } from '../utils/audio';
import { drawTank, drawWreck, drawGroundTexture, drawZone } from '../utils/tankUtils';
import { drawTreeFoliage, updateTreePhysics, resolveTreeCollisions, resolveDebrisCollection } from '../utils/treeLogic'; 
import { drawRock, updateRockPhysics, resolveRockCollisions, resolveRockTreeCollisions } from '../utils/rockLogic'; 
import { drawWater, updateWaterPhysics, resolveWaterInteraction } from '../utils/waterLogic';

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
    const treesRef = useRef<Tree[]>([]);
    const rocksRef = useRef<Rock[]>([]); 
    
    // Logic Refs
    const keysPressed = useRef<Set<string>>(new Set());
    const trackIdCounter = useRef<number>(0);
    const countDownRef = useRef<number>(3);
    const racePhaseRef = useRef<'COUNTDOWN' | 'RACING' | 'FINISHED'>('COUNTDOWN');
    const startTimeRef = useRef<number>(0);

    // Initialisation du Jeu
    useEffect(() => {
        console.log("Initializing Race Mode...");
        AudioSystem.init();

        // Génération du Niveau
        const levelData = generateRaceTrack();
        wallsRef.current = levelData.walls;
        zonesRef.current = levelData.zones;
        checkpointsRef.current = levelData.checkpoints;
        treesRef.current = levelData.trees;
        rocksRef.current = levelData.rocks;
        debrisRef.current = [];
        bulletsRef.current = [];
        tracksRef.current = [];
        particlesRef.current = [];

        // Initialisation Joueurs
        const activePlayers = playerConfigs.filter(p => p.active);
        tanksRef.current = activePlayers.map(p => {
            const spawn = getRaceSpawnPosition(p.id);
            return {
                id: `p-${p.id}`,
                playerId: p.id,
                x: spawn.x,
                y: spawn.y,
                width: TANK_SIZE,
                height: TANK_SIZE,
                angle: 0, // Regarde à droite sur la ligne de départ
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
                stoneCount: 0, woodCount: 0, waterCount: 0, electronicsCount: 0,
                lastHealTime: 0, lastWaterCollectTime: 0,
                muddyTreadsTimer: 0, isSoldier: false, stunnedUntil: 0,
                attachedBranches: 0, lastImpactTime: 0, isInWater: false
            };
        });

        // Reset Etat
        keysPressed.current.clear();
        trackIdCounter.current = 0;
        racePhaseRef.current = 'COUNTDOWN';
        countDownRef.current = 3;

        // Gestion Clavier
        const handleKeyDown = (e: KeyboardEvent) => {
            keysPressed.current.add(e.code);
            if (e.code === 'KeyP' && !e.repeat && racePhaseRef.current === 'RACING') {
                onPause();
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => keysPressed.current.delete(e.code);

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        // Compte à Rebours (Timer séparé pour la logique UI)
        let cdTimer: ReturnType<typeof setInterval>;
        if (racePhaseRef.current === 'COUNTDOWN') {
            AudioSystem.uiClick(); // 3
            cdTimer = setInterval(() => {
                countDownRef.current--;
                if (countDownRef.current > 0) {
                    AudioSystem.uiClick(); // 2, 1
                } else if (countDownRef.current === 0) {
                    AudioSystem.shoot(); // GO!
                    racePhaseRef.current = 'RACING';
                    startTimeRef.current = performance.now();
                    clearInterval(cdTimer);
                }
            }, 1000);
        }

        // Lancement Boucle
        requestRef.current = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            clearInterval(cdTimer);
            AudioSystem.stopAllEngines();
        };
    }, []); // Run once on mount

    // Boucle d'Animation Principale
    const animate = (time: number) => {
        if (!isPaused) {
            AudioSystem.resume();
            update(time);
            draw(time);
        } else {
            AudioSystem.suspend();
        }
        requestRef.current = requestAnimationFrame(animate);
    };

    // --- UPDATE LOGIC ---
    const update = (now: number) => {
        const dt = 1.0; // Time scale fixe pour simplicité

        // Physique Environnement
        updateWaterPhysics();
        treesRef.current.forEach(t => updateTreePhysics(t, dt, now));
        rocksRef.current.forEach(r => updateRockPhysics(r, dt));
        
        // Collisions Globales
        resolveTreeCollisions(tanksRef.current, bulletsRef.current, treesRef.current, particlesRef.current, now);
        resolveRockCollisions(tanksRef.current, rocksRef.current, bulletsRef.current, particlesRef.current, now);
        
        // NOUVEAU : Collisions Pierres vs Arbres
        resolveRockTreeCollisions(rocksRef.current, treesRef.current);
        
        resolveDebrisCollection(tanksRef.current, particlesRef.current);

        // Mise à jour Tanks
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];

        tanksRef.current.forEach(tank => {
            if (tank.health <= 0) {
                AudioSystem.stopEngine(tank.id);
                // Respawn auto en course après 3s
                if (!tank.deadUntil) tank.deadUntil = now + 3000;
                if (now > tank.deadUntil) {
                    // Respawn au dernier checkpoint validé
                    const cp = checkpointsRef.current[(tank.nextCheckpointIndex - 1 + checkpointsRef.current.length) % checkpointsRef.current.length];
                    tank.x = cp.x + cp.width/2;
                    tank.y = cp.y + cp.height/2;
                    tank.health = tank.maxHealth;
                    tank.deadUntil = 0;
                    tank.angle = 0; // Reset angle
                }
                return;
            }

            // Mouvement bloqué pendant countdown
            if (racePhaseRef.current === 'COUNTDOWN') {
                AudioSystem.updateEngine(tank.id, 0, TANK_SPEED, TerrainType.ASPHALT);
                return; 
            }

            if (tank.finishedRace) {
                AudioSystem.updateEngine(tank.id, 0, TANK_SPEED, TerrainType.ASPHALT);
                return;
            }

            // Input Handling
            const config = playerConfigs.find(c => c.id === tank.playerId);
            if (!config) return;
            
            let move = 0;
            let rotate = 0;
            let shoot = false;

            // Clavier
            if (keysPressed.current.has(config.controls.up)) move = 1;
            else if (keysPressed.current.has(config.controls.down)) move = -0.6;
            if (keysPressed.current.has(config.controls.left)) rotate = -1;
            if (keysPressed.current.has(config.controls.right)) rotate = 1;
            if (keysPressed.current.has(config.controls.shoot)) shoot = true;

            // Gamepad override
            const gp = gamepads[tank.playerId - 1];
            if (gp) {
                if (Math.abs(gp.axes[1]) > 0.1) move = -gp.axes[1];
                if (Math.abs(gp.axes[0]) > 0.1) rotate = gp.axes[0];
                if (gp.buttons[0].pressed) shoot = true;
            }

            // Physique Tank
            let currentTerrain = TerrainType.ASPHALT;
            // Check Terrain
            for(const zone of zonesRef.current) {
                if (zone.shape === 'rect') {
                    if (tank.x >= zone.x && tank.x <= zone.x + zone.width && tank.y >= zone.y && tank.y <= zone.y + zone.height) {
                        currentTerrain = zone.type;
                    }
                } else if (zone.shape === 'circle') { // Circle or Blob aproximation check
                    const dx = tank.x - zone.x; const dy = tank.y - zone.y;
                    if (dx*dx + dy*dy < zone.width * zone.width) currentTerrain = zone.type;
                }
            }
            
            // Eau
            zonesRef.current.forEach(z => resolveWaterInteraction(tank, z, now, particlesRef.current));

            const terrainMod = TERRAIN_MODIFIERS[currentTerrain] || 1.0;
            const finalSpeed = move * TANK_SPEED * terrainMod;
            
            tank.angle += rotate * TANK_ROTATION_SPEED * dt;
            tank.vx = Math.cos(tank.angle) * finalSpeed;
            tank.vy = Math.sin(tank.angle) * finalSpeed;
            tank.isMoving = Math.abs(finalSpeed) > 0.1;

            // Application Mouvement + Recul
            tank.x += (tank.vx + tank.recoilX) * dt;
            tank.y += (tank.vy + tank.recoilY) * dt;
            tank.recoilX *= 0.9; tank.recoilY *= 0.9;

            // Collisions Murs (Bordures)
            wallsRef.current.forEach(w => {
                if(checkCollision(tank, w)) {
                    // Simple rebond
                    tank.x -= tank.vx * 2; tank.y -= tank.vy * 2;
                    tank.recoilX -= tank.vx; tank.recoilY -= tank.vy;
                }
            });

            // Collisions entre Tanks
            tanksRef.current.forEach(other => {
                if (other !== tank && other.health > 0 && checkCollision(tank, other)) {
                    const dx = tank.x - other.x; const dy = tank.y - other.y;
                    const d = Math.sqrt(dx*dx + dy*dy) || 1;
                    tank.x += (dx/d)*2; tank.y += (dy/d)*2;
                    tank.recoilX += (dx/d)*5; tank.recoilY += (dy/d)*5;
                }
            });

            // Audio Moteur
            AudioSystem.updateEngine(tank.id, tank.isMoving ? finalSpeed : 0, TANK_SPEED * 1.5, currentTerrain);

            // Gestion de l'eau (Pour ne pas mettre de traces)
            let inWater = false;
            zonesRef.current.forEach(zone => {
                 const dx = tank.x - zone.x; const dy = tank.y - zone.y;
                 if (zone.type === TerrainType.WATER && dx*dx+dy*dy < zone.width*zone.width) inWater = true;
            });

            // Traces (Double Chenilles Persistantes)
            if (tank.isMoving && !inWater && tank.distanceTraveled > TRACK_SPACING) {
                // Ecartement 24px pour réalisme
                const offset = 24; 
                
                const leftX = tank.x + Math.cos(tank.angle - Math.PI/2) * offset;
                const leftY = tank.y + Math.sin(tank.angle - Math.PI/2) * offset;
                
                const rightX = tank.x + Math.cos(tank.angle + Math.PI/2) * offset;
                const rightY = tank.y + Math.sin(tank.angle + Math.PI/2) * offset;

                const trackColor = tank.color; 

                tracksRef.current.push({
                    id: `tr-l-${trackIdCounter.current++}`,
                    x: leftX, y: leftY, angle: tank.angle,
                    color: trackColor, createdAt: now, opacity: 1.0
                });
                
                tracksRef.current.push({
                    id: `tr-r-${trackIdCounter.current++}`,
                    x: rightX, y: rightY, angle: tank.angle,
                    color: trackColor, createdAt: now, opacity: 1.0
                });

                tank.distanceTraveled = 0;
                
                if (tracksRef.current.length > MAX_TRACKS) {
                    tracksRef.current.splice(0, 2);
                }
            }

            // Tir (Autorisé en course pour gêner !)
            if (tank.cooldown > 0) tank.cooldown--;
            if (shoot && tank.cooldown <= 0) {
                AudioSystem.shoot();
                const barrelLen = TANK_SIZE/2 + 18;
                const startX = tank.x + Math.cos(tank.angle) * barrelLen;
                const startY = tank.y + Math.sin(tank.angle) * barrelLen;
                bulletsRef.current.push({
                    id: `b-${now}-${tank.playerId}-${Math.random()}`,
                    ownerId: tank.playerId,
                    x: startX,
                    y: startY,
                    vx: Math.cos(tank.angle) * BULLET_SPEED,
                    vy: Math.sin(tank.angle) * BULLET_SPEED,
                    width: BULLET_SIZE, height: BULLET_SIZE,
                    damage: 1, angle: tank.angle, type: WeaponType.NORMAL, bouncesLeft: 0,
                    isElectrified: false, homingTargetId: null,
                    startX: startX,
                    startY: startY
                });
                tank.cooldown = COOLDOWN_FRAMES;
                tank.recoilX -= Math.cos(tank.angle)*3; tank.recoilY -= Math.sin(tank.angle)*3;
            }

            // Checkpoints & Tours
            const nextCP = checkpointsRef.current[tank.nextCheckpointIndex];
            // Simple hitbox rect check for checkpoint
            if (tank.x > nextCP.x && tank.x < nextCP.x + nextCP.width &&
                tank.y > nextCP.y && tank.y < nextCP.y + nextCP.height) {
                
                tank.nextCheckpointIndex = (tank.nextCheckpointIndex + 1) % checkpointsRef.current.length;
                AudioSystem.pickup(); // Bip passage checkpoint

                if (tank.nextCheckpointIndex === 0) {
                    tank.lap++;
                    AudioSystem.lap();
                    // Victoire ?
                    if (tank.lap > LAPS_TO_WIN) {
                        tank.finishedRace = true;
                        tank.finishTime = now - startTimeRef.current;
                        AudioSystem.win();
                        // Fin de partie immédiate pour simplifier
                        onGameOver(config.name, tanksRef.current.map(t => ({
                            name: playerConfigs.find(pc => pc.id === t.playerId)?.name || '?',
                            score: t.finishedRace ? 10 : t.lap, // Score simple
                            profileId: playerConfigs.find(pc => pc.id === t.playerId)?.profileId
                        })));
                    }
                }
            }
        });

        // Mise à jour Balles
        bulletsRef.current = bulletsRef.current.filter(b => {
            b.x += b.vx * dt; b.y += b.vy * dt;
            if (b.x < 0 || b.x > GAME_WIDTH || b.y < 0 || b.y > GAME_HEIGHT) return false;
            
            // Touche Tanks
            let hit = false;
            tanksRef.current.forEach(t => {
                if (t.health > 0 && t.playerId !== b.ownerId && checkCollision(b, t)) {
                    t.health -= b.damage;
                    t.recoilX += b.vx * 0.5; t.recoilY += b.vy * 0.5; // Impact cinétique
                    AudioSystem.explode();
                    hit = true;
                }
            });
            // Touche Murs
            if (!hit) {
                wallsRef.current.forEach(w => {
                    if(checkCollision(b, w)) hit = true;
                });
            }
            return !hit;
        });

        // Particules
        particlesRef.current.forEach(p => {
            p.x += p.vx * dt; p.y += p.vy * dt;
            p.life -= dt;
        });
        particlesRef.current = particlesRef.current.filter(p => p.life > 0);
    };

    // --- DRAW LOGIC ---
    const draw = (now: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Reset Transform
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        // Background
        drawGroundTexture(ctx);

        // Zones (Asphalt, Water, Mud)
        zonesRef.current.forEach(z => {
            if (z.type === TerrainType.WATER) drawWater(ctx, z, now);
            else drawZone(ctx, z);
        });

        // Checkpoints (Ligne d'arrivée visible)
        checkpointsRef.current.forEach((cp, i) => {
            if (i === 5) { // Ligne d'arrivée
                ctx.save();
                ctx.translate(cp.x, cp.y);
                ctx.fillStyle = '#fff';
                // Damier
                const s = 20;
                for(let y=0; y<cp.height; y+=s) {
                    for(let x=0; x<cp.width; x+=s) {
                        if ((x/s + y/s) % 2 === 0) ctx.fillRect(x, y, s, s);
                    }
                }
                ctx.restore();
            }
        });

        // Traces
        tracksRef.current.forEach(t => {
            const age = now - t.createdAt;
            let opacity = 1;
            const MAX_OPACITY = 0.35; // Start subtle
            const MIN_OPACITY = 0.05; // Faded persistency
            
            if (age < TRACK_FADE_DURATION) {
                opacity = MAX_OPACITY - (age / TRACK_FADE_DURATION) * (MAX_OPACITY - MIN_OPACITY);
            } else {
                opacity = MIN_OPACITY;
            }

            ctx.save(); 
            ctx.translate(t.x, t.y); 
            ctx.rotate(t.angle);
            ctx.fillStyle = t.color; 
            ctx.globalAlpha = opacity;
            ctx.fillRect(-6, -4, 12, 8);
            ctx.restore();
        });

        // Objets Sol
        rocksRef.current.forEach(r => drawRock(ctx, r));
        particlesRef.current.filter(p => p.type === 'stone' || p.type === 'branch').forEach(p => {
            ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size/2, 0, Math.PI*2); ctx.fill();
        });

        // COUCHE 1 : PETITS ARBRES (Dessinés AVANT les tanks)
        treesRef.current.forEach(t => {
            if (t.growth < TREE_SOLID_THRESHOLD) drawTreeFoliage(ctx, t, now);
        });

        // Tanks
        tanksRef.current.forEach(t => {
            if (t.health > 0) drawTank(ctx, t, false, now);
            else drawWreck(ctx, t, now, false);
        });

        // COUCHE 3 : GRANDS ARBRES (Dessinés APRÈS les tanks)
        treesRef.current.forEach(t => {
            if (t.growth >= TREE_SOLID_THRESHOLD) drawTreeFoliage(ctx, t, now);
        });

        // Balles
        bulletsRef.current.forEach(b => {
            ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, Math.PI*2); ctx.fill();
        });

        // --- UI ---
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset pour UI fixe

        // Compte à rebours
        if (racePhaseRef.current === 'COUNTDOWN' && countDownRef.current > 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'italic 900 250px "Rajdhani"';
            
            const n = countDownRef.current;
            ctx.fillStyle = n === 1 ? '#ef4444' : (n === 2 ? '#fbbf24' : '#22c55e');
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 10;
            ctx.strokeText(n.toString(), GAME_WIDTH/2, GAME_HEIGHT/2);
            ctx.fillText(n.toString(), GAME_WIDTH/2, GAME_HEIGHT/2);
        } else if (racePhaseRef.current === 'RACING' && now - startTimeRef.current < 1000) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'italic 900 200px "Rajdhani"';
            ctx.fillStyle = '#fff';
            ctx.fillText("GO !", GAME_WIDTH/2, GAME_HEIGHT/2);
        }
    };

    return (
        <div className="relative w-full h-full flex items-center justify-center bg-black">
            <canvas ref={canvasRef} width={GAME_WIDTH} height={GAME_HEIGHT} className="w-full h-auto aspect-video max-h-screen object-contain bg-[#0f0f10]"/>
            
            {/* UI REACT OVERLAY */}
            <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
                <div className="text-white font-bold text-xl uppercase bg-black/50 px-4 py-2 rounded border-l-4 border-amber-500">
                    COURSE - 3 TOURS
                </div>
                {tanksRef.current.map(t => {
                    const cfg = playerConfigs.find(p => p.id === t.playerId);
                    if (!cfg) return null;
                    return (
                        <div key={t.id} className="flex items-center gap-4 bg-black/40 px-3 py-1 rounded text-white font-mono">
                            <div className="w-3 h-8 rounded" style={{backgroundColor: cfg.color}}></div>
                            <span className="font-bold text-lg">{cfg.name}</span>
                            <span className="text-amber-400 font-bold text-xl">
                                {t.finishedRace ? 'FINI' : `T ${t.lap}/${LAPS_TO_WIN}`}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default RaceCanvas;
