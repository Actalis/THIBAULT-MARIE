

import { PlayerConfig, TerrainType, PowerUpType } from './types';

// Canvas Dimensions (1080p Resolution)
export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;
export const BORDER_SIZE = 10; // Invisible wall thickness at edges

// Physics
export const TANK_SPEED = 3.0;
export const TANK_ROTATION_SPEED = 0.06;
export const BULLET_SPEED = 18.0;
export const TANK_SIZE = 52; 
export const TANK_HITBOX_SIZE = 40; 
export const BULLET_SIZE = 12;
export const COOLDOWN_FRAMES = 30; 
export const TRACK_SPACING = 12; // Lower spacing for smoother lines

// Soldier (Infantry) Stats
export const SOLDIER_SIZE = 14;
export const SOLDIER_SPEED = 2.0; // Agile but slower top speed than tank
export const SOLDIER_MAX_HEALTH = 1; // Dies in 1 hit/crush
export const SOLDIER_COOLDOWN = 8; // Fast fire rate (Machine gun)
export const SOLDIER_DAMAGE = 0.2; // Low damage

// Destructibles & Powerups
export const WALL_SIZE = 64;
export const WALL_MAX_HEALTH = 4;
export const DEBRIS_MAX_HEALTH = 60;
export const POWERUP_SIZE = 24;
export const POWERUP_CHANCE = 0.33; 

// Rocks (New)
export const ROCK_SIZE_MIN = 40;
export const ROCK_SIZE_MAX = 70;
export const ROCK_MAX_HEALTH = 12; // Tougher than trees
export const ROCK_PUSH_FRICTION = 0.85; // Stops quickly
export const DEBRIS_SLOW_FACTOR = 0.4; // Tanks move at 40% speed on stones

// Trees
export const TREE_SIZE = 56; // Slightly larger for better cover
export const TREE_MAX_HEALTH = 4; // Takes 4 shots now
export const TREE_REGROW_DELAY = 10000; // 10 seconds waiting as stump
export const TREE_GROWTH_DURATION = 300000; // 5 minutes to full size (300,000ms)
export const TREE_SOLID_THRESHOLD = 0.8; // En dessous de 80% de taille, on passe à travers

// Bunkers & Resources
export const BUNKER_SIZE = 100;
export const BUNKER_MAX_HEALTH = 25; // 25 Missiles to destroy
export const BUNKER_LEVEL_2_HEALTH_BONUS = 10; // Bonus PV au passage niveau 2
export const BUNKER_REPAIR_AMOUNT = 5;
export const TANK_HEAL_INTERVAL = 10000;
export const WATER_COLLECT_INTERVAL = 5000; // 5 secondes pour prendre de l'eau
export const INVENTORY_BASE_CAPACITY = 3; // Starts at 3, +1 per level

export const BUNKER_UPGRADE_COST_STONE_L2 = 20; // 20 Pierres requises
export const BUNKER_UPGRADE_COST_WOOD_L2 = 20;  // 20 Bois requis
export const BUNKER_UPGRADE_COST_STONE_L3 = 50;
export const BUNKER_UPGRADE_COST_WOOD_L3 = 50;
export const BUNKER_UPGRADE_HITS_REQUIRED = 3; // 3 Tirs pour valider l'upgrade

export const BUNKER_SHIELD_COST_ELECTRONICS = 2; // Cost for Electric Shield
export const STUN_DURATION = 5000; // 5 seconds immobilization

// Turrets
export const TURRET_SIZE = 40;
export const TURRET_MAX_HEALTH = 15;
export const TURRET_COST_STONE = 6; 
export const TURRET_COST_WOOD = 6;  
export const TURRET_COOLDOWN = 120; // 2 seconds at 60fps (Fast enough)
export const TURRET_RANGE = 600;
export const TURRET_DAMAGE = 1;

