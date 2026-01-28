import { Tank, WeaponType, Bunker, Tree, TerrainZone, TerrainType } from '../types';
import { TANK_SIZE, MAX_STONE_COUNT, COLORS, GAME_WIDTH, GAME_HEIGHT } from '../constants';

export const drawGroundTexture = (ctx: CanvasRenderingContext2D) => {
    // Fill Base
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Add noise texture
    const noiseDensity = 0.05; // 5% of pixels
    const width = GAME_WIDTH;
    const height = GAME_HEIGHT;
    
    // Using a pattern or procedural dots for 16-bit feel
    // Optimization: Draw dots randomly
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    for(let i=0; i<4000; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        ctx.fillRect(x, y, 2, 2);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for(let i=0; i<4000; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        ctx.fillRect(x, y, 2, 2);
    }
};

export const drawTank = (ctx: CanvasRenderingContext2D, tank: Tank, isReplayMode: boolean, now: number) => {
    let renderX = tank.x;
    let renderY = tank.y;
    
    if (tank.isMoving) {
        const shake = 2;
        renderX += (Math.random() - 0.5) * shake; 
        renderY += (Math.random() - 0.5) * shake;
    }

    ctx.save();
    ctx.translate(renderX, renderY);
    ctx.rotate(tank.angle + Math.PI / 2); 

    const scale = 1 + (tank.level - 1) * 0.1;
    ctx.scale(scale, scale);

    // --- Drop Shadow ---
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;

    // --- Tracks ---
    ctx.shadowColor = 'transparent';
    
    const treadPattern = (tank.treadOffset || 0) % 10;
    const trackColor = '#27272a'; // Zinc-800
    const trackDetail = '#3f3f46'; // Zinc-700

    ctx.fillStyle = trackColor;
    ctx.fillRect(-TANK_SIZE/2 - 6, -TANK_SIZE/2, 12, TANK_SIZE); 
    ctx.fillRect(TANK_SIZE/2 - 6, -TANK_SIZE/2, 12, TANK_SIZE); 
    
    ctx.fillStyle = trackDetail;
    for(let i=0; i<6; i++) {
        const yPos = -TANK_SIZE/2 + ((i * 10 + treadPattern) % TANK_SIZE);
        ctx.fillRect(-TANK_SIZE/2 - 6, yPos, 12, 2);
        ctx.fillRect(TANK_SIZE/2 - 6, yPos, 12, 2);
    }

    // --- Chassis ---
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 15;

    ctx.fillStyle = tank.color;
    ctx.beginPath();
    ctx.roundRect(-TANK_SIZE/2 + 2, -TANK_SIZE/2 + 2, TANK_SIZE - 4, TANK_SIZE - 4, 6);
    ctx.fill();
    
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(-TANK_SIZE/2 + 2, -TANK_SIZE/2 + 2, TANK_SIZE - 4, 4); 
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(-TANK_SIZE/2 + 2, TANK_SIZE/2 - 6, TANK_SIZE - 4, 4); 

    // --- Stone Resources ---
    if (tank.stoneCount > 0) {
        ctx.shadowBlur = 2;
        const stoneSize = 8;
        const spacing = 2;
        const startY = TANK_SIZE/2 - 12;
        
        for(let i=0; i < Math.min(tank.stoneCount, MAX_STONE_COUNT); i++) {
            ctx.fillStyle = '#a8a29e'; 
            ctx.strokeStyle = '#57534e';
            ctx.lineWidth = 1;
            const row = Math.floor(i / 3);
            const col = i % 3;
            const sx = -10 + col * (stoneSize + spacing);
            const sy = startY - row * (stoneSize + spacing);
            
            ctx.fillRect(sx, sy, stoneSize, stoneSize);
            ctx.strokeRect(sx, sy, stoneSize, stoneSize);
        }
    }

    if (tank.level >= 2) {
        ctx.fillStyle = '#171717';
        ctx.fillRect(-TANK_SIZE/2 - 4, -TANK_SIZE/2 + 10, 4, TANK_SIZE - 20);
        ctx.fillRect(TANK_SIZE/2, -TANK_SIZE/2 + 10, 4, TANK_SIZE - 20);
    }
    if (tank.level >= 3) {
        ctx.fillStyle = '#404040';
        ctx.fillRect(-TANK_SIZE/2 + 6, -TANK_SIZE/2 - 4, TANK_SIZE - 12, 6);
    }

    // --- Turret ---
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 2;
    
    ctx.fillStyle = '#4b5563'; 
    const barrelWidth = 14;
    ctx.fillRect(-barrelWidth/2, -TANK_SIZE/2 - 16, barrelWidth, TANK_SIZE/2 + 16); 
    
    if (tank.level >= 5) {
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(-barrelWidth/2 - 2, -TANK_SIZE/2 - 16, barrelWidth + 4, 6); 
    }

    const turretRadius = 16;
    const grad = ctx.createRadialGradient(5, -5, 2, 0, 0, turretRadius);
    grad.addColorStop(0, '#6b7280'); 
    grad.addColorStop(1, '#1f2937'); 
    
    ctx.fillStyle = grad; 
    ctx.beginPath();
    ctx.arc(0, 0, turretRadius, 0, Math.PI*2);
    ctx.fill();
    
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();

    // -- Overlays --
    if (tank.score > 0) {
        const starSize = 10;
        const spacing = 12;
        const totalWidth = (tank.score * spacing);
        const startX = renderX - totalWidth / 2 + spacing/2;
        for(let i=0; i < Math.min(tank.score, 5); i++) {
            drawStar(ctx, startX + (i*spacing), renderY - 40 * scale, 5, starSize/2, starSize/4, '#fbbf24');
        }
    }

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px "Rajdhani"';
    ctx.textAlign = 'left';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.fillText(`LVL ${tank.level}`, renderX + 30, renderY - 20);
    
    if (tank.ammo > 0) {
        ctx.fillStyle = '#facc15';
        ctx.fillText(tank.weapon === WeaponType.HEAVY ? "HEAVY" : "BOUNCE", renderX + 30, renderY - 5);
    }

    const barW = 50 * scale;
    const barH = 6;
    const hpY = renderY - 50 * scale;
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(renderX - barW/2 - 1, hpY - 1, barW + 2, barH + 2);
    const hpPercent = tank.health / tank.maxHealth;
    const hpColor = hpPercent > 0.6 ? '#22c55e' : (hpPercent > 0.3 ? '#eab308' : '#ef4444');
    ctx.fillStyle = hpColor;
    ctx.fillRect(renderX - barW/2, hpY, barW * hpPercent, barH);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for(let i=1; i<tank.maxHealth; i++) {
        ctx.fillRect(renderX - barW/2 + (i * (barW/tank.maxHealth)), hpY, 1, barH);
    }
    ctx.shadowBlur = 0;
};

export const drawBunker = (ctx: CanvasRenderingContext2D, bunker: Bunker) => {
    ctx.save();
    ctx.translate(bunker.x, bunker.y);
    
    if (bunker.health <= 0) {
        // Destroyed Crater
        ctx.beginPath();
        ctx.arc(bunker.width/2, bunker.height/2, bunker.width/1.8, 0, Math.PI * 2);
        ctx.fillStyle = '#1c1917'; // Scorched earth
        ctx.fill();
        ctx.strokeStyle = '#292524';
        ctx.lineWidth = 4;
        ctx.stroke();
        
        // Debris bits
        ctx.fillStyle = '#44403c';
        for(let i=0; i<5; i++) {
            ctx.fillRect(Math.random()*bunker.width, Math.random()*bunker.height, 8, 8);
        }
        ctx.restore();
        return;
    }

    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 20;
    
    ctx.fillStyle = '#44403c';
    ctx.fillRect(0, 0, bunker.width, bunker.height);
    
    ctx.fillStyle = bunker.color;
    ctx.fillRect(0, bunker.height - 10, bunker.width, 10);
    
    ctx.fillStyle = '#292524';
    ctx.fillRect(5, 5, bunker.width-10, bunker.height-15);
    
    ctx.fillStyle = '#57534e';
    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.lineTo(bunker.width-10, 10);
    ctx.lineTo(bunker.width-20, bunker.height-30);
    ctx.lineTo(20, bunker.height-30);
    ctx.fill();
    
    ctx.shadowBlur = 0;
    const healthPct = Math.max(0, bunker.health / bunker.maxHealth);
    
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(10, -15, bunker.width - 20, 8);
    ctx.fillStyle = healthPct > 0.5 ? '#22c55e' : '#ef4444';
    ctx.fillRect(12, -13, (bunker.width - 24) * healthPct, 4);

    if (healthPct < 0.7) {
        ctx.fillStyle = 'rgba(100, 100, 100, 0.4)';
        for(let i=0; i< (1-healthPct)*5; i++) {
             ctx.beginPath();
             ctx.arc(Math.random()*bunker.width, Math.random()*bunker.height, 5 + Math.random()*10, 0, Math.PI*2);
             ctx.fill();
        }
    }
    if (healthPct < 0.3) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.6)'; 
        for(let i=0; i<3; i++) {
             ctx.fillRect(Math.random()*bunker.width, Math.random()*bunker.height, 4, 4);
        }
    }

    ctx.restore();
}

