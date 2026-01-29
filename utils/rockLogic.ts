
import { Rock, Tank, Bullet, Particle } from '../types';
import { ROCK_PUSH_FRICTION, TANK_SIZE, ROCK_MAX_HEALTH } from '../constants';
import { checkCollision } from './gameLogic';
import { AudioSystem } from './audio';

// --- GENERATION VISUELLE ---
export const generateRockShape = (size: number): {x:number, y:number}[] => {
    const points = [];
    const numPoints = 8;
    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        // Variation aléatoire du rayon pour faire "caillou"
        const r = (size / 2) * (0.8 + Math.random() * 0.4);
        points.push({
            x: Math.cos(angle) * r,
            y: Math.sin(angle) * r
        });
    }
    return points;
};

// --- DESSIN ---
export const drawRock = (ctx: CanvasRenderingContext2D, rock: Rock) => {
    if (rock.health <= 0) return;

    ctx.save();
    ctx.translate(rock.x, rock.y);
    ctx.rotate(rock.rotation);

    // Ombre
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(5, 5, rock.width/2, 0, Math.PI*2);
    ctx.fill();

    // Corps du rocher
    const damage = 1 - (rock.health / rock.maxHealth);
    
    // Couleur grise, s'assombrit légèrement avec les dégâts
    // Calcul d'une couleur grise de base
    ctx.fillStyle = damage > 0.5 ? '#57534e' : '#78716c'; 
    
    ctx.beginPath();
    if (rock.shapePoints && rock.shapePoints.length > 0) {
        // Redimensionner les points en fonction de la santé (Grignotage)
        const scale = 0.5 + 0.5 * (rock.health / rock.maxHealth);
        ctx.scale(scale, scale);
        
        ctx.moveTo(rock.shapePoints[0].x, rock.shapePoints[0].y);
        for (let i = 1; i < rock.shapePoints.length; i++) {
            ctx.lineTo(rock.shapePoints[i].x, rock.shapePoints[i].y);
        }
        ctx.closePath();
    } else {
        // Fallback cercle
        const radius = (rock.width/2) * (0.5 + 0.5 * (rock.health/rock.maxHealth));
        ctx.arc(0, 0, radius, 0, Math.PI*2);
    }
    ctx.fill();

    // Détails / Relief
    ctx.strokeStyle = '#44403c';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Fissures si endommagé
    if (damage > 0.2) {
        ctx.beginPath();
        ctx.moveTo(-5, -5); ctx.lineTo(0, 0); ctx.lineTo(5, -2);
        ctx.stroke();
    }

    ctx.restore();
};

// --- PHYSIQUE & COLLISIONS ---

export const updateRockPhysics = (rock: Rock, dt: number) => {
    // Appliquer vélocité
    rock.x += rock.vx * dt;
    rock.y += rock.vy * dt;

    // Friction très forte (Objet lourd qui ne glisse pas)
    rock.vx *= ROCK_PUSH_FRICTION;
    rock.vy *= ROCK_PUSH_FRICTION;

    // Arrêt complet si très lent
    if (Math.abs(rock.vx) < 0.05) rock.vx = 0;
    if (Math.abs(rock.vy) < 0.05) rock.vy = 0;
};