// Drones
export const DRONE_SIZE = 24;
export const DRONE_MAX_HEALTH = 3;
export const DRONE_SPEED = 2.5; // Rapide (Chasseur)
export const DRONE_SPAWN_RATE = 120000; // 2 minutes (120,000ms)
export const DRONE_COOLDOWN = 60; 
export const DRONE_DAMAGE = 3; // Dégâts d'explosion
export const DRONE_RANGE = 40; // Rayon de contact

// Mechas (Level 3)
export const MECHA_SIZE = 40;
export const MECHA_MAX_HEALTH = 12;
export const MECHA_SPEED = 0.6; // Very slow
export const MECHA_SPAWN_RATE = 120000; // 2 minutes
export const MECHA_COOLDOWN = 120; // Fire rate (flamethrower tick)
export const MECHA_RANGE = 180; // Close range for flamethrower
export const MECHA_DAMAGE = 0.2; // Damage per tick of fire

// Horde Mode Waves
export const HORDE_WAVES = [
  { drones: 5, mechas: 0, tanks: 0 },
  { drones: 8, mechas: 2, tanks: 0 },
  { drones: 12, mechas: 4, tanks: 1 },
  { drones: 15, mechas: 6, tanks: 2 },
  { drones: 20, mechas: 8, tanks: 3 }
];

// RPG & Score
export const WIN_SCORE = 3; 
export const LAPS_TO_WIN = 3;
export const RESPAWN_TIME = 10000;
export const XP_TO_LEVEL_UP = 300; 
export const XP_PER_KILL = 50;
export const XP_PER_WALL = 10;
export const XP_PER_DISTANCE = 0.5; 

// Terrain Modifiers
export const TERRAIN_MODIFIERS: Record<TerrainType, number> = {
  [TerrainType.GRASS]: 1.0,
  [TerrainType.SAND]: 0.6,
  [TerrainType.MUD]: 0.4,
  [TerrainType.ASPHALT]: 1.2,
  [TerrainType.WATER]: 0.5, // Slow in water
};

// Gameplay
export const TANK_BASE_HEALTH = 10;
export const END_SEQUENCE_DURATION = 5000;
export const MENU_FADE_DURATION = 3000;
export const RACE_REPLAY_SECONDS = 10; // Keep last 10 seconds for replay
export const RACE_COUNTDOWN_DURATION = 3000; // 3 seconds

// Colors
export const COLORS = {
  p1: '#e11d48', // Red
  p2: '#2563eb', // Blue
  p3: '#16a34a', // Green
  p4: '#ca8a04', // Yellow
  background: '#57534e', 
  wall: '#78716c', 
  wallDamaged: '#a8a29e',
  bullet: '#fbbf24', 
  
  grass: '#3f6212',
  sand: '#e6c288', // Nouvelle couleur sable plus chaude (moins blanche)
  mud: '#451a03',
  asphalt: '#1c1917',

  [PowerUpType.HEALTH]: '#22c55e',
  [PowerUpType.HEAVY_AMMO]: '#ef4444',
  [PowerUpType.BOUNCE_AMMO]: '#8b5cf6',
};

// Default Keybindings
export const DEFAULT_CONTROLS: PlayerConfig[] = [
  {
    id: 1,
    name: 'Joueur 1',
    color: COLORS.p1,
    active: true,
    controls: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', shoot: 'Space' },
  },
  {
    id: 2,
    name: 'Joueur 2',
    color: COLORS.p2,
    active: true,
    controls: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', shoot: 'ControlRight' },
  },
  {
    id: 3,
    name: 'Joueur 3',
    color: COLORS.p3,
    active: false,
    controls: { up: 'Numpad8', down: 'Numpad5', left: 'Numpad4', right: 'Numpad6', shoot: 'Enter' },
  },
  {
    id: 4,
    name: 'Joueur 4',
    color: COLORS.p4,
    active: false,
    controls: { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL', shoot: 'Semicolon' },
  },
];

export const MAX_TRACKS = 2500; 
export const TRACK_FADE_DURATION = 40000; 
export const MAX_REPLAY_FRAMES = 3600;
