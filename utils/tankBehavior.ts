

import { Tank, Wall, Bunker, Bullet, WeaponType, TerrainZone, TerrainType, Particle } from '../types';
import { 
    GAME_WIDTH, GAME_HEIGHT, TANK_ROTATION_SPEED, 
    TANK_SIZE, BULLET_SIZE, 
    TERRAIN_MODIFIERS, XP_PER_DISTANCE, TANK_HITBOX_SIZE, DEBRIS_SLOW_FACTOR,
    CLASS_STATS, SOLDIER_SPEED, SOLDIER_BURST_COUNT, SOLDIER_RELOAD_TIME, SOLDIER_DAMAGE // NOUVEAU
} from '../constants';
import { checkCollision } from './gameLogic';
import { AudioSystem } from './audio';

// --- LOGIQUE PURE DU TANK ---

export const updateTankBehavior = (
    tank: Tank, 
    inputs: { up: boolean, down: boolean, left: boolean, right: boolean, shoot: boolean },
    walls: Wall[],
    tanks: Tank[], // Pour collision tank vs tank
    zones: TerrainZone[],
    dt: number, // Delta time / timeScale
    now: number,
    bulletsRef: Bullet[], // Pour ajouter des balles
    bunkers: Bunker[] = [], // Ajout des bunkers pour collision
    particles: Particle[] = [] // Pour détecter les débris au sol
) => {
    if (tank.health <= 0) return;

    // --- PHYSIQUE EJECTION / SAUT / PARACHUTE ---
    if (tank.altitude > 0 || tank.verticalVelocity !== 0) {
        let gravity = -0.6; // Gravité normale (montée)
        
        // Si on redescend et qu'on est un soldat -> PARACHUTE (Chute lente)
        if (tank.isSoldier && tank.verticalVelocity < 0) {
            gravity = -0.05; // Très faible gravité (plane)
            // On limite aussi la vitesse de chute max
            if (tank.verticalVelocity < -2) tank.verticalVelocity = -2;
        }

        tank.verticalVelocity += gravity * dt;
        tank.altitude += tank.verticalVelocity * dt;

        // Atterrissage
        if (tank.altitude <= 0) {
            tank.altitude = 0;
            tank.verticalVelocity = 0;
            // Impact au sol
            if (!tank.lastImpactTime || now - tank.lastImpactTime > 500) {
                AudioSystem.crush(); // Petit bruit de chute
                tank.lastImpactTime = now;
            }
        }
    }

    // --- RECHARGEMENT SOLDAT ---
    if (tank.isSoldier && tank.soldierReloadTimer > 0) {
        tank.soldierReloadTimer -= 16 * dt; // approx 16ms per frame
        if (tank.soldierReloadTimer < 0) {
            tank.soldierReloadTimer = 0;
            tank.soldierBurstCount = 0; // Prêt à tirer
        }
    }

    // RECUPERATION DES STATS DE LA CLASSE OU DU SOLDAT
    const speed = tank.isSoldier ? SOLDIER_SPEED : CLASS_STATS[tank.tankClass].speed;

    // 1. Détection du Terrain
    let currentTerrain = TerrainType.ASPHALT;
    // On check le centre du tank
    for (const zone of zones) {
        // Simple check rectangulaire ou circulaire
        if (zone.shape === 'rect') {
             if (tank.x >= zone.x && tank.x <= zone.x + zone.width && tank.y >= zone.y && tank.y <= zone.y + zone.height) {
                 currentTerrain = zone.type;
             }
        } else {
             const dx = tank.x - zone.x;
             const dy = tank.y - zone.y;
             if (dx*dx + dy*dy < zone.width * zone.width) {
                 currentTerrain = zone.type;
             }
        }
    }
    let terrainMod = TERRAIN_MODIFIERS[currentTerrain] || 1.0;

    // 1.5. Détection Débris (Pierres au sol) = Ralentissement
    let onDebris = false;
    for (const p of particles) {
        if (p.type === 'stone') {
            const dx = tank.x - p.x;
            const dy = tank.y - p.y;
            if (dx*dx + dy*dy < (TANK_SIZE/2)*(TANK_SIZE/2)) {
                onDebris = true;
                break;
            }
        }
    }
    if (onDebris) {
        terrainMod *= DEBRIS_SLOW_FACTOR;
    }

    // 2. Gestion des Inputs & Mouvement
    // Si en l'air, contrôle très réduit
    const airControl = tank.altitude > 0 ? 0.1 : 1.0;

    tank.isMoving = false;
    let moveSpeed = 0;
    let rotateDir = 0;
    const wasTryingToMove = inputs.up || inputs.down;

    if (tank.stunnedUntil > now) {
        // Immobilisé
    } else {
        if (inputs.left) rotateDir = -1;
        if (inputs.right) rotateDir = 1;
        
        if (inputs.up) {
            moveSpeed = speed * terrainMod * airControl;
            tank.isMoving = true;
        } else if (inputs.down) {
            moveSpeed = -speed * 0.6 * terrainMod * airControl;
            tank.isMoving = true;
        }
    }

    // Boost de vitesse par niveau (Pas pour le soldat)
    if (!tank.isSoldier) {
        const speedBuff = 1 + ((tank.level - 1) * 0.05);
        moveSpeed *= speedBuff;
    }

    // Application Rotation
    tank.angle += rotateDir * TANK_ROTATION_SPEED * dt;

    // Application Vélocité (Physique simple)
    tank.vx = (Math.cos(tank.angle) * moveSpeed) * dt;
    tank.vy = (Math.sin(tank.angle) * moveSpeed) * dt;

    // Calcul Future Position
    const nextX = tank.x + tank.vx + (tank.recoilX * dt);
    const nextY = tank.y + tank.vy + (tank.recoilY * dt);
    
    // Amortissement du recul
    tank.recoilX *= 0.9;
    tank.recoilY *= 0.9;

    // 3. Collisions Murs & BUNKERS
    let collided = false;
    const hitboxSize = tank.isSoldier ? 10 : TANK_HITBOX_SIZE;
    const futureHitbox = { 
        x: nextX - hitboxSize/2, 
        y: nextY - hitboxSize/2, 
        width: hitboxSize, 
        height: hitboxSize, 
        id: 'temp', angle: 0, vx: 0, vy: 0 
    };

    // Vérif Murs (Si en l'air, on passe au dessus des petits murs ? Non, restons simple pour l'instant)
    for (const w of walls) {
        if (checkCollision(futureHitbox, w)) {
            collided = true;
            break;
        }
    }

    // Vérif Bunkers (Ennemis uniquement)
    if (!collided) {
        for (const b of bunkers) {
            if (b.health > 0 && b.ownerId !== tank.playerId) { 
                if (checkCollision(futureHitbox, b)) {
                    collided = true;
                    break;
                }
            }
        }
    }

    // Vérif Autres Tanks (Collision simple)
    if (!collided) {
        for (const other of tanks) {
            if (other === tank || other.health <= 0) continue;
            
            // --- LOGIQUE HIJACK (VOL DE TANK) ---
            // Uniquement si on est soldat, au sol, et qu'on touche un tank ennemi
            if (tank.isSoldier && !other.isSoldier && other.playerId !== tank.playerId && tank.altitude <= 5) {
                const dx = other.x - tank.x;
                const dy = other.y - tank.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                // Si on est proche du tank
                if (dist < TANK_SIZE/2 + 20) {
                    // Calcul position arrière du tank cible
                    // angle 0 = droite (maths standard), le sprite est orienté vers la droite par défaut
                    const rearX = other.x - Math.cos(other.angle) * 35;
                    const rearY = other.y - Math.sin(other.angle) * 35;
                    
                    const distToRear = Math.sqrt(Math.pow(tank.x - rearX, 2) + Math.pow(tank.y - rearY, 2));
                    
                    // Zone de capture agrandie (40px)
                    if (distToRear < 40) {
                        // HIJACK SUCCESS !
                        // Le tank cible devient le tank du joueur actuel (Voleur)
                        tank.x = other.x;
                        tank.y = other.y;
                        tank.isSoldier = false;
                        tank.health = other.health;
                        tank.maxHealth = other.maxHealth;
                        tank.tankClass = other.tankClass;
                        tank.altitude = 0;
                        tank.verticalVelocity = 0;
                        
                        // La victime devient un soldat éjecté
                        other.isSoldier = true;
                        other.health = 1;
                        other.maxHealth = 1;
                        other.x -= Math.cos(other.angle) * 60; // Ejecté plus loin derrière
                        other.y -= Math.sin(other.angle) * 60;
                        other.stunnedUntil = now + 1000;
                        
                        // Ejection en l'air pour la victime
                        other.altitude = 15;
                        other.verticalVelocity = 10;
                        
                        AudioSystem.metalImpact();
                        return;
                    }
                }
            }

            // --- LOGIQUE COLLISION PHYSIQUE ---
            const dx = nextX - other.x;
            const dy = nextY - other.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const collisionDist = tank.isSoldier ? (TANK_SIZE/2 + 10) : TANK_SIZE;
            
            if (dist < collisionDist) {
                collided = true;
                
                if (tank.isSoldier && !other.isSoldier) {
                    // CAS 1: JE suis Soldat vs Tank
                    // Je rebondis, mais je ne pousse PAS le tank (masse infinie relative)
                    tank.recoilX += (dx/dist) * 2;
                    tank.recoilY += (dy/dist) * 2;
                } else if (!tank.isSoldier && other.isSoldier) {
                    // CAS 2: JE suis Tank vs Soldat
                    // Je l'ignore complètement dans ma physique (je ne suis pas bloqué)
                    // C'est le soldat qui gère son rebond dans son update à lui
                    collided = false; 
                } else {
                    // CAS 3: Tank vs Tank ou Soldat vs Soldat
                    // Poussée mutuelle
                    tank.recoilX += (dx/dist) * 2;
                    tank.recoilY += (dy/dist) * 2;
                }
            }
        }
    }

    // Application position si pas de collision majeure
    if (!collided) {
        tank.x = nextX;
        tank.y = nextY;
    } else {
        // On glisse un peu quand même pour ne pas être "collé"
        tank.x += tank.recoilX * dt;
        tank.y += tank.recoilY * dt;
    }

    // Limites du monde (Sécurité absolue)
    tank.x = Math.max(20, Math.min(GAME_WIDTH - 20, tank.x));
    tank.y = Math.max(20, Math.min(GAME_HEIGHT - 20, tank.y));

    // Audio Moteur (Pas de son moteur pour soldat, juste bruits de pas gérés dans render ou ici très bas)
    if (!tank.isSoldier) {
        AudioSystem.updateEngine(tank.id, tank.isMoving ? moveSpeed : 0, speed * 1.5, onDebris ? TerrainType.MUD : currentTerrain, wasTryingToMove && collided);
    }

    // XP par distance (Seulement tank)
    if (tank.isMoving && !collided && !tank.isSoldier) {
        tank.treadOffset += Math.abs(moveSpeed) * dt;
        tank.distanceTraveled += Math.abs(moveSpeed) * dt;
        tank.xp += XP_PER_DISTANCE * Math.abs(moveSpeed/speed) * dt;
    }

    // 4. Tir (Seulement si au sol)
    if (tank.cooldown > 0) tank.cooldown -= 1 * dt;
    
    if (inputs.shoot && tank.cooldown <= 0 && tank.stunnedUntil < now && tank.altitude <= 5) {
        
        if (tank.isSoldier) {
            // LOGIQUE RAFALE SOLDAT
            if (tank.soldierReloadTimer <= 0 && tank.soldierBurstCount < SOLDIER_BURST_COUNT) {
                // Tir
                AudioSystem.shoot();
                tank.soldierBurstCount++;
                
                // Création Balle Soldat
                bulletsRef.push({
                    id: `sb-${now}-${tank.playerId}-${Math.random()}`,
                    ownerId: tank.playerId,
                    x: tank.x, y: tank.y,
                    vx: Math.cos(tank.angle) * 12, // Plus lent que tank
                    vy: Math.sin(tank.angle) * 12,
                    width: 6, height: 6, // Plus petite balle
                    damage: SOLDIER_DAMAGE, // 0.34
                    angle: tank.angle + (Math.random()-0.5)*0.2, // Imprécision
                    type: WeaponType.NORMAL,
                    bouncesLeft: 0, isElectrified: false, homingTargetId: null,
                    startX: tank.x, startY: tank.y,
                    speed: 12
                });

                tank.cooldown = 5; // Cadence très rapide intra-rafale

                if (tank.soldierBurstCount >= SOLDIER_BURST_COUNT) {
                    tank.soldierReloadTimer = SOLDIER_RELOAD_TIME; // Rechargement
                }
            }
        } else {
            // LOGIQUE TANK STANDARD
            AudioSystem.shoot();
            const barrelLen = TANK_SIZE / 2 + 18;
            
            // Recul du tir
            tank.recoilX -= Math.cos(tank.angle) * 3;
            tank.recoilY -= Math.sin(tank.angle) * 3;

            const bx = tank.x + Math.cos(tank.angle) * barrelLen;
            const by = tank.y + Math.sin(tank.angle) * barrelLen;

            // Stats de la classe
            const stats = CLASS_STATS[tank.tankClass];

            // Création Projectile
            bulletsRef.push({
                id: `b-${now}-${tank.playerId}-${Math.random()}`,
                ownerId: tank.playerId,
                x: bx,
                y: by,
                vx: Math.cos(tank.angle) * stats.bulletSpeed, 
                vy: Math.sin(tank.angle) * stats.bulletSpeed,
                width: BULLET_SIZE, 
                height: BULLET_SIZE,
                damage: tank.weapon === WeaponType.HEAVY ? stats.damage * 2 : stats.damage, 
                angle: tank.angle, 
                type: tank.weapon, 
                bouncesLeft: tank.weapon === WeaponType.BOUNCE ? 1 : 0,
                isElectrified: false,
                homingTargetId: null,
                startX: bx,
                startY: by,
                speed: stats.bulletSpeed 
            });

            // Gestion munitions
            if (tank.weapon !== WeaponType.NORMAL) {
                tank.ammo--;
                if (tank.ammo <= 0) tank.weapon = WeaponType.NORMAL;
            }

            tank.cooldown = stats.cooldown;
        }
    }
};
