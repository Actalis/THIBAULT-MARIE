

import { Tree, Tank, Bullet, Particle } from '../types';
import { TANK_SIZE, TREE_SIZE, TREE_MAX_HEALTH, TREE_REGROW_DELAY, TREE_GROWTH_DURATION, TREE_SOLID_THRESHOLD } from '../constants';
import { AudioSystem } from './audio';

// --- CONSTANTES VISUELLES ---
const TRUNK_COLOR = '#4a3728'; // Marron foncé
const TRUNK_HIGHLIGHT = '#6d543e';
const FOLIAGE_BASE = '#1e5428'; // Vert Sombre
const FOLIAGE_MID = '#2e7d32'; 
const FOLIAGE_LIGHT = '#4caf50';

const PINE_BASE = '#064e3b'; // Emerald 900
const PINE_MID = '#065f46'; // Emerald 800
const PINE_LIGHT = '#10b981'; // Emerald 500

const OAK_BASE = '#3f6212'; // Lime 900
const OAK_MID = '#4d7c0f'; // Lime 700
const OAK_LIGHT = '#84cc16'; // Lime 500

// --- MISE A JOUR PHYSIQUE & LOGIQUE (Cycle de vie) ---
export const updateTreePhysics = (tree: Tree, dt: number, now: number) => {
    // 1. PHYSIQUE ELASTIQUE DOUCE (Slow Sway)
    const k = 0.04; // Raideur réduite (plus mou)
    const damp = 0.96; // Amortissement plus élevé (mouvement plus long et fluide)

    // Force de rappel vers 0
    const forceX = -k * tree.wobbleX;
    const forceY = -k * tree.wobbleY;

    // Accélération
    tree.wobbleVelX += forceX * dt;
    tree.wobbleVelY += forceY * dt;

    // Amortissement
    tree.wobbleVelX *= damp;
    tree.wobbleVelY *= damp;

    // Mise à jour position
    tree.wobbleX += tree.wobbleVelX * dt;
    tree.wobbleY += tree.wobbleVelY * dt;

    // 2. CYCLE DE VIE (Repousse)
    if (tree.health <= 0) {
        // C'est une souche. On attend le timer de repousse.
        if (tree.regrowAt > 0 && now > tree.regrowAt) {
            // Le temps d'attente est fini, l'arbre commence à repousser
            tree.health = TREE_MAX_HEALTH; 
            tree.growth = 0.1; // Commence tout petit (sapin)
            tree.regrowAt = 0; // Timer reset
            tree.isOnFire = false;
        }
    } else {
        // L'arbre est vivant. Si pas taille max, il grandit.
        if (tree.growth < 1.0) {
            // Croissance linéaire sur 5 minutes (300,000ms)
            const growthPerFrame = 1 / ( (TREE_GROWTH_DURATION / 1000) * 60 );
            tree.growth += dt * growthPerFrame;
            
            if (tree.growth > 1) tree.growth = 1;
        }
    }
};

