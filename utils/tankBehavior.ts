

import { Tank, Wall, Bunker, Bullet, WeaponType, TerrainZone, TerrainType, Particle } from '../types';
import { 
    GAME_WIDTH, GAME_HEIGHT, TANK_SPEED, TANK_ROTATION_SPEED, 
    TANK_SIZE, BULLET_SPEED, BULLET_SIZE, COOLDOWN_FRAMES, 
    TERRAIN_MODIFIERS, XP_PER_DISTANCE, TANK_HITBOX_SIZE, DEBRIS_SLOW_FACTOR 
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
    // On vérifie quelques particules, pas toutes pour la perf, mais ici la liste est globale
    // On peut optimiser si besoin, mais une boucle simple suffit pour < 100 particules
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
            moveSpeed = TANK_SPEED * terrainMod;
            tank.isMoving = true;
        } else if (inputs.down) {
            moveSpeed = -TANK_SPEED * 0.6 * terrainMod;
            tank.isMoving = true;
        }
    }

    // Boost de vitesse par niveau
    const speedBuff = 1 + ((tank.level - 1) * 0.05);
    moveSpeed *= speedBuff;

    // Application Rotation
    tank.angle += rotateDir * TANK_ROTATION_SPEED * dt;

    // Application Vélocité (Physique simple)
    tank.vx = (Math.cos(tank.angle) * moveSpeed) * dt;
    tank.vy = (Math.sin(tank.angle) * moveSpeed) * dt;

    // Calcul Future Position
    // Ajout du recul (recoil) s'il y a lieu
    const nextX = tank.x + tank.vx + (tank.recoilX * dt);
    const nextY = tank.y + tank.vy + (tank.recoilY * dt);
    
    // Amortissement du recul
    tank.recoilX *= 0.9;
    tank.recoilY *= 0.9;

    // 3. Collisions Murs & BUNKERS
    let collided = false;
    const futureHitbox = { 
        x: nextX - TANK_HITBOX_SIZE/2, 
        y: nextY - TANK_HITBOX_SIZE/2, 
        width: TANK_HITBOX_SIZE, 
        height: TANK_HITBOX_SIZE, 
        id: 'temp', angle: 0, vx: 0, vy: 0 
    };

    // Vérif Murs
    for (const w of walls) {
        if (checkCollision(futureHitbox, w)) {
            collided = true;
            break;
        }
    }

    // Vérif Bunkers (Ennemis uniquement)
    if (!collided) {
        for (const b of bunkers) {
            if (b.health > 0 && b.ownerId !== tank.playerId) { // On ne traverse pas les bunkers ennemis
                if (checkCollision(futureHitbox, b)) {
                    collided = true;
                    break;
                }
            }
        }
    }

    // Vérif Autres Tanks (Simple répulsion)
    if (!collided) {
        for (const other of tanks) {
            if (other === tank || other.health <= 0) continue;
            const dx = nextX - other.x;
            const dy = nextY - other.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < TANK_SIZE) {
                collided = true;
                // Petit effet de rebond
                tank.recoilX += (dx/dist) * 2;
                tank.recoilY += (dy/dist) * 2;
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

    // Audio Moteur (Avec détection de blocage)
    // Si on voulait bouger mais qu'on a collisionné -> isBlocked
    // On ajoute un son plus grave si on roule sur des cailloux (onDebris)
    AudioSystem.updateEngine(tank.id, tank.isMoving ? moveSpeed : 0, TANK_SPEED * 1.5, onDebris ? TerrainType.MUD : currentTerrain, wasTryingToMove && collided);

    // XP par distance
    if (tank.isMoving && !collided) {
        tank.treadOffset += Math.abs(moveSpeed) * dt;
        tank.distanceTraveled += Math.abs(moveSpeed) * dt;
        tank.xp += XP_PER_DISTANCE * Math.abs(moveSpeed/TANK_SPEED) * dt;
    }

    // 4. Tir
    if (tank.cooldown > 0) tank.cooldown -= 1 * dt;
    
    if (inputs.shoot && tank.cooldown <= 0 && tank.stunnedUntil < now) {
        AudioSystem.shoot();
        const barrelLen = TANK_SIZE / 2 + 18;
        
        // Recul du tir
        tank.recoilX -= Math.cos(tank.angle) * 3;
        tank.recoilY -= Math.sin(tank.angle) * 3;

        // Création Projectile
        bulletsRef.push({
            id: `b-${now}-${tank.playerId}-${Math.random()}`,
            ownerId: tank.playerId,
            x: tank.x + Math.cos(tank.angle) * barrelLen,
            y: tank.y + Math.sin(tank.angle) * barrelLen,
            vx: Math.cos(tank.angle) * BULLET_SPEED,
            vy: Math.sin(tank.angle) * BULLET_SPEED,
            width: BULLET_SIZE, 
            height: BULLET_SIZE,
            damage: tank.weapon === WeaponType.HEAVY ? 2 : 1, 
            angle: tank.angle, 
            type: tank.weapon, 
            bouncesLeft: tank.weapon === WeaponType.BOUNCE ? 1 : 0,
            isElectrified: false,
            homingTargetId: null
        });

        // Gestion munitions
        if (tank.weapon !== WeaponType.NORMAL) {
            tank.ammo--;
            if (tank.ammo <= 0) tank.weapon = WeaponType.NORMAL;
        }

        // Cooldown plus court pour soldat
        tank.cooldown = tank.isSoldier ? 8 : COOLDOWN_FRAMES;
    }
};
