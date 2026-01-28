// ==========================================
// CONFIGURATION DES ASSETS (IMAGES & SONS)
// ==========================================
// Colle tes liens GitHub (raw) ou autres URLs directes ici.

export const ASSET_MANIFEST = {
  images: {
    // --- TANKS (Spritesheets ou images fixes) ---
    'tank_base': 'https://raw.githubusercontent.com/ton-repo/assets/main/tank_base.png', // Exemple URL
    'tank_turret': 'https://raw.githubusercontent.com/ton-repo/assets/main/tank_turret.png',
    
    // --- TERRAIN & DÉCORS ---
    'ground_grass': 'https://raw.githubusercontent.com/ton-repo/assets/main/grass.png',
    'ground_sand': 'https://raw.githubusercontent.com/ton-repo/assets/main/sand.png',
    'tree_green': 'https://raw.githubusercontent.com/ton-repo/assets/main/tree.png',
    'wall_brick': 'https://raw.githubusercontent.com/ton-repo/assets/main/wall.png',
    'bunker': 'https://raw.githubusercontent.com/ton-repo/assets/main/bunker.png',

    // --- EFFETS (Particules) ---
    'explosion_sheet': 'https://raw.githubusercontent.com/ton-repo/assets/main/explosion.png',
    'smoke': 'https://raw.githubusercontent.com/ton-repo/assets/main/smoke.png',
  },
  
  sounds: {
    // --- MOTEUR & MOUVEMENT ---
    'engine_idle': 'https://raw.githubusercontent.com/ton-repo/assets/main/engine_idle.wav',
    'engine_move': 'https://raw.githubusercontent.com/ton-repo/assets/main/engine_move.wav',
    'tracks': 'https://raw.githubusercontent.com/ton-repo/assets/main/tracks.wav',

    // --- COMBAT ---
    'shoot_light': 'https://raw.githubusercontent.com/ton-repo/assets/main/shoot.wav',
    'shoot_heavy': 'https://raw.githubusercontent.com/ton-repo/assets/main/shoot_heavy.wav',
    'impact_metal': 'https://raw.githubusercontent.com/ton-repo/assets/main/metal_impact.wav',
    'explosion_small': 'https://raw.githubusercontent.com/ton-repo/assets/main/explode_s.wav',
    'explosion_big': 'https://raw.githubusercontent.com/ton-repo/assets/main/explode_l.wav',

    // --- UI & GAMEPLAY ---
    'click': 'https://raw.githubusercontent.com/ton-repo/assets/main/click.wav',
    'pickup': 'https://raw.githubusercontent.com/ton-repo/assets/main/pickup.wav',
    'win': 'https://raw.githubusercontent.com/ton-repo/assets/main/win.wav'
  }
};

// Types pour l'autocomplétion dans le code
export type ImageKey = keyof typeof ASSET_MANIFEST.images;
export type SoundKey = keyof typeof ASSET_MANIFEST.sounds;