export const drawTree = (ctx: CanvasRenderingContext2D, tree: Tree, now: number) => {
    if (tree.health <= 0) {
        // Stump
        ctx.save();
        ctx.translate(tree.x, tree.y);
        ctx.fillStyle = '#3f3f46'; // Burnt wood
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
        return;
    }

    ctx.save();
    ctx.translate(tree.x, tree.y);
    
    // Sway
    const sway = Math.sin(now / 500) * 2;
    
    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;

    // Trunk
    ctx.fillStyle = '#573024'; // Wood
    ctx.fillRect(-4, -4, 8, 12);

    // Leaves
    ctx.fillStyle = tree.isOnFire ? '#b45309' : '#166534'; // Burning or Green
    ctx.beginPath();
    ctx.arc(sway, -tree.size/2, tree.size/2, 0, Math.PI*2);
    ctx.fill();
    
    // Detail
    ctx.fillStyle = tree.isOnFire ? '#f97316' : '#15803d';
    ctx.beginPath();
    ctx.arc(sway - 5, -tree.size/2 - 5, tree.size/3, 0, Math.PI*2);
    ctx.fill();

    // Fire Effects
    if (tree.isOnFire) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ea580c';
        ctx.fillStyle = `rgba(234, 88, 12, ${0.5 + Math.random()*0.5})`;
        ctx.beginPath();
        ctx.arc(Math.random()*10 - 5, -tree.size/2 + Math.random()*10 - 5, 8, 0, Math.PI*2);
        ctx.fill();
    }

    ctx.restore();
}