// --- DESSIN PARTIE 2 : FEUILLAGE (Dessus le tank) ---
export const drawTreeFoliage = (ctx: CanvasRenderingContext2D, tree: Tree, now: number) => {
    if (!tree || tree.health <= 0) return;

    ctx.save();
    ctx.translate(tree.x, tree.y);
    
    // Scale de croissance
    const scale = tree.growth || 1;
    ctx.scale(scale, scale);

    // 1. TRONC (Fixe, ancré au sol, ne bouge pas avec le vent/impact)
    ctx.fillStyle = TRUNK_COLOR;
    ctx.beginPath();
    ctx.rect(-4, -2, 8, 8); // Petit tronc visible
    ctx.fill();

    // 2. FEUILLAGE (Bouge avec le wobble physique)
    ctx.save();
    ctx.translate(tree.wobbleX, tree.wobbleY); 

    // OMBRE GLOBALE
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;

    if (tree.variant === 1) {
        // --- 1. SAPIN : Simple Triangle ---
        const color = tree.isOnFire ? '#b45309' : PINE_BASE;
        ctx.fillStyle = color;
        
        ctx.beginPath();
        const w = tree.size * 0.7; // Largeur base
        const h = tree.size * 1.4; // Hauteur
        ctx.moveTo(0, -h); // Pointe
        ctx.lineTo(w, 0);  // Bas Droite
        ctx.lineTo(-w, 0); // Bas Gauche
        ctx.closePath();
        ctx.fill();

        // Petit reflet
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.moveTo(0, -h + 5);
        ctx.lineTo(5, -5);
        ctx.lineTo(0, -5);
        ctx.fill();

    } else if (tree.variant === 2) {
        // --- 2. ROND AVEC COEUR : Cercle + Petit Cercle ---
        const base = tree.isOnFire ? '#b45309' : OAK_BASE;
        const inner = tree.isOnFire ? '#fbbf24' : OAK_MID;

        // Grand Cercle
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.arc(0, -10, tree.size * 0.6, 0, Math.PI*2);
        ctx.fill();

        // Petit Cercle Intérieur
        ctx.fillStyle = inner;
        ctx.beginPath();
        ctx.arc(0, -10, tree.size * 0.3, 0, Math.PI*2);
        ctx.fill();

    } else {
        // --- 3. STANDARD (Ecrasé) : Ovale ---
        const color = tree.isOnFire ? '#b45309' : FOLIAGE_BASE;
        ctx.fillStyle = color;
        
        ctx.beginPath();
        // Ellipse simple
        ctx.ellipse(0, -8, tree.size * 0.7, tree.size * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Highlight léger sur le dessus
        ctx.fillStyle = tree.isOnFire ? '#fbbf24' : FOLIAGE_LIGHT;
        ctx.beginPath();
        ctx.ellipse(0, -12, tree.size * 0.4, tree.size * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Effet de feu
    if (tree.isOnFire) {
        if (Math.random() > 0.7) {
            ctx.fillStyle = '#ef4444';
            ctx.beginPath(); ctx.arc((Math.random()-0.5)*20, -15 + (Math.random()-0.5)*20, 3, 0, Math.PI*2); ctx.fill();
        }
    }

    ctx.restore(); // Fin wobble
    ctx.restore(); // Fin global
};

// --- LOGIQUE DE COLLECTE DE BRANCHES ET PIERRES ---
export const resolveDebrisCollection = (tanks: Tank[], particlesRef: Particle[]) => {
    for (let i = particlesRef.length - 1; i >= 0; i--) {
        const p = particlesRef[i];
        if (p.type !== 'branch' && p.type !== 'stone') continue;

        for (const tank of tanks) {
            if (tank.health <= 0) continue;
            
            const dx = tank.x - p.x;
            const dy = tank.y - p.y;
            if (dx*dx + dy*dy < (TANK_SIZE/2 + 10) * (TANK_SIZE/2 + 10)) {
                if (p.type === 'branch') {
                    tank.attachedBranches = (tank.attachedBranches || 0) + 1;
                } else if (p.type === 'stone') {
                    tank.stoneCount = (tank.stoneCount || 0) + 1;
                }
                particlesRef.splice(i, 1);
                break; 
            }
        }
    }
};

// --- PHYSIQUE (COLLISIONS) ---

export const resolveTreeCollisions = (
    tanks: Tank[], 
    bullets: Bullet[], 
    trees: Tree[],
    particlesRef: Particle[],
    now: number
) => {
    // 1. Collisions TANK vs ARBRE
    tanks.forEach(tank => {
        if (tank.health <= 0) return;

        trees.forEach(tree => {
            if (tree.health <= 0) return;

            const dx = tank.x - tree.x;
            const dy = tank.y - tree.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            const centerBlockRadius = 15; // Hitbox tronc réduite
            const hitboxTank = tank.isSoldier ? (TANK_SIZE/2 - 10) : TANK_SIZE/2;
            const minDist = centerBlockRadius + hitboxTank;

            if (dist < minDist) {
                const angle = Math.atan2(dy, dx);
                const pushX = Math.cos(angle);
                const pushY = Math.sin(angle);

                if (tree.growth < TREE_SOLID_THRESHOLD) {
                    // ** PETIT ARBRE (Traversable mais ralentit) **
                    tank.vx *= 0.8; 
                    tank.vy *= 0.8;
                    // Faire bouger l'arbre
                    const tankSpeed = Math.sqrt(tank.vx*tank.vx + tank.vy*tank.vy);
                    if (tankSpeed > 0.1 && !tank.isSoldier) { // Soldat bouge peu l'arbre
                        tree.wobbleVelX -= tank.vx * 0.1;
                        tree.wobbleVelY -= tank.vy * 0.1;
                    }
                } else {
                    // ** GRAND ARBRE (Solide) **
                    const overlap = minDist - dist;
                    tank.x += pushX * overlap;
                    tank.y += pushY * overlap;

                    // EFFET VISUEL (Impact) - Seulement si c'est un tank
                    if (!tank.isSoldier) {
                        // REBOND DU TANK
                        tank.vx -= pushX * 2.0;
                        tank.vy -= pushY * 2.0;
                        tank.vx *= 0.5; 
                        tank.vy *= 0.5;

                        tree.wobbleVelX += pushX * 0.4;
                        tree.wobbleVelY += pushY * 0.4;
                        
                        // SON
                        const tankSpeed = Math.sqrt(tank.vx*tank.vx + tank.vy*tank.vy);
                        const IMPACT_COOLDOWN = 1000;
                        if (tankSpeed > 1.0) {
                            if (!tank.lastImpactTime || now - tank.lastImpactTime > IMPACT_COOLDOWN) {
                                AudioSystem.bushImpact();
                                tank.lastImpactTime = now;
                            }
                        }
                    } else {
                        // REBOND DU SOLDAT (Sans faire bouger l'arbre)
                        tank.vx -= pushX * 3.0; // Rebond sec
                        tank.vy -= pushY * 3.0;
                        tank.vx *= 0.5;
                        tank.vy *= 0.5;
                    }
                }
            }
        });
    });

    // 2. Collisions BALLES vs ARBRE (Reste identique)
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        let bulletDestroyed = false;

        for (const tree of trees) {
            if (tree.health <= 0) continue;

            const dx = b.x - tree.x;
            const dy = b.y - tree.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            // Touche le feuillage
            if (dist < tree.size * 0.6) { // Hitbox feuillage
                tree.health -= b.damage; 
                bulletDestroyed = true;
                AudioSystem.bushImpact();

                const bulletAngle = Math.atan2(b.vy, b.vx);
                tree.wobbleVelX += Math.cos(bulletAngle) * 3.0; 
                tree.wobbleVelY += Math.sin(bulletAngle) * 3.0;

                particlesRef.push({
                    id: `branch-${now}-${Math.random()}`,
                    x: b.x, y: b.y + 20, vx: 0, vy: 0, life: 60000, maxLife: 60000, size: 8 + Math.random() * 8, color: TRUNK_COLOR, type: 'branch'
                });
                
                for(let p=0; p<4; p++) {
                    particlesRef.push({
                        id: `leaf-${now}-${Math.random()}`,
                        x: b.x, y: b.y, vx: (Math.random()-0.5)*2 + b.vx*0.05, vy: (Math.random()-0.5)*2 + b.vy*0.05, life: 40 + Math.random()*20, maxLife: 60, size: 3 + Math.random()*3, color: FOLIAGE_MID, type: 'leaf'
                    });
                }

                if (tree.health <= 0) {
                   tree.regrowAt = now + TREE_REGROW_DELAY; 
                   for(let k=0; k<10; k++) {
                       particlesRef.push({
                           id: `leaf-die-${now}-${k}`,
                           x: tree.x + (Math.random()-0.5)*30, y: tree.y - 30 + (Math.random()-0.5)*30, vx: (Math.random()-0.5)*4, vy: (Math.random()-0.5)*4, life: 60, maxLife: 60, size: 4, color: FOLIAGE_LIGHT, type: 'leaf'
                       });
                   }
                }
                break;
            }
        }

        if (bulletDestroyed) {
            bullets.splice(i, 1);
        }
    }
};
