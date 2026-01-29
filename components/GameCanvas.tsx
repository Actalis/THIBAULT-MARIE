

import React, { useEffect, useRef, useState } from 'react';
import { 
    PlayerConfig, Tank, Bullet, TrackMark, Particle, 
    Wall, Debris, TerrainZone, TerrainType, PowerUp, PowerUpType, WeaponType, Bunker, Tree, Turret, Drone, Mecha, DebrisType, GameMode, Rock
} from '../types';
import { 
    GAME_WIDTH, GAME_HEIGHT, TANK_SPEED, 
    BULLET_SPEED, TANK_SIZE, BULLET_SIZE, 
    TRACK_SPACING, COLORS, MAX_TRACKS, TRACK_FADE_DURATION, MAX_REPLAY_FRAMES,
    TANK_BASE_HEALTH, END_SEQUENCE_DURATION,
    WALL_MAX_HEALTH, DEBRIS_MAX_HEALTH, POWERUP_CHANCE, POWERUP_SIZE,
    RESPAWN_TIME, XP_TO_LEVEL_UP, XP_PER_KILL, XP_PER_WALL,
    BUNKER_UPGRADE_HITS_REQUIRED, STUN_DURATION,
    DRONE_SPAWN_RATE, DRONE_MAX_HEALTH, DRONE_DAMAGE, DRONE_RANGE, DRONE_COOLDOWN, DRONE_SPEED,
    MECHA_SIZE, MECHA_MAX_HEALTH, MECHA_SPEED, MECHA_SPAWN_RATE, MECHA_DAMAGE, HORDE_WAVES,
    TURRET_SIZE, TURRET_MAX_HEALTH, TURRET_COST_STONE, TURRET_COST_WOOD, TURRET_RANGE, TURRET_COOLDOWN, TURRET_DAMAGE,
    BUNKER_UPGRADE_COST_WOOD_L2, BUNKER_UPGRADE_COST_STONE_L2, BUNKER_LEVEL_2_HEALTH_BONUS
} from '../constants';
import { checkCollision, generateLevel, getTurretSlots } from '../utils/gameLogic';
import { AudioSystem } from '../utils/audio';
import { drawTank, drawWreck, drawBunker, drawZone, drawGroundTexture, drawTurret, drawGhostTurret, drawDrone, drawMecha } from '../utils/tankUtils';
import { updateTankBehavior } from '../utils/tankBehavior';
import { drawTreeFoliage, updateTreePhysics, resolveTreeCollisions, resolveDebrisCollection } from '../utils/treeLogic'; 
import { drawRock, updateRockPhysics, resolveRockCollisions } from '../utils/rockLogic'; 
import { drawWater, resolveWaterInteraction, updateWaterPhysics, disturbWater } from '../utils/waterLogic'; 

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
    const rocksRef = useRef<Rock[]>([]); 
    const turretsRef = useRef<Turret[]>([]);
    const dronesRef = useRef<Drone[]>([]);
    const mechasRef = useRef<Mecha[]>([]);
    
    // Inputs tracking
    const keysPressed = useRef<Set<string>>(new Set());
    const lastTimeRef = useRef<number>(0);
    const trackIdCounter = useRef<number>(0);
    const hordeRef = useRef<{active: boolean; wave: number; enemiesToSpawn: any; spawnTimer: number; waveStartTime: number; isWaveRest: boolean; restTimer: number}>({ 
        active: false, wave: 1, enemiesToSpawn: {}, spawnTimer: 0, waveStartTime: 0, isWaveRest: false, restTimer: 0 
    });

    // Initialisation
    useEffect(() => {
        AudioSystem.init();

        if (isReplayMode) {
            // Setup Replay
        } else {
            const activePlayerIds = playerConfigs.filter(p => p.active).map(p => p.id);
            const levelData = generateLevel(activePlayerIds);
            
            wallsRef.current = levelData.walls;
            zonesRef.current = levelData.zones;
            bunkersRef.current = levelData.bunkers;
            treesRef.current = levelData.trees;
            rocksRef.current = levelData.rocks; 
            
            // --- SPAWN LOGIC: TANKS A CÔTÉ DES BUNKERS ---
            tanksRef.current = playerConfigs.filter(p => p.active).map(p => {
                // Trouver le bunker du joueur
                const myBunker = bunkersRef.current.find(b => b.ownerId === p.id);
                
                // Position par défaut (centre) si pas de bunker
                let startX = GAME_WIDTH / 2;
                let startY = GAME_HEIGHT / 2;

                if (myBunker) {
                    // Spawn juste devant le bunker (décalage de 80px)
                    startX = myBunker.x + myBunker.width / 2;
                    startY = myBunker.y + myBunker.height + 60; 
                    
                    if (startY > GAME_HEIGHT - 100) {
                        startY = myBunker.y - 60;
                    }
                }

                return {
                    id: `p-${p.id}`, playerId: p.id, 
                    x: startX, y: startY, 
                    width: TANK_SIZE, height: TANK_SIZE, 
                    angle: -Math.PI/2, // Regarde vers le haut
                    color: p.color, vx: 0, vy: 0, 
                    health: TANK_BASE_HEALTH, maxHealth: TANK_BASE_HEALTH, 
                    score: 0, cooldown: 0, isMoving: false, distanceTraveled: 0, recoilX: 0, recoilY: 0, treadOffset: 0, weapon: WeaponType.NORMAL, ammo: 0, level: 1, xp: 0, deadUntil: 0, lap: 0, nextCheckpointIndex: 0, finishedRace: false, finishTime: 0, stoneCount: 0, woodCount: 0, waterCount: 0, electronicsCount: 0, lastHealTime: 0, muddyTreadsTimer: 0, isSoldier: false, stunnedUntil: 0,
                    attachedBranches: 0, lastImpactTime: 0, lastWaterCollectTime: 0
                };
            });

            // Horde Mode init
            if (activePlayerIds.length === 1) {
                hordeRef.current.active = true;
                hordeRef.current.enemiesToSpawn = { ...HORDE_WAVES[0] };
            }
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (isReplayMode) return;
            keysPressed.current.add(e.code);
            if (e.code === 'KeyP') onPause();
        };
        const handleKeyUp = (e: KeyboardEvent) => keysPressed.current.delete(e.code);
        
        window.addEventListener('keydown', handleKeyDown); 
        window.addEventListener('keyup', handleKeyUp);
        
        return () => { 
            window.removeEventListener('keydown', handleKeyDown); 
            window.removeEventListener('keyup', handleKeyUp); 
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isReplayMode]);

    // Boucle de Jeu
    const animate = (time: number) => {
        if (isPaused) return;

        const dt = 1.0; // Time scale simple pour stabilité
        
        if (!isReplayMode) {
            updateGame(time, dt);
        }
        
        draw(time);
        requestRef.current = requestAnimationFrame(animate);
    };

    // Lancement Boucle
    useEffect(() => {
        if (!isPaused) requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current);
    }, [isPaused]);

    // --- LOGIC UPDATE ---
    const updateGame = (now: number, dt: number) => {
        
        // Physique de l'eau
        updateWaterPhysics();

        // GESTION DES ARBRES (PHYSIQUE & COLLISION)
        treesRef.current.forEach(tree => updateTreePhysics(tree, dt, now));

        // GESTION DES ROCHERS (PHYSIQUE & COLLISION)
        rocksRef.current.forEach(rock => updateRockPhysics(rock, dt));
        resolveRockCollisions(tanksRef.current, rocksRef.current, bulletsRef.current, particlesRef.current, now);

        // Collisions Tanks/Balles vs Arbres
        resolveTreeCollisions(tanksRef.current, bulletsRef.current, treesRef.current, particlesRef.current, now);
        
        // Collecte des branches ET des pierres au sol
        resolveDebrisCollection(tanksRef.current, particlesRef.current);

        // --- GESTION DES BUNKERS (SPAWN DRONES ET UPGRADE) ---
        bunkersRef.current.forEach(bunker => {
            if (bunker.health > 0 && bunker.level >= 2) {
                // Spawn de Drones tous les 2 minutes
                if (now - bunker.lastDroneSpawn > DRONE_SPAWN_RATE) {
                    bunker.lastDroneSpawn = now;
                    // Trouver l'ennemi le plus proche pour cible initiale
                    let targetId: string | null = null;
                    let minDist = 99999;
                    tanksRef.current.forEach(t => {
                        if (t.health > 0 && t.playerId !== bunker.ownerId) {
                            const d = Math.sqrt(Math.pow(t.x - bunker.x, 2) + Math.pow(t.y - bunker.y, 2));
                            if (d < minDist) {
                                minDist = d;
                                targetId = t.id;
                            }
                        }
                    });

                    dronesRef.current.push({
                        id: `drone-${now}-${bunker.id}`,
                        ownerId: bunker.ownerId,
                        x: bunker.x + bunker.width/2,
                        y: bunker.y + bunker.height/2,
                        width: 24, height: 24,
                        angle: 0, vx: 0, vy: 0,
                        health: DRONE_MAX_HEALTH, maxHealth: DRONE_MAX_HEALTH,
                        cooldown: 0,
                        targetId: targetId,
                        wobbleOffset: Math.random() * 100,
                        spinSpeed: 0.2
                    });
                    
                    AudioSystem.repair(); // Son de déploiement
                }
            }
        });

        // --- GESTION DES DRONES ---
        dronesRef.current = dronesRef.current.filter(drone => {
            if (drone.health <= 0) return false;

            // Trouver Cible si nulle
            let targetTank = tanksRef.current.find(t => t.id === drone.targetId);
            if (!targetTank || targetTank.health <= 0) {
                // Chercher nouvelle cible
                let minDist = 99999;
                tanksRef.current.forEach(t => {
                    if (t.health > 0 && t.playerId !== drone.ownerId) {
                        const d = Math.sqrt(Math.pow(t.x - drone.x, 2) + Math.pow(t.y - drone.y, 2));
                        if (d < minDist) {
                            minDist = d;
                            drone.targetId = t.id;
                            targetTank = t;
                        }
                    }
                });
            }

            if (targetTank) {
                // Se déplacer vers la cible
                const angle = Math.atan2(targetTank.y - drone.y, targetTank.x - drone.x);
                drone.x += Math.cos(angle) * DRONE_SPEED * dt;
                drone.y += Math.sin(angle) * DRONE_SPEED * dt;

                // Contact ? Explosion
                const dist = Math.sqrt(Math.pow(targetTank.x - drone.x, 2) + Math.pow(targetTank.y - drone.y, 2));
                if (dist < DRONE_RANGE) {
                    targetTank.health -= DRONE_DAMAGE;
                    drone.health = 0; // Suicide
                    AudioSystem.explode();
                    particlesRef.current.push({
                         id: `drone-exp-${now}`,
                         x: drone.x, y: drone.y,
                         vx: 0, vy: 0, life: 30, maxLife: 30, size: 20, color: '#f59e0b', type: 'fire'
                    });
                    return false;
                }
            }

            return true;
        });


        // --- IA DES TOURELLES ---
        turretsRef.current.forEach(turret => {
            if (turret.health <= 0) return;
            
            // 1. Trouver une cible
            let target: Tank | null = null;
            let minDist = TURRET_RANGE;
            
            tanksRef.current.forEach(t => {
                if (t.health > 0 && t.playerId !== turret.ownerId) {
                    const dist = Math.sqrt(Math.pow(t.x - turret.x, 2) + Math.pow(t.y - turret.y, 2));
                    if (dist < minDist) {
                        minDist = dist;
                        target = t;
                    }
                }
            });

            // 2. Orienter et Tirer
            if (target) {
                // Rotation lente vers la cible
                const desiredAngle = Math.atan2(target.y - turret.y, target.x - turret.x);
                let diff = desiredAngle - turret.angle;
                // Normalisation -PI à PI
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                
                turret.angle += Math.sign(diff) * Math.min(Math.abs(diff), 0.05 * dt);

                // Tirer
                if (turret.cooldown > 0) {
                    turret.cooldown -= 1 * dt;
                } else if (Math.abs(diff) < 0.2) { // Si bien aligné
                    AudioSystem.shoot();
                    bulletsRef.current.push({
                        id: `turret-b-${now}-${Math.random()}`,
                        ownerId: turret.ownerId,
                        x: turret.x + Math.cos(turret.angle) * 30,
                        y: turret.y + Math.sin(turret.angle) * 30,
                        vx: Math.cos(turret.angle) * BULLET_SPEED,
                        vy: Math.sin(turret.angle) * BULLET_SPEED,
                        width: BULLET_SIZE, height: BULLET_SIZE,
                        damage: TURRET_DAMAGE, angle: turret.angle, type: WeaponType.NORMAL, bouncesLeft: 0,
                        isElectrified: false, homingTargetId: null
                    });
                    turret.cooldown = TURRET_COOLDOWN;
                }
            }
        });

        // Mise à jour des Tanks avec la nouvelle logique isolée
        tanksRef.current.forEach(tank => {
            if (tank.health <= 0) return;

            // --- DEPOT RESSOURCES DANS LE BUNKER ---
            // Si le tank touche SON bunker, il dépose
            const myBunker = bunkersRef.current.find(b => b.ownerId === tank.playerId);
            if (myBunker && myBunker.health > 0) {
                if (checkCollision(tank, myBunker)) {
                    let deposited = false;
                    
                    // Dépot Branches (Bois)
                    if (tank.attachedBranches > 0) {
                        myBunker.storedWood += tank.attachedBranches;
                        tank.attachedBranches = 0;
                        deposited = true;
                    }
                    // Dépot Pierres (Collectées des débris)
                    if (tank.stoneCount > 0) {
                        myBunker.storedStone += tank.stoneCount;
                        tank.stoneCount = 0;
                        deposited = true;
                    }
                    // Dépot Eau
                    if (tank.waterCount > 0) {
                        // Pas de stock eau bunker prévu dans les types, on peut l'utiliser pour heal ou convertir
                        // Pour l'instant on vide juste
                        tank.waterCount = 0; 
                        deposited = true;
                    }

                    if (deposited) {
                        AudioSystem.pickup(); // Petit son de validation
                    }
                }
            }

            const config = playerConfigs.find(c => c.id === tank.playerId);
            if (!config) return;

            // Mapping des touches
            const inputs = {
                up: keysPressed.current.has(config.controls.up),
                down: keysPressed.current.has(config.controls.down),
                left: keysPressed.current.has(config.controls.left),
                right: keysPressed.current.has(config.controls.right),
                shoot: keysPressed.current.has(config.controls.shoot)
            };

            // APPEL DE LA LOGIQUE EXTERNE
            updateTankBehavior(
                tank, 
                inputs, 
                wallsRef.current, 
                tanksRef.current, 
                zonesRef.current, 
                dt, 
                now, 
                bulletsRef.current,
                bunkersRef.current, // PASSE LES BUNKERS POUR COLLISION
                particlesRef.current // PASSE LES PARTICULES POUR RALENTISSEMENT DEBRIS
            );

            // Gestion de l'eau (Interaction Physique & Collecte)
            zonesRef.current.forEach(zone => {
                 resolveWaterInteraction(tank, zone, now, particlesRef.current);
            });

            // Gestion des traces (Tracks)
            if (tank.isMoving && tank.distanceTraveled > TRACK_SPACING) {
                tracksRef.current.push({
                    id: `tr-${trackIdCounter.current++}`,
                    x: tank.x, y: tank.y, angle: tank.angle,
                    color: '#222', createdAt: now, opacity: 0.6
                });
                tank.distanceTraveled = 0;
                if (tracksRef.current.length > MAX_TRACKS) tracksRef.current.shift();
            }
        });

        // Mise à jour Balles
        bulletsRef.current = bulletsRef.current.filter(b => {
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            
            // Interaction Balles avec l'EAU (Ondulations)
            zonesRef.current.forEach(z => {
                if (z.type === TerrainType.WATER) {
                    // Check simple distance
                    if (Math.sqrt(Math.pow(b.x - z.x, 2) + Math.pow(b.y - z.y, 2)) < z.width) {
                        disturbWater(b.x, b.y, 2, z);
                    }
                }
            });
            
            // Hors map
            if (b.x < 0 || b.x > GAME_WIDTH || b.y < 0 || b.y > GAME_HEIGHT) return false;
            
            let destroyed = false;

            // Collision Murs
            for (const w of wallsRef.current) {
                if (checkCollision(b, w)) {
                    if (!w.isBorder) w.health--; 
                    destroyed = true;
                    break;
                }
            }
            if (destroyed) return false;

            // Collision Bunkers (Physique, Dégâts & Construction & UPGRADE)
            for (const bunker of bunkersRef.current) {
                // Check Global Hitbox first
                if (bunker.health > 0 && checkCollision(b, bunker)) {
                    
                    // --- LOGIQUE D'UPGRADE NIVEAU 2 ---
                    // Si c'est MON bunker, qu'il est niveau 1, et que j'ai les ressources
                    if (b.ownerId === bunker.ownerId && bunker.level === 1 && bunker.storedWood >= BUNKER_UPGRADE_COST_WOOD_L2 && bunker.storedStone >= BUNKER_UPGRADE_COST_STONE_L2) {
                        bunker.upgradeHits++;
                        AudioSystem.metalImpact(); // Son métallique "Clang"
                        destroyed = true;

                        if (bunker.upgradeHits >= BUNKER_UPGRADE_HITS_REQUIRED) {
                            // UPGRADE !!!
                            bunker.level = 2;
                            bunker.storedWood -= BUNKER_UPGRADE_COST_WOOD_L2;
                            bunker.storedStone -= BUNKER_UPGRADE_COST_STONE_L2;
                            bunker.maxHealth += BUNKER_LEVEL_2_HEALTH_BONUS;
                            bunker.health = bunker.maxHealth; // Full Heal + Bonus
                            bunker.lastDroneSpawn = now; // Reset timer drone
                            
                            AudioSystem.cinematicBoom(); // Gros son pour l'event
                            
                            // Effets visuels massifs
                            for(let i=0; i<30; i++) {
                                particlesRef.current.push({
                                    id: `upgrade-spark-${now}-${i}`,
                                    x: bunker.x + bunker.width/2, 
                                    y: bunker.y + bunker.height/2,
                                    vx: (Math.random()-0.5)*15, 
                                    vy: (Math.random()-0.5)*15,
                                    life: 60, maxLife: 60, 
                                    size: 5 + Math.random()*5, 
                                    color: '#4ade80', // Vert vif
                                    type: 'spark'
                                });
                            }
                        }
                        break; // Stop ici
                    }

                    // --- LOGIQUE DE CONSTRUCTION DE TOURELLE ---
                    // Si c'est MON bunker et que j'ai les ressources
                    if (b.ownerId === bunker.ownerId && bunker.storedWood >= TURRET_COST_WOOD && bunker.storedStone >= TURRET_COST_STONE) {
                        const slots = getTurretSlots(bunker);
                        for(let i=0; i<4; i++) {
                            // Si le slot est libre (pas -1)
                            if (bunker.turretBuildStatus[i] !== -1) {
                                // Hitbox approximative du slot (20px radius)
                                const dx = b.x - slots[i].x;
                                const dy = b.y - slots[i].y;
                                if (dx*dx + dy*dy < 400) {
                                    // Hit validé sur le slot
                                    bunker.turretBuildStatus[i]++;
                                    AudioSystem.metalImpact(); // Son de construction
                                    destroyed = true;

                                    if (bunker.turretBuildStatus[i] >= 2) {
                                        // CONSTRUCTION !
                                        bunker.storedWood -= TURRET_COST_WOOD;
                                        bunker.storedStone -= TURRET_COST_STONE;
                                        bunker.turretBuildStatus[i] = -1; // Marqué comme construit

                                        turretsRef.current.push({
                                            id: `turret-${bunker.id}-${i}`,
                                            ownerId: bunker.ownerId,
                                            x: slots[i].x, y: slots[i].y,
                                            width: TURRET_SIZE, height: TURRET_SIZE,
                                            angle: 0, vx: 0, vy: 0,
                                            health: TURRET_MAX_HEALTH, maxHealth: TURRET_MAX_HEALTH,
                                            cooldown: 0, targetId: null, slotIndex: i
                                        });
                                        AudioSystem.repair(); // Son de réussite
                                    }
                                    break; // On a touché un slot, stop check
                                }
                            }
                        }
                        if(destroyed) break; // Si on a hit un slot, on ne hit pas le bunker lui même
                    }

                    // Si pas de construction, dégâts normaux (si ennemi)
                    if (b.ownerId !== bunker.ownerId) {
                        bunker.health -= b.damage;
                        AudioSystem.explode(); // Petite explosion
                        // Spawn particles d'explosion
                        for(let i=0; i<5; i++) {
                            particlesRef.current.push({
                                id: `exp-${now}-${Math.random()}`,
                                x: b.x, y: b.y,
                                vx: (Math.random()-0.5)*5, vy: (Math.random()-0.5)*5,
                                life: 20, maxLife: 20, color: '#f59e0b', size: 3, type: 'spark'
                            });
                        }
                        destroyed = true;
                        break;
                    }
                }
            }
            if (destroyed) return false;

            // Collision Tanks
            for (const t of tanksRef.current) {
                if (t.health > 0 && t.playerId !== b.ownerId && checkCollision(b, t)) {
                    t.health -= b.damage;
                    AudioSystem.explode();
                    return false;
                }
            }
            
            // Collision Drones
            for (const d of dronesRef.current) {
                if (d.health > 0 && d.ownerId !== b.ownerId) {
                     // Hitbox simple
                     if (Math.abs(b.x - d.x) < 15 && Math.abs(b.y - d.y) < 15) {
                         d.health -= b.damage;
                         destroyed = true;
                         AudioSystem.metalImpact();
                         if (d.health <= 0) {
                              particlesRef.current.push({
                                 id: `drone-exp-${now}`,
                                 x: d.x, y: d.y,
                                 vx: 0, vy: 0, life: 30, maxLife: 30, size: 20, color: '#f59e0b', type: 'fire'
                            });
                         }
                         break;
                     }
                }
            }

            return true;
        });

        // Particules (Mise à jour basique)
        particlesRef.current = particlesRef.current.filter(p => {
            // Les branches (debris) ne bougent pas
            if (p.type === 'branch') {
                 p.life -= 16 * dt; // Millisecondes
                 return p.life > 0;
            }
            
            // Les pierres (debris avec friction)
            if (p.type === 'stone') {
                 p.x += p.vx * dt;
                 p.y += p.vy * dt;
                 p.vx *= 0.85; // Friction forte pour s'arrêter au sol
                 p.vy *= 0.85;
                 
                 p.life -= 16 * dt;
                 return p.life > 0;
            }
            
            // Les ondulations d'eau
            if (p.type === 'ripple') {
                p.size += 0.5 * dt; // S'agrandit
                p.life -= 1 * dt;
                return p.life > 0;
            }

            // Autres particules
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= 1 * dt;
            return p.life > 0;
        });

        // Nettoyage murs détruits
        wallsRef.current = wallsRef.current.filter(w => w.health > 0);
    };

    // --- RENDER ---
    const draw = (now: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Reset Transform & Clear
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        // Background
        drawGroundTexture(ctx);

        // Zones Sol (Sable, Boue, Route, EAU)
        // On dessine l'EAU via la fonction spéciale animée, les autres via drawZone
        zonesRef.current.forEach(z => {
            if (z.type === TerrainType.WATER) {
                drawWater(ctx, z, now);
            } else {
                drawZone(ctx, z);
            }
        });

        // Traces
        tracksRef.current.forEach(t => {
            ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.angle);
            ctx.fillStyle = t.color; ctx.globalAlpha = t.opacity;
            ctx.fillRect(-4, -4, 8, 8);
            ctx.restore();
        });

        // Objets Statiques (Z-Index bas)
        wallsRef.current.forEach(w => {
            if(!w.isBorder) {
                ctx.fillStyle = '#666'; ctx.fillRect(w.x, w.y, w.width, w.height);
                ctx.strokeStyle = '#444'; ctx.strokeRect(w.x, w.y, w.width, w.height);
            }
        });

        bunkersRef.current.forEach(b => drawBunker(ctx, b, now));
        
        // Tourelles construites
        turretsRef.current.forEach(t => {
            if(t.health > 0) {
                const ownerConfig = playerConfigs.find(p => p.id === t.ownerId);
                drawTurret(ctx, t, ownerConfig?.color || '#fff', now);
            }
        });

        // Drones
        dronesRef.current.forEach(d => {
            if(d.health > 0) {
                 const ownerConfig = playerConfigs.find(p => p.id === d.ownerId);
                 drawDrone(ctx, d, ownerConfig?.color || '#fff', now);
            }
        });

        // COUCHE 1 : ARBRES (TRONCS SUPPRIMÉS, MAIS LOGIQUE PRÉSENTE SI BESOIN)
        // (Rien ne s'affiche ici)

        // ROCHERS (Au sol)
        rocksRef.current.forEach(rock => drawRock(ctx, rock));

        // Particules au sol (Branches et Feuilles tombées)
        particlesRef.current.forEach(p => {
            if (p.type === 'branch') {
                ctx.save(); ctx.translate(p.x, p.y); 
                ctx.rotate(p.id.length); 
                ctx.fillStyle = p.color; 
                ctx.fillRect(-p.size/2, -1, p.size, 2);
                ctx.rotate(0.5); ctx.fillRect(0, 0, p.size/3, 1);
                ctx.restore();
            } else if (p.type === 'stone') {
                // Cailloux au sol
                ctx.fillStyle = p.color;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size/2, 0, Math.PI*2); ctx.fill();
            } else if (p.type === 'ripple') {
                 // Ondulation eau
                 ctx.strokeStyle = p.color;
                 ctx.lineWidth = 1;
                 ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.stroke();
            } else if (p.type === 'spark') {
                 ctx.fillStyle = p.color;
                 ctx.fillRect(p.x, p.y, p.size, p.size);
            } else {
                ctx.fillStyle = p.color;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
            }
        });

        // COUCHE 2 : TANKS (Entités)
        tanksRef.current.forEach(t => {
            if (t.health > 0) drawTank(ctx, t, isReplayMode, now);
            else drawWreck(ctx, t, now, isReplayMode);
        });

        // COUCHE 3 : ARBRES (FEUILLAGE)
        // Dessinés APRÈS les tanks pour que les feuilles masquent le tank (effet couverture)
        treesRef.current.forEach(t => drawTreeFoliage(ctx, t, now));

        // Projectiles
        bulletsRef.current.forEach(b => {
            ctx.fillStyle = '#fbbf24'; 
            ctx.beginPath(); ctx.arc(b.x, b.y, b.width/2, 0, Math.PI*2); ctx.fill();
        });
    };

    return (
        <div className="relative w-full h-full flex items-center justify-center bg-black">
            <canvas ref={canvasRef} width={GAME_WIDTH} height={GAME_HEIGHT} className="w-full h-auto max-h-screen object-contain bg-[#111]"/>
        </div>
    );
};

export default GameCanvas;
