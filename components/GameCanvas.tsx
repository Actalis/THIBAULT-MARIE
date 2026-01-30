

import React, { useEffect, useRef, useState } from 'react';
import { 
    PlayerConfig, Tank, Bullet, TrackMark, Particle, 
    Wall, Debris, TerrainZone, TerrainType, PowerUp, PowerUpType, WeaponType, Bunker, Tree, Turret, Drone, Mecha, DebrisType, GameMode, Rock, RepairStation, MunitionsFactory
} from '../types';
import { 
    GAME_WIDTH, GAME_HEIGHT, TANK_SIZE, BULLET_SIZE, BULLET_SPEED,
    TRACK_SPACING, COLORS, MAX_TRACKS, TRACK_FADE_DURATION, MAX_REPLAY_FRAMES,
    TANK_BASE_HEALTH, END_SEQUENCE_DURATION,
    WALL_MAX_HEALTH, DEBRIS_MAX_HEALTH, POWERUP_CHANCE, POWERUP_SIZE,
    RESPAWN_TIME, XP_TO_LEVEL_UP, XP_PER_KILL, XP_PER_WALL,
    BUNKER_UPGRADE_HITS_REQUIRED, STUN_DURATION,
    DRONE_SPAWN_RATE, DRONE_MAX_HEALTH, DRONE_DAMAGE, DRONE_RANGE, DRONE_COOLDOWN, DRONE_SPEED, DRONE_SHOOT_RATE, DRONE_SHOOT_RANGE,
    MECHA_SIZE, MECHA_MAX_HEALTH, MECHA_SPEED, MECHA_SPAWN_RATE, MECHA_DAMAGE, HORDE_WAVES,
    TURRET_SIZE, TURRET_MAX_HEALTH, TURRET_COST_STONE, TURRET_COST_WOOD, TURRET_RANGE, TURRET_COOLDOWN, TURRET_DAMAGE,
    BUNKER_UPGRADE_COST_WOOD_L2, BUNKER_UPGRADE_COST_STONE_L2, BUNKER_LEVEL_2_HEALTH_BONUS,
    TREE_SOLID_THRESHOLD, BUNKER_WATER_MAX_CAPACITY, BULLET_MAX_RANGE,
    REPAIR_STATION_COST_WATER, REPAIR_STATION_COST_WOOD, REPAIR_STATION_COST_STONE, REPAIR_STATION_HEAL_RATE, REPAIR_STATION_HEAL_AMOUNT, REPAIR_STATION_BUILD_HITS,
    FACTORY_COST_WOOD, FACTORY_COST_STONE, FACTORY_BUILD_HITS, FACTORY_PRODUCTION_RATE, FACTORY_AMMO_AMOUNT,
    CLASS_STATS, SOLDIER_MAX_HEALTH // NOUVEAU
} from '../constants';
import { checkCollision, generateLevel, getTurretSlots } from '../utils/gameLogic';
import { AudioSystem } from '../utils/audio';
import { drawTank, drawDebris, drawBunker, drawZone, drawGroundTexture, drawTurret, drawDrone, drawRepairStation, drawMunitionsFactory } from '../utils/tankUtils';
import { updateTankBehavior } from '../utils/tankBehavior';
import { drawTreeFoliage, updateTreePhysics, resolveTreeCollisions, resolveDebrisCollection } from '../utils/treeLogic'; 
import { drawRock, updateRockPhysics, resolveRockCollisions, resolveRockTreeCollisions } from '../utils/rockLogic'; 
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
    const repairStationsRef = useRef<RepairStation[]>([]);
    const factoriesRef = useRef<MunitionsFactory[]>([]);
    
    // Cinematic & Logic Refs
    const keysPressed = useRef<Set<string>>(new Set());
    const lastTimeRef = useRef<number>(0);
    const trackIdCounter = useRef<number>(0);
    const hordeRef = useRef<{active: boolean; wave: number; enemiesToSpawn: any; spawnTimer: number; waveStartTime: number; isWaveRest: boolean; restTimer: number}>({ 
        active: false, wave: 1, enemiesToSpawn: {}, spawnTimer: 0, waveStartTime: 0, isWaveRest: false, restTimer: 0 
    });

    // CINEMATIC STATE
    const cinematicRef = useRef<{
        active: boolean;
        winnerId: number | null;
        startTime: number;
        zoom: number;
        camX: number;
        camY: number;
    }>({ active: false, winnerId: null, startTime: 0, zoom: 1, camX: GAME_WIDTH/2, camY: GAME_HEIGHT/2 });

    const [cinematicUI, setCinematicUI] = useState<{winnerName: string, color: string} | null>(null);

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
            repairStationsRef.current = levelData.repairStations;
            factoriesRef.current = levelData.factories;
            debrisRef.current = []; // Reset debris
            
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

                // NOUVEAU : Application des stats de classe
                const stats = CLASS_STATS[p.tankClass];

                return {
                    id: `p-${p.id}`, playerId: p.id, 
                    x: startX, y: startY, 
                    width: TANK_SIZE, height: TANK_SIZE, 
                    angle: -Math.PI/2, // Regarde vers le haut
                    color: p.color, vx: 0, vy: 0, 
                    tankClass: p.tankClass, // Stockage de la classe
                    health: stats.health, maxHealth: stats.health, // PV selon la classe
                    score: 0, cooldown: 0, isMoving: false, distanceTraveled: 0, recoilX: 0, recoilY: 0, treadOffset: 0, weapon: WeaponType.NORMAL, ammo: 0, level: 1, xp: 0, deadUntil: 0, lap: 0, nextCheckpointIndex: 0, finishedRace: false, finishTime: 0, stoneCount: 0, woodCount: 0, waterCount: 0, electronicsCount: 0, lastHealTime: 0, muddyTreadsTimer: 0, isSoldier: false, stunnedUntil: 0,
                    attachedBranches: 0, lastImpactTime: 0, lastWaterCollectTime: 0, isInWater: false,
                    soldierBurstCount: 0, soldierReloadTimer: 0,
                    altitude: 0, verticalVelocity: 0
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

        const dt = 1.0; 
        
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
        
        // --- CINEMATIC MODE LOGIC (Freeze game loop partially) ---
        if (cinematicRef.current.active) {
            // Uniquement les particules et les explosions continuent
            particlesRef.current = particlesRef.current.filter(p => {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.life -= 1 * dt;
                return p.life > 0;
            });

            // Feux d'artifice aléatoires autour du vainqueur
            if (Math.random() > 0.85) {
                const winner = tanksRef.current.find(t => t.playerId === cinematicRef.current.winnerId);
                if (winner) {
                    AudioSystem.shoot(); // Petit bruit de départ
                    const fx = winner.x + (Math.random() - 0.5) * 600;
                    const fy = winner.y + (Math.random() - 0.5) * 400;
                    // Créer explosion colorée
                    const color = Math.random() > 0.5 ? winner.color : '#fbbf24';
                    for(let i=0; i<20; i++) {
                        particlesRef.current.push({
                            id: `firework-${now}-${i}`,
                            x: fx, y: fy,
                            vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15,
                            life: 40 + Math.random()*20, maxLife: 60,
                            size: 4 + Math.random()*4, color: color, type: 'spark'
                        });
                    }
                }
            }

            // Vérifier la fin de la séquence cinématique
            if (now - cinematicRef.current.startTime > 6000) { // 6 secondes de gloire
                const winnerConfig = playerConfigs.find(p => p.id === cinematicRef.current.winnerId);
                const scores = tanksRef.current.map(t => ({
                    name: playerConfigs.find(p => p.id === t.playerId)?.name || 'Unknown',
                    score: t.playerId === cinematicRef.current.winnerId ? 1 : 0, // Simple win count
                    profileId: playerConfigs.find(p => p.id === t.playerId)?.profileId
                }));
                onGameOver(winnerConfig?.name || 'Winner', scores, []); // Replay logic later
            }
            return; // STOP LE RESTE DU JEU
        }

        // --- CHECK WIN CONDITION (DEATHMATCH) ---
        // MODIFICATION: Un joueur est encore en vie si PV > 0 OU si c'est un Tank "mort" (PV<=0) MAIS pas encore soldat (!isSoldier)
        // car il va se transformer dans la suite de la frame.
        // On est éliminé uniquement si PV <= 0 ET qu'on est DÉJÀ soldat.
        const activePlayers = tanksRef.current.filter(t => t.health > 0 || !t.isSoldier);
        const totalPlayersStart = playerConfigs.filter(p => p.active).length;
        
        if (!isReplayMode && totalPlayersStart > 1 && activePlayers.length === 1 && !cinematicRef.current.active) {
            // VICTOIRE DÉTECTÉE
            const winner = activePlayers[0];
            cinematicRef.current.active = true;
            cinematicRef.current.winnerId = winner.playerId;
            cinematicRef.current.startTime = now;
            
            // UI Update
            const pConfig = playerConfigs.find(p => p.id === winner.playerId);
            setCinematicUI({ winnerName: pConfig?.name || 'PLAYER', color: winner.color });

            // AUDIO SEQUENCE
            AudioSystem.stopAllEngines();
            AudioSystem.cinematicBoom(); // BOOM initial
            setTimeout(() => AudioSystem.win(), 500); // Musique victorieuse

            // EXPLOSION MASSIVE (Celebration)
            for(let i=0; i<100; i++) {
                particlesRef.current.push({
                    id: `victory-part-${now}-${i}`,
                    x: winner.x, y: winner.y,
                    vx: (Math.random()-0.5)*30, vy: (Math.random()-0.5)*30,
                    life: 100 + Math.random()*50, maxLife: 150,
                    size: 5 + Math.random()*10, color: i%2===0 ? '#fbbf24' : winner.color, type: 'spark'
                });
            }
            
            // Shockwave
            particlesRef.current.push({
                id: `victory-shock-${now}`,
                x: winner.x, y: winner.y,
                vx: 0, vy: 0, life: 100, maxLife: 100, size: 10, color: 'rgba(255,255,255,0.8)', type: 'shockwave'
            });

            return; // Skip le reste de l'update pour cette frame
        }

        
        // Physique de l'eau
        updateWaterPhysics();

        // GESTION DES ARBRES (PHYSIQUE & COLLISION)
        treesRef.current.forEach(tree => updateTreePhysics(tree, dt, now));

        // GESTION DES ROCHERS (PHYSIQUE & COLLISION)
        rocksRef.current.forEach(rock => updateRockPhysics(rock, dt));
        resolveRockCollisions(tanksRef.current, rocksRef.current, bulletsRef.current, particlesRef.current, now);

        // Collisions Tanks/Balles vs Arbres
        resolveTreeCollisions(tanksRef.current, bulletsRef.current, treesRef.current, particlesRef.current, now);
        
        // NOUVEAU : Collisions Pierres vs Arbres
        resolveRockTreeCollisions(rocksRef.current, treesRef.current);
        
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
                        spinSpeed: 0.2,
                        lastShotTime: 0
                    });
                    
                    AudioSystem.repair(); // Son de déploiement
                }
            }
        });

        // --- GESTION DES DRONES (Mouvement, Tir, Physique) ---
        dronesRef.current = dronesRef.current.filter(drone => {
            if (drone.health <= 0) return false;

            // Appliquer Vélocité (notamment pour le recul après un tir)
            drone.x += drone.vx * dt;
            drone.y += drone.vy * dt;
            
            // Friction naturelle
            drone.vx *= 0.9;
            drone.vy *= 0.9;

            // Trouver Cible si nulle ou morte
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
                // Vecteur vers la cible
                const dx = targetTank.x - drone.x;
                const dy = targetTank.y - drone.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const angle = Math.atan2(dy, dx);

                // MOUVEMENT OSCILLANT
                const dirX = Math.cos(angle);
                const dirY = Math.sin(angle);
                const perpX = -dirY;
                const perpY = dirX;
                const wobble = Math.sin((now / 500) + drone.wobbleOffset) * 2; 
                
                drone.x += (dirX * DRONE_SPEED + perpX * wobble) * dt;
                drone.y += (dirY * DRONE_SPEED + perpY * wobble) * dt;

                // ATTAQUE : TIR À DISTANCE
                if (dist < DRONE_SHOOT_RANGE) {
                    if (now - (drone.lastShotTime || 0) > DRONE_SHOOT_RATE) {
                        drone.lastShotTime = now;
                        AudioSystem.shoot(); 
                        
                        bulletsRef.current.push({
                            id: `drone-b-${now}-${Math.random()}`,
                            ownerId: drone.ownerId, 
                            x: drone.x,
                            y: drone.y,
                            vx: Math.cos(angle) * BULLET_SPEED,
                            vy: Math.sin(angle) * BULLET_SPEED,
                            width: BULLET_SIZE, height: BULLET_SIZE,
                            damage: 1, 
                            angle: angle, 
                            type: WeaponType.NORMAL, bouncesLeft: 0,
                            isElectrified: false, homingTargetId: null,
                            startX: drone.x, startY: drone.y,
                            speed: BULLET_SPEED // Default speed for drone
                        });
                        
                        // Petit recul de tir
                        drone.vx -= Math.cos(angle) * 2;
                        drone.vy -= Math.sin(angle) * 2;
                    }
                }

                // KAMIKAZE (SI TRÈS PROCHE)
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
                const desiredAngle = Math.atan2(target.y - turret.y, target.x - turret.x);
                let diff = desiredAngle - turret.angle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                
                turret.angle += Math.sign(diff) * Math.min(Math.abs(diff), 0.05 * dt);

                // Tirer
                if (turret.cooldown > 0) {
                    turret.cooldown -= 1 * dt;
                } else if (Math.abs(diff) < 0.2) { 
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
                        isElectrified: false, homingTargetId: null,
                        startX: turret.x + Math.cos(turret.angle) * 30,
                        startY: turret.y + Math.sin(turret.angle) * 30,
                        speed: BULLET_SPEED
                    });
                    turret.cooldown = TURRET_COOLDOWN;
                }
            }
        });

        // --- GESTION DES USINES (PRODUCTION) ---
        factoriesRef.current.forEach(factory => {
            if (factory.isBuilt) {
                // Si pas de munitions prêtes, on produit
                if (factory.readyAmmoType === null) {
                    // Calcul progression
                    const progress = Math.min(100, ((now - factory.lastProductionTime) / FACTORY_PRODUCTION_RATE) * 100);
                    factory.productionProgress = progress;

                    if (now - factory.lastProductionTime > FACTORY_PRODUCTION_RATE) {
                        // Production terminée
                        factory.readyAmmoType = Math.random() > 0.5 ? WeaponType.HEAVY : WeaponType.BOUNCE;
                        factory.lastProductionTime = now;
                        factory.productionProgress = 100;
                        AudioSystem.repair(); // Petit son de "ding"
                        
                        // Particules
                        for(let i=0; i<10; i++) {
                            particlesRef.current.push({
                                id: `factory-prod-${now}-${i}`,
                                x: factory.x + factory.width/2, y: factory.y + factory.height/2,
                                vx: (Math.random()-0.5)*5, vy: -3,
                                life: 40, maxLife: 40, size: 3, color: '#fbbf24', type: 'smoke'
                            });
                        }
                    }
                }
            }
        });

        // Mise à jour des Tanks avec la nouvelle logique isolée
        tanksRef.current.forEach(tank => {
            
            // --- GESTION DE LA MORT ---
            if (tank.health <= 0) {
                if (!tank.isSoldier) {
                    // SI C'ÉTAIT UN TANK -> SPAWN SOLDAT + WRECK
                    AudioSystem.explode();
                    
                    // 1. Créer une carcasse persistante (Debris)
                    debrisRef.current.push({
                        id: `wreck-${now}-${tank.playerId}`,
                        x: tank.x,
                        y: tank.y,
                        rotation: tank.angle,
                        type: DebrisType.TANK_WRECK,
                        size: TANK_SIZE,
                        health: 999, // Indestructible ? ou très solide
                        color: '#1c1917'
                    });

                    // 2. Transformer le joueur en Soldat
                    // On garde le même objet tank mais on change ses propriétés
                    tank.isSoldier = true;
                    tank.health = SOLDIER_MAX_HEALTH;
                    tank.maxHealth = SOLDIER_MAX_HEALTH;
                    tank.vx = 0; tank.vy = 0;
                    tank.recoilX = 0; tank.recoilY = 0;
                    
                    // 3. Ejection vers le haut (Saut) avec grosse impulsion
                    tank.altitude = 5; 
                    tank.verticalVelocity = 18; // Grosse impulsion pour monter haut
                    
                    // FX Explosion Tank Massive
                    AudioSystem.bigExplosion();
                    for(let i=0; i<80; i++) {
                        particlesRef.current.push({
                            id: `tank-die-p-${now}-${i}`,
                            x: tank.x, y: tank.y,
                            vx: (Math.random()-0.5)*30, vy: (Math.random()-0.5)*30,
                            life: 80 + Math.random()*60, maxLife: 140, 
                            size: 4 + Math.random()*8, color: i%2===0?'#f59e0b':'#7f1d1d', type: 'fire'
                        });
                    }
                    // Onde de choc massive
                    particlesRef.current.push({
                        id: `shock-${now}`,
                        x: tank.x, y: tank.y,
                        vx: 0, vy: 0, life: 60, maxLife: 60, size: 20, color: '#fff', type: 'shockwave'
                    });
                    
                    // On continue (ne pas return) pour gérer le soldat dès cette frame
                } else {
                    // SI C'ÉTAIT DÉJÀ UN SOLDAT -> MORT DÉFINITIVE
                    return; // Le soldat est mort, on ne l'update plus
                }
            }

            // --- DEPOT RESSOURCES DANS LE BUNKER ---
            const myBunker = bunkersRef.current.find(b => b.ownerId === tank.playerId);
            if (myBunker && myBunker.health > 0) {
                if (checkCollision(tank, myBunker)) {
                    let deposited = false;
                    
                    if (tank.attachedBranches > 0) {
                        myBunker.storedWood += tank.attachedBranches;
                        tank.attachedBranches = 0;
                        deposited = true;
                    }
                    if (tank.stoneCount > 0) {
                        myBunker.storedStone += tank.stoneCount;
                        tank.stoneCount = 0;
                        deposited = true;
                    }
                    while (tank.waterCount > 0) {
                        if (myBunker.health < myBunker.maxHealth) {
                            myBunker.health = Math.min(myBunker.maxHealth, myBunker.health + 1); 
                            tank.waterCount--;
                            deposited = true;
                            particlesRef.current.push({
                                id: `steam-${now}-${Math.random()}`,
                                x: myBunker.x + myBunker.width/2, y: myBunker.y + myBunker.height/2,
                                vx: (Math.random()-0.5)*2, vy: -2, 
                                life: 60, maxLife: 60, size: 8, color: 'rgba(255,255,255,0.5)', type: 'smoke'
                            });
                        } 
                        else if ((myBunker.storedWater || 0) < BUNKER_WATER_MAX_CAPACITY) { 
                             if (!myBunker.storedWater) myBunker.storedWater = 0;
                             myBunker.storedWater++;
                             tank.waterCount--;
                             deposited = true;
                        } 
                        else {
                            break; 
                        }
                    }

                    if (deposited) {
                        AudioSystem.pickup(); 
                    }
                }
            }

            // --- STATION DE RÉPARATION (INTERACTION) ---
            const myStation = repairStationsRef.current.find(s => s.ownerId === tank.playerId);
            if (myStation && myStation.isBuilt && !tank.isSoldier) { // Soldat ne se répare pas
                // Distance Tank <-> Station pour le soin
                const dx = tank.x - (myStation.x + myStation.width/2);
                const dy = tank.y - (myStation.y + myStation.height/2);
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                // Soin uniquement si construit
                if (dist < 100 && tank.health < tank.maxHealth) {
                    if (now - myStation.lastHealTime > REPAIR_STATION_HEAL_RATE) {
                        tank.health = Math.min(tank.maxHealth, tank.health + REPAIR_STATION_HEAL_AMOUNT);
                        myStation.lastHealTime = now;
                        // Particules Soin
                        particlesRef.current.push({
                            id: `heal-${now}-${Math.random()}`,
                            x: tank.x + (Math.random()-0.5)*20,
                            y: tank.y + (Math.random()-0.5)*20,
                            vx: 0, vy: -1, life: 30, maxLife: 30, size: 4, color: '#22c55e', type: 'spark'
                        });
                    }
                }
            }

            // --- USINE MUNITIONS (COLLECTE) ---
            const myFactory = factoriesRef.current.find(f => f.ownerId === tank.playerId);
            if (myFactory && myFactory.isBuilt && myFactory.readyAmmoType !== null && !tank.isSoldier) {
                // Check Collision
                if (checkCollision(tank, myFactory)) {
                    // Collecte
                    tank.weapon = myFactory.readyAmmoType;
                    tank.ammo = FACTORY_AMMO_AMOUNT;
                    
                    myFactory.readyAmmoType = null;
                    myFactory.lastProductionTime = now;
                    myFactory.productionProgress = 0;
                    
                    AudioSystem.pickup();
                    
                    // FX
                    particlesRef.current.push({
                        id: `ammo-pickup-${now}`,
                        x: tank.x, y: tank.y,
                        vx: 0, vy: -2, life: 40, maxLife: 40, size: 0, color: '#fff', type: 'spark'
                    });
                }
            }

            const config = playerConfigs.find(c => c.id === tank.playerId);
            if (!config) return;

            const inputs = {
                up: keysPressed.current.has(config.controls.up),
                down: keysPressed.current.has(config.controls.down),
                left: keysPressed.current.has(config.controls.left),
                right: keysPressed.current.has(config.controls.right),
                shoot: keysPressed.current.has(config.controls.shoot)
            };

            updateTankBehavior(
                tank, 
                inputs, 
                wallsRef.current, 
                tanksRef.current, 
                zonesRef.current, 
                dt, 
                now, 
                bulletsRef.current,
                bunkersRef.current, 
                particlesRef.current 
            );

            tank.isInWater = false; 
            zonesRef.current.forEach(zone => {
                 resolveWaterInteraction(tank, zone, now, particlesRef.current);
                 const dx = tank.x - zone.x; const dy = tank.y - zone.y;
                 if (zone.type === TerrainType.WATER && dx*dx+dy*dy < zone.width*zone.width) {
                     tank.isInWater = true;
                 }
            });

            if (tank.isMoving && !tank.isInWater && !tank.isSoldier && tank.distanceTraveled > TRACK_SPACING) {
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
        });

        // Mise à jour Balles
        bulletsRef.current = bulletsRef.current.filter(b => {
            b.x += b.vx * dt; b.y += b.vy * dt;
            
            // Interaction Balles avec l'EAU
            zonesRef.current.forEach(z => {
                if (z.type === TerrainType.WATER) {
                    if (Math.sqrt(Math.pow(b.x - z.x, 2) + Math.pow(b.y - z.y, 2)) < z.width) {
                        disturbWater(b.x, b.y, 2, z);
                    }
                }
            });
            
            // NOUVEAU : Range dépendant de la classe (stocké indirectement ou calculé, ici simplifié via BULLET_MAX_RANGE global pour l'instant, mais l'updateTankBehavior a déjà géré la vitesse initiale)
            // Pour être précis, on pourrait stocker le maxRange dans la balle, mais on va garder simple pour l'instant
            // Le comportement des balles est géré dans updateTankBehavior pour le spawn
            const distTraveled = Math.sqrt(Math.pow(b.x - b.startX, 2) + Math.pow(b.y - b.startY, 2));
            if (distTraveled > BULLET_MAX_RANGE * 2) { // Sécurité large
                particlesRef.current.push({
                    id: `poof-${now}-${Math.random()}`,
                    x: b.x, y: b.y,
                    vx: 0, vy: 0, life: 15, maxLife: 15, size: 2, color: '#aaa', type: 'smoke'
                });
                return false;
            }

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

            // --- COLLISION REPAIR STATION ---
            for (const station of repairStationsRef.current) {
                // Hitbox AABB
                if (b.x > station.x && b.x < station.x + station.width &&
                    b.y > station.y && b.y < station.y + station.height) {
                    
                    // CAS 1: Propriétaire + Non Construit -> Construction
                    if (b.ownerId === station.ownerId && !station.isBuilt) {
                        const ownerTank = tanksRef.current.find(t => t.playerId === station.ownerId);
                        const ownerBunker = bunkersRef.current.find(bu => bu.ownerId === station.ownerId);
                        
                        // Calcul des ressources cumulées (Tank + Bunker)
                        const currentWater = (ownerTank?.waterCount || 0) + (ownerBunker?.storedWater || 0);
                        const currentWood = (ownerTank?.woodCount || 0) + (ownerBunker?.storedWood || 0);
                        const currentStone = (ownerTank?.stoneCount || 0) + (ownerBunker?.storedStone || 0);

                        if (currentWater >= REPAIR_STATION_COST_WATER &&
                            currentWood >= REPAIR_STATION_COST_WOOD &&
                            currentStone >= REPAIR_STATION_COST_STONE) {
                            
                            station.buildHits++;
                            AudioSystem.metalImpact();
                            
                            // Particules d'impact de construction
                            for(let i=0; i<5; i++) {
                                particlesRef.current.push({
                                    id: `build-hit-${now}-${Math.random()}`,
                                    x: b.x, y: b.y,
                                    vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10,
                                    life: 30, maxLife: 30, size: 3, color: '#4ade80', type: 'spark'
                                });
                            }

                            if (station.buildHits >= REPAIR_STATION_BUILD_HITS) {
                                // Construction terminée
                                station.isBuilt = true;
                                station.buildHits = 0;
                                
                                // Fonction pour déduire les ressources (Tank en priorité, puis Bunker)
                                const deductResource = (type: 'water' | 'wood' | 'stone', amount: number) => {
                                    let remaining = amount;
                                    if (ownerTank) {
                                        if (type === 'water') {
                                            const taken = Math.min(ownerTank.waterCount, remaining);
                                            ownerTank.waterCount -= taken;
                                            remaining -= taken;
                                        } else if (type === 'wood') {
                                            const taken = Math.min(ownerTank.woodCount, remaining);
                                            ownerTank.woodCount -= taken;
                                            remaining -= taken;
                                        } else if (type === 'stone') {
                                            const taken = Math.min(ownerTank.stoneCount, remaining);
                                            ownerTank.stoneCount -= taken;
                                            remaining -= taken;
                                        }
                                    }
                                    
                                    if (remaining > 0 && ownerBunker) {
                                        if (type === 'water') ownerBunker.storedWater = Math.max(0, ownerBunker.storedWater - remaining);
                                        else if (type === 'wood') ownerBunker.storedWood = Math.max(0, ownerBunker.storedWood - remaining);
                                        else if (type === 'stone') ownerBunker.storedStone = Math.max(0, ownerBunker.storedStone - remaining);
                                    }
                                };

                                deductResource('water', REPAIR_STATION_COST_WATER);
                                deductResource('wood', REPAIR_STATION_COST_WOOD);
                                deductResource('stone', REPAIR_STATION_COST_STONE);
                                
                                AudioSystem.repair();
                                for(let i=0; i<30; i++) {
                                    particlesRef.current.push({
                                        id: `build-finish-${now}-${Math.random()}`,
                                        x: station.x + Math.random()*station.width,
                                        y: station.y + Math.random()*station.height,
                                        vx: 0, vy: -2, life: 60, maxLife: 60, size: 5, color: '#22c55e', type: 'smoke'
                                    });
                                }
                            }
                            destroyed = true; // La balle est consommée pour la construction
                        } else {
                            // Pas assez de ressources, effet visuel d'échec
                             particlesRef.current.push({
                                id: `fail-${now}`, x: b.x, y: b.y, vx: 0, vy: -1, life: 20, maxLife: 20, size: 2, color: '#ef4444', type: 'smoke'
                            });
                            destroyed = true;
                        }
                    } 
                    // CAS 2: Ennemi ou Déjà construit -> Rebond
                    else if (b.ownerId !== station.ownerId || station.isBuilt) {
                        // Calcul Rebond
                        const centerX = station.x + station.width/2;
                        const centerY = station.y + station.height/2;
                        const dx = b.x - centerX;
                        const dy = b.y - centerY;
                        
                        // Simple Box Reflection
                        if (Math.abs(dx) > Math.abs(dy)) {
                            b.vx = -b.vx; 
                            b.x += Math.sign(dx) * 5; 
                        } else {
                            b.vy = -b.vy; 
                            b.y += Math.sign(dy) * 5; 
                        }
                        
                        AudioSystem.metalImpact();
                        
                        // Sparks
                        for(let i=0; i<3; i++) {
                            particlesRef.current.push({
                                id: `spark-${now}-${Math.random()}`,
                                x: b.x, y: b.y,
                                vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10,
                                life: 20, maxLife: 20, size: 2, color: '#facc15', type: 'spark'
                            });
                        }
                        // Le projectile survit (rebond)
                    } else {
                        // Propriétaire tire sur non construit sans ressources -> absorbe
                        destroyed = true; 
                    }
                }
            }
            if (destroyed) return false;

            // --- COLLISION MUNITIONS FACTORY ---
            for (const factory of factoriesRef.current) {
                if (b.x > factory.x && b.x < factory.x + factory.width && b.y > factory.y && b.y < factory.y + factory.height) {
                    
                    // CONSTRUCTION
                    if (b.ownerId === factory.ownerId && !factory.isBuilt) {
                        const ownerTank = tanksRef.current.find(t => t.playerId === factory.ownerId);
                        const ownerBunker = bunkersRef.current.find(bu => bu.ownerId === factory.ownerId);
                        
                        const currentWood = (ownerTank?.woodCount || 0) + (ownerBunker?.storedWood || 0);
                        const currentStone = (ownerTank?.stoneCount || 0) + (ownerBunker?.storedStone || 0);

                        if (currentWood >= FACTORY_COST_WOOD && currentStone >= FACTORY_COST_STONE) {
                            factory.buildHits++;
                            AudioSystem.metalImpact();
                            // Sparks
                            for(let i=0; i<5; i++) {
                                particlesRef.current.push({
                                    id: `f-build-${now}-${Math.random()}`, x: b.x, y: b.y, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, life: 30, maxLife: 30, size: 3, color: '#fbbf24', type: 'spark'
                                });
                            }

                            if (factory.buildHits >= FACTORY_BUILD_HITS) {
                                factory.isBuilt = true;
                                factory.buildHits = 0;
                                factory.lastProductionTime = now;
                                
                                const deductResource = (type: 'wood' | 'stone', amount: number) => {
                                    let remaining = amount;
                                    if (ownerTank) {
                                        if (type === 'wood') {
                                            const taken = Math.min(ownerTank.woodCount, remaining);
                                            ownerTank.woodCount -= taken;
                                            remaining -= taken;
                                        } else if (type === 'stone') {
                                            const taken = Math.min(ownerTank.stoneCount, remaining);
                                            ownerTank.stoneCount -= taken;
                                            remaining -= taken;
                                        }
                                    }
                                    if (remaining > 0 && ownerBunker) {
                                        if (type === 'wood') ownerBunker.storedWood = Math.max(0, ownerBunker.storedWood - remaining);
                                        else if (type === 'stone') ownerBunker.storedStone = Math.max(0, ownerBunker.storedStone - remaining);
                                    }
                                };
                                deductResource('wood', FACTORY_COST_WOOD);
                                deductResource('stone', FACTORY_COST_STONE);
                                
                                AudioSystem.repair();
                            }
                            destroyed = true;
                        } else {
                             particlesRef.current.push({
                                id: `fail-f-${now}`, x: b.x, y: b.y, vx: 0, vy: -1, life: 20, maxLife: 20, size: 2, color: '#ef4444', type: 'smoke'
                            });
                            destroyed = true;
                        }
                    } 
                    // REBOND SI CONSTRUIT OU ENNEMI
                    else if (b.ownerId !== factory.ownerId || factory.isBuilt) {
                        const centerX = factory.x + factory.width/2;
                        const centerY = factory.y + factory.height/2;
                        const dx = b.x - centerX; const dy = b.y - centerY;
                        if (Math.abs(dx) > Math.abs(dy)) { b.vx = -b.vx; b.x += Math.sign(dx)*5; } 
                        else { b.vy = -b.vy; b.y += Math.sign(dy)*5; }
                        AudioSystem.metalImpact();
                    } else {
                        destroyed = true;
                    }
                }
            }
            if (destroyed) return false;

            // Collision Bunkers
            for (const bunker of bunkersRef.current) {
                if (bunker.health > 0) {
                    const broadHitbox = { 
                        x: bunker.x - 20, y: bunker.y - 20, 
                        width: bunker.width + 40, height: bunker.height + 40,
                        id: 'broad', angle: 0, vx: 0, vy: 0 
                    };

                    if (checkCollision(b, broadHitbox)) {
                        if (checkCollision(b, bunker)) {
                             if (b.ownerId === bunker.ownerId && bunker.level === 1 && bunker.storedWood >= BUNKER_UPGRADE_COST_WOOD_L2 && bunker.storedStone >= BUNKER_UPGRADE_COST_STONE_L2) {
                                bunker.upgradeHits++;
                                AudioSystem.metalImpact(); 
                                destroyed = true;
                                if (bunker.upgradeHits >= BUNKER_UPGRADE_HITS_REQUIRED) {
                                    bunker.level = 2;
                                    bunker.storedWood -= BUNKER_UPGRADE_COST_WOOD_L2;
                                    bunker.storedStone -= BUNKER_UPGRADE_COST_STONE_L2;
                                    bunker.maxHealth += BUNKER_LEVEL_2_HEALTH_BONUS;
                                    bunker.health = bunker.maxHealth; 
                                    bunker.lastDroneSpawn = now;
                                    AudioSystem.cinematicBoom();
                                    for(let i=0; i<30; i++) {
                                        particlesRef.current.push({
                                            id: `upgrade-spark-${now}-${i}`,
                                            x: bunker.x + bunker.width/2, y: bunker.y + bunker.height/2,
                                            vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15,
                                            life: 60, maxLife: 60, size: 5 + Math.random()*5, color: '#4ade80', type: 'spark'
                                        });
                                    }
                                }
                                break; 
                            }

                            if (b.ownerId === bunker.ownerId && bunker.storedWood >= TURRET_COST_WOOD && bunker.storedStone >= TURRET_COST_STONE) {
                                const slots = getTurretSlots(bunker);
                                for(let i=0; i<4; i++) {
                                    if (bunker.turretBuildStatus[i] !== -1) {
                                        const dx = b.x - slots[i].x;
                                        const dy = b.y - slots[i].y;
                                        if (dx*dx + dy*dy < 400) {
                                            bunker.turretBuildStatus[i]++;
                                            AudioSystem.metalImpact(); 
                                            destroyed = true;
                                            if (bunker.turretBuildStatus[i] >= 2) {
                                                bunker.storedWood -= TURRET_COST_WOOD;
                                                bunker.storedStone -= TURRET_COST_STONE;
                                                bunker.turretBuildStatus[i] = -1;
                                                turretsRef.current.push({
                                                    id: `turret-${bunker.id}-${i}`,
                                                    ownerId: bunker.ownerId,
                                                    x: slots[i].x, y: slots[i].y, width: TURRET_SIZE, height: TURRET_SIZE,
                                                    angle: 0, vx: 0, vy: 0, health: TURRET_MAX_HEALTH, maxHealth: TURRET_MAX_HEALTH,
                                                    cooldown: 0, targetId: null, slotIndex: i
                                                });
                                                AudioSystem.repair();
                                            }
                                            break;
                                        }
                                    }
                                }
                                if(destroyed) break;
                            }
                        }

                        if (b.ownerId !== bunker.ownerId) {
                            let hitBottle = false;
                            
                            if (bunker.storedWater > 0) {
                                const maxWater = BUNKER_WATER_MAX_CAPACITY;
                                const displayCount = Math.min(bunker.storedWater, maxWater);
                                const radius = bunker.width / 2 + 12; 
                                
                                for (let i = 0; i < displayCount; i++) {
                                    const angle = (i / maxWater) * Math.PI * 2 + (now / 5000); 
                                    const bx = bunker.x + bunker.width/2 + Math.cos(angle) * radius;
                                    const by = bunker.height/2 + Math.sin(angle) * radius;

                                    const distSq = (b.x - bx)*(b.x - bx) + (b.y - by)*(b.y - by);
                                    if (distSq < 15 * 15) {
                                        bunker.storedWater--; 
                                        hitBottle = true;
                                        
                                        AudioSystem.waterDrop(); 
                                        particlesRef.current.push({
                                            id: `splash-shield-${now}`,
                                            x: bx, y: by, 
                                            vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2,
                                            life: 40, maxLife: 40, size: 0, color: '#38bdf8', type: 'spark' 
                                        });
                                        for(let k=0; k<5; k++) {
                                            particlesRef.current.push({
                                                id: `wdrop-${now}-${k}`,
                                                x: bx, y: by,
                                                vx: (Math.random()-0.5)*5, vy: (Math.random()-0.5)*5,
                                                life: 30, maxLife: 30, size: 3, color: '#bae6fd', type: 'ripple'
                                            });
                                        }
                                        break; 
                                    }
                                }
                            }

                            if (hitBottle) {
                                destroyed = true; 
                            } else if (checkCollision(b, bunker)) {
                                bunker.health -= b.damage;
                                destroyed = true;
                                AudioSystem.explode(); 
                                for(let i=0; i<5; i++) {
                                    particlesRef.current.push({
                                        id: `exp-${now}-${Math.random()}`,
                                        x: b.x, y: b.y,
                                        vx: (Math.random()-0.5)*5, vy: (Math.random()-0.5)*5,
                                        life: 20, maxLife: 20, color: '#f59e0b', size: 3, type: 'spark'
                                    });
                                }
                            }
                            
                            if (destroyed) break;
                        }
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
                     if (Math.abs(b.x - d.x) < 15 && Math.abs(b.y - d.y) < 15) {
                         d.health -= b.damage;
                         destroyed = true;
                         AudioSystem.metalImpact();
                         
                         const knockAngle = Math.atan2(d.y - b.y, d.x - b.x);
                         d.vx += Math.cos(knockAngle) * 5; 
                         d.vy += Math.sin(knockAngle) * 5;

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

        // Particules
        particlesRef.current = particlesRef.current.filter(p => {
            if (p.type === 'branch') {
                 p.life -= 16 * dt; 
                 return p.life > 0;
            }
            if (p.type === 'stone') {
                 p.x += p.vx * dt;
                 p.y += p.vy * dt;
                 p.vx *= 0.85; 
                 p.vy *= 0.85;
                 p.life -= 16 * dt;
                 return p.life > 0;
            }
            if (p.type === 'ripple') {
                p.size += 0.5 * dt; 
                p.life -= 1 * dt;
                return p.life > 0;
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= 1 * dt;
            return p.life > 0;
        });

        wallsRef.current = wallsRef.current.filter(w => w.health > 0);
    };

    // --- RENDER ---
    const draw = (now: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Reset pour avoir une base propre
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // --- GESTION CAMERA CINÉMATIQUE ---
        let zoom = 1;
        if (cinematicRef.current.active) {
            const elapsed = now - cinematicRef.current.startTime;
            
            // Zoom progressif (Lerp 1.0 -> 2.5)
            // Utilisation d'une fonction ease-out pour douceur
            const t = Math.min(1, elapsed / 4000); 
            const easeT = 1 - Math.pow(1 - t, 3);
            zoom = 1 + easeT * 1.5; 

            // Cible : Le vainqueur
            const winner = tanksRef.current.find(t => t.playerId === cinematicRef.current.winnerId);
            if (winner) {
                // Lerp caméra position
                cinematicRef.current.camX += (winner.x - cinematicRef.current.camX) * 0.05;
                cinematicRef.current.camY += (winner.y - cinematicRef.current.camY) * 0.05;
            }

            // Application Transform
            // Centrer, Zoomer, Décaler
            ctx.translate(GAME_WIDTH/2, GAME_HEIGHT/2);
            ctx.scale(zoom, zoom);
            ctx.translate(-cinematicRef.current.camX, -cinematicRef.current.camY);
        }

        drawGroundTexture(ctx);

        zonesRef.current.forEach(z => {
            if (z.type === TerrainType.WATER) {
                drawWater(ctx, z, now);
            } else {
                drawZone(ctx, z, now);
            }
        });

        tracksRef.current.forEach(t => {
            const age = now - t.createdAt;
            let opacity = 1;
            const MAX_OPACITY = 0.35; 
            const MIN_OPACITY = 0.05; 
            
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

        wallsRef.current.forEach(w => {
            if(!w.isBorder) {
                ctx.fillStyle = '#666'; ctx.fillRect(w.x, w.y, w.width, w.height);
                ctx.strokeStyle = '#444'; ctx.strokeRect(w.x, w.y, w.width, w.height);
            }
        });

        // Stations de réparation (Avant bunker pour z-index)
        repairStationsRef.current.forEach(s => {
            const ownerTank = tanksRef.current.find(t => t.playerId === s.ownerId);
            const ownerBunker = bunkersRef.current.find(b => b.ownerId === s.ownerId);
            drawRepairStation(ctx, s, now, ownerTank, ownerBunker);
        });

        // Usines de munitions
        factoriesRef.current.forEach(f => {
            const ownerTank = tanksRef.current.find(t => t.playerId === f.ownerId);
            const ownerBunker = bunkersRef.current.find(b => b.ownerId === f.ownerId);
            drawMunitionsFactory(ctx, f, now, ownerTank, ownerBunker);
        });

        bunkersRef.current.forEach(b => drawBunker(ctx, b, now));
        
        turretsRef.current.forEach(t => {
            if(t.health > 0) {
                const ownerConfig = playerConfigs.find(p => p.id === t.ownerId);
                drawTurret(ctx, t, ownerConfig?.color || '#fff', now);
            }
        });

        dronesRef.current.forEach(d => {
            if(d.health > 0) {
                 const ownerConfig = playerConfigs.find(p => p.id === d.ownerId);
                 drawDrone(ctx, d, ownerConfig?.color || '#fff', now);
            }
        });

        treesRef.current.forEach(t => {
            if (t.growth < TREE_SOLID_THRESHOLD) drawTreeFoliage(ctx, t, now);
        });

        rocksRef.current.forEach(rock => drawRock(ctx, rock));

        // Particules (Dont débris et carcasses)
        debrisRef.current.forEach(d => drawDebris(ctx, d));

        particlesRef.current.forEach(p => {
            if (p.type === 'branch') {
                ctx.save(); ctx.translate(p.x, p.y); 
                ctx.rotate(p.id.length); 
                ctx.fillStyle = p.color; 
                ctx.fillRect(-p.size/2, -1, p.size, 2);
                ctx.rotate(0.5); ctx.fillRect(0, 0, p.size/3, 1);
                ctx.restore();
            } else if (p.type === 'stone') {
                ctx.fillStyle = p.color;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size/2, 0, Math.PI*2); ctx.fill();
            } else if (p.type === 'ripple') {
                 ctx.strokeStyle = p.color;
                 ctx.lineWidth = 1;
                 ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.stroke();
            } else if (p.type === 'spark') {
                 ctx.fillStyle = p.color;
                 ctx.fillRect(p.x, p.y, p.size, p.size);
            } else if (p.type === 'shockwave') { // Effet Onde de choc
                 ctx.strokeStyle = p.color;
                 ctx.lineWidth = 4 * (1 - (now % 1000)/1000); 
                 ctx.beginPath(); ctx.arc(p.x, p.y, p.size + (100 - p.life)*10, 0, Math.PI*2); ctx.stroke();
            } else {
                ctx.fillStyle = p.color;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
            }
        });

        tanksRef.current.forEach(t => {
            // On ne dessine que les tanks/soldats vivants ou en cours de transformation (soldats éjectés)
            // Les carcasses mortes sont gérées par debrisRef désormais
            if (t.health > 0 || (t.isSoldier && t.altitude > 0)) {
                drawTank(ctx, t, isReplayMode, now);
            }
        });

        treesRef.current.forEach(t => {
            if (t.growth >= TREE_SOLID_THRESHOLD) drawTreeFoliage(ctx, t, now);
        });

        bulletsRef.current.forEach(b => {
            ctx.fillStyle = '#fbbf24'; 
            ctx.beginPath(); ctx.arc(b.x, b.y, b.width/2, 0, Math.PI*2); ctx.fill();
        });

        // --- EFFETS CINÉMATIQUES POST-RENDER ---
        if (cinematicRef.current.active) {
            ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset pour UI Overlay
            
            // Bandes Noires (Letterbox)
            const barHeight = 120;
            const animHeight = Math.min(barHeight, (now - cinematicRef.current.startTime) / 5); // Slide in rapide
            
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, GAME_WIDTH, animHeight);
            ctx.fillRect(0, GAME_HEIGHT - animHeight, GAME_WIDTH, animHeight);
            
            // Vignette
            const grad = ctx.createRadialGradient(GAME_WIDTH/2, GAME_HEIGHT/2, GAME_HEIGHT/2, GAME_WIDTH/2, GAME_HEIGHT/2, GAME_WIDTH);
            grad.addColorStop(0, 'transparent');
            grad.addColorStop(1, 'rgba(0,0,0,0.6)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        }
    };

    return (
        <div className="relative w-full h-full flex items-center justify-center bg-black">
            <canvas ref={canvasRef} width={GAME_WIDTH} height={GAME_HEIGHT} className="w-full h-auto max-h-screen object-contain bg-[#111]"/>
            
            {/* UI CINÉMATIQUE TRAILER */}
            {cinematicUI && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-50">
                    <div className="animate-fade-in-slow flex flex-col items-center">
                        <div className="text-amber-500 font-bold tracking-[1em] text-xl mb-4 drop-shadow-md animate-pulse">VICTOIRE TACTIQUE</div>
                        <h1 
                            className="text-8xl md:text-9xl font-black italic uppercase text-white drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] scale-110 transition-transform duration-[5000ms] ease-out transform"
                            style={{ 
                                textShadow: `0 0 30px ${cinematicUI.color}, 0 0 60px ${cinematicUI.color}`,
                                WebkitTextStroke: '2px rgba(255,255,255,0.5)'
                            }}
                        >
                            {cinematicUI.winnerName}
                        </h1>
                        <div className="mt-8 h-1 w-32 bg-white/50 rounded-full"></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GameCanvas;