export const resolveRockCollisions = (
    tanks: Tank[],
    rocks: Rock[],
    bullets: Bullet[],
    particlesRef: Particle[],
    now: number
) => {
    // 1. TANK vs ROCK (Poussée)
    tanks.forEach(tank => {
        if (tank.health <= 0) return;

        rocks.forEach(rock => {
            if (rock.health <= 0) return;

            // Hitbox circulaire simplifiée pour la physique de poussée
            const dx = tank.x - rock.x;
            const dy = tank.y - rock.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            // Le rocher rétrécit visuellement mais garde sa "masse" un peu
            const currentRockRadius = (rock.width / 2) * (0.6 + 0.4 * (rock.health/rock.maxHealth));
            const minDist = (TANK_SIZE/2) + currentRockRadius;

            if (dist < minDist) {
                // Collision !
                const angle = Math.atan2(dy, dx);
                const pushX = Math.cos(angle);
                const pushY = Math.sin(angle);
                
                const overlap = minDist - dist;

                // Le tank est repoussé (ne peut pas traverser)
                tank.x += pushX * overlap * 0.5;
                tank.y += pushY * overlap * 0.5;
                
                // Transfert d'énergie : Le tank pousse le rocher
                // Si le tank avançait vers le rocher
                const tankSpeed = Math.sqrt(tank.vx*tank.vx + tank.vy*tank.vy);
                if (tankSpeed > 0.1) {
                    // Pousser le rocher (Lentement)
                    rock.vx -= pushX * 0.5; 
                    rock.vy -= pushY * 0.5;
                    
                    // Ralentir énormément le tank (Effort)
                    tank.vx *= 0.2;
                    tank.vy *= 0.2;
                    
                    // Bruit de frottement pierre (Optionnel, ou réutiliser bushImpact bas pitch)
                }
            }
        });
    });

    // 2. BULLET vs ROCK (Grignotage)
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        let hit = false;

        for (const rock of rocks) {
            if (rock.health <= 0) continue;

            const dx = b.x - rock.x;
            const dy = b.y - rock.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            // Hitbox ajustée à la taille actuelle
            const currentRadius = (rock.width / 2) * (0.5 + 0.5 * (rock.health/rock.maxHealth));

            if (dist < currentRadius) {
                // IMPACT
                rock.health -= b.damage;
                hit = true;
                AudioSystem.metalImpact(); // Son dur

                // Spawn Debris (Cailloux au sol)
                // On réduit à 1 pierre par impact pour moins encombrer
                // Ejection vers l'extérieur (dans le sens de l'impact radial)
                for(let k=0; k<1; k++) {
                    const angle = Math.atan2(dy, dx); // Angle depuis le centre vers l'impact
                    const spread = (Math.random() - 0.5) * 0.8; // Dispersion
                    const velocity = 3 + Math.random() * 3; // Vitesse d'éjection

                    particlesRef.push({
                        id: `stone-chip-${now}-${Math.random()}`,
                        // On commence un peu à l'extérieur pour ne pas être "dans" le rocher
                        x: b.x + Math.cos(angle) * 8,
                        y: b.y + Math.sin(angle) * 8,
                        // Vitesse vers l'extérieur
                        vx: Math.cos(angle + spread) * velocity,
                        vy: Math.sin(angle + spread) * velocity,
                        life: 60000, // Reste 1 min
                        maxLife: 60000,
                        color: '#a8a29e',
                        size: 4 + Math.random() * 4,
                        type: 'stone' // Nouveau type de particule persistante
                    });
                }
                
                // Particules volatiles (poussière)
                for(let k=0; k<3; k++) {
                    particlesRef.push({
                        id: `dust-${now}-${Math.random()}`,
                        x: b.x, y: b.y,
                        vx: (Math.random()-0.5)*3, vy: (Math.random()-0.5)*3,
                        life: 20, maxLife: 20, color: '#d6d3d1', size: 3, type: 'smoke'
                    });
                }

                if (rock.health <= 0) {
                    // Destruction finale : Gros tas de cailloux qui explose
                    for(let k=0; k<5; k++) {
                        particlesRef.push({
                            id: `stone-final-${now}-${k}`,
                            x: rock.x + (Math.random()-0.5)*20,
                            y: rock.y + (Math.random()-0.5)*20,
                            vx: (Math.random()-0.5)*6, // Explosion plus large
                            vy: (Math.random()-0.5)*6,
                            life: 60000,
                            maxLife: 60000,
                            color: '#78716c',
                            size: 6 + Math.random()*6,
                            type: 'stone'
                        });
                    }
                }
                break;
            }
        }

        if (hit) {
            bullets.splice(i, 1);
        }
    }
};