export const drawZone = (ctx: CanvasRenderingContext2D, zone: TerrainZone) => {
    const colorHex = COLORS[zone.type.toLowerCase() as keyof typeof COLORS] || '#000';
    ctx.fillStyle = colorHex;
    
    if (zone.shape === 'circle') {
        // Main Circle
        ctx.beginPath();
        ctx.ellipse(zone.x, zone.y, zone.width, zone.height, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Edge Dithering (Pixel Art Style Fade)
        // Draw randomized dots around the perimeter to blend nicely
        const circumference = Math.PI * 2 * Math.max(zone.width, zone.height);
        const particles = circumference / 2;
        
        ctx.fillStyle = colorHex;
        for(let i=0; i<particles; i++) {
            const angle = Math.random() * Math.PI * 2;
            // Scatter radius slightly outside and inside
            const rOffset = (Math.random() * 20) - 5;
            const rx = (zone.width + rOffset) * Math.cos(angle);
            const ry = (zone.height + rOffset) * Math.sin(angle);
            
            // Draw a small 2x2 or 3x3 dot
            const size = Math.random() * 3 + 1;
            ctx.fillRect(zone.x + rx, zone.y + ry, size, size);
        }
        
        // Second layer further out, more sparse
        ctx.fillStyle = colorHex;
        ctx.globalAlpha = 0.5;
        for(let i=0; i<particles/2; i++) {
            const angle = Math.random() * Math.PI * 2;
            const rOffset = (Math.random() * 15) + 10;
            const rx = (zone.width + rOffset) * Math.cos(angle);
            const ry = (zone.height + rOffset) * Math.sin(angle);
            ctx.fillRect(zone.x + rx, zone.y + ry, 2, 2);
        }
        ctx.globalAlpha = 1.0;

    } else {
        ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
        // Dither edges for Rect
        ctx.fillStyle = colorHex;
        // Top/Bottom
        for(let x=zone.x; x<zone.x+zone.width; x+=4) {
            if(Math.random() > 0.5) ctx.fillRect(x, zone.y - 2, 4, 2);
            if(Math.random() > 0.5) ctx.fillRect(x, zone.y + zone.height, 4, 2);
        }
        // Left/Right
        for(let y=zone.y; y<zone.y+zone.height; y+=4) {
            if(Math.random() > 0.5) ctx.fillRect(zone.x - 2, y, 2, 4);
            if(Math.random() > 0.5) ctx.fillRect(zone.x + zone.width, y, 2, 4);
        }
    }
};

export const drawWreck = (ctx: CanvasRenderingContext2D, tank: Tank, now: number, isReplayMode: boolean) => {
    ctx.save();
    ctx.translate(tank.x, tank.y);
    ctx.rotate(tank.angle + Math.PI/2);
    
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 10;
    
    ctx.fillStyle = '#1c1917'; 
    ctx.beginPath();
    ctx.roundRect(-TANK_SIZE/2, -TANK_SIZE/2, TANK_SIZE, TANK_SIZE, 4);
    ctx.fill();
    
    ctx.strokeStyle = '#44403c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, -10); ctx.lineTo(10, 10);
    ctx.moveTo(10, -10); ctx.lineTo(-5, 5);
    ctx.stroke();

    ctx.restore();
    
    if (!isReplayMode && tank.deadUntil > now) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px "Rajdhani"';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.fillText(`${Math.ceil((tank.deadUntil - now)/1000)}`, tank.x, tank.y - 40);
        ctx.shadowBlur = 0;
    }
};

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number, color: string) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 5;
    ctx.fill();
    ctx.restore();
}