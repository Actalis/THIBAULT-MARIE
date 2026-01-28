import { PlayerConfig, TerrainType, PowerUpType } from './types';

// Canvas Dimensions (1080p Resolution)
export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;

// Physics
export const TANK_SPEED = 3.0;
export const TANK_ROTATION_SPEED = 0.06;
export const BULLET_SPEED = 18.0;
export const TANK_SIZE = 52; 
export const TANK_HITBOX_SIZE = 40; 
export const BULLET_SIZE = 12;
export const COOLDOWN_FRAMES = 30; 
export const TRACK_SPACING = 12; // Lower spacing for smoother lines

// Destructibles & Powerups
export const WALL_SIZE = 64;
export const WALL_MAX_HEALTH = 4;
export const DEBRIS_MAX_HEALTH = 60;
export const POWERUP_SIZE = 24;
export const POWERUP_CHANCE = 0.33; 

// Trees
export const TREE_SIZE = 48;
export const TREE_MAX_HEALTH = 3;

// Bunkers & Resources
export const BUNKER_SIZE = 100;
export const BUNKER_MAX_HEALTH = 50;
export const BUNKER_REPAIR_AMOUNT = 10;
export const TANK_HEAL_INTERVAL = 10000;
export const MAX_STONE_COUNT = 5; 

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
};

// Gameplay
export const TANK_BASE_HEALTH = 10;
export const END_SEQUENCE_DURATION = 5000;
export const MENU_FADE_DURATION = 3000;

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
  sand: '#d6d3d1',
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

export const MAX_TRACKS = 2500; // Increased limit
export const TRACK_FADE_DURATION = 40000; 
export const MAX_REPLAY_FRAMES = 3600;