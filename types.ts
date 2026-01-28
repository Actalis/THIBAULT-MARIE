export type Vector2 = { x: number; y: number };

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
  SETTINGS = 'SETTINGS',
  REPLAY = 'REPLAY',
}

export enum GameMode {
  DEATHMATCH = 'DEATHMATCH',
  RACE = 'RACE'
}

export type PlayerControls = {
  up: string;
  down: string;
  left: string;
  right: string;
  shoot: string;
};

export type PlayerProfile = {
  id: string;
  name: string;
  color: string;
  controls: PlayerControls;
  stats: {
    gamesPlayed: number;
    wins: number;
    totalKills: number;
    totalScore: number;
  };
};

export type PlayerConfig = {
  id: number;
  profileId?: string; // Link to a persisted profile
  name: string;
  color: string;
  controls: PlayerControls;
  active: boolean;
};

export type Entity = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number; // in radians
  vx: number;
  vy: number;
};

export enum WeaponType {
  NORMAL = 'NORMAL',
  HEAVY = 'HEAVY', // More damage, slower
  BOUNCE = 'BOUNCE' // Bounces off walls
}

export interface Tank extends Entity {
  playerId: number;
  color: string;
  cooldown: number;
  health: number;
  maxHealth: number; // Dynamic based on level
  score: number;
  isMoving: boolean;
  distanceTraveled: number;
  recoilX: number;
  recoilY: number;
  // Visuals
  treadOffset: number;
  // Weapon State
  weapon: WeaponType;
  ammo: number; // For special weapons
  // RPG System
  level: number;
  xp: number;
  deadUntil: number; // Timestamp for respawn, 0 if alive
  // Race Specific
  lap: number;
  nextCheckpointIndex: number;
  finishedRace: boolean;
  finishTime: number;
  // New Features
  stoneCount: number;
  lastHealTime: number;
}

export interface Bullet extends Entity {
  ownerId: number;
  damage: number;
  type: WeaponType;
  bouncesLeft: number;
}

export interface TrackMark {
  id: string;
  x: number;
  y: number;
  angle: number;
  color: string;
  createdAt: number;
  opacity: number; // For persistent tracks
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: 'fire' | 'smoke' | 'spark' | 'dust' | 'shockwave';
}

export enum TerrainType {
  GRASS = 'GRASS',
  SAND = 'SAND',
  MUD = 'MUD',
  ASPHALT = 'ASPHALT'
}

export interface TerrainZone {
  id: string;
  x: number;
  y: number;
  width: number; // Used as radius X for round zones
  height: number; // Used as radius Y
  type: TerrainType;
  shape: 'rect' | 'circle';
}

export interface Wall extends Entity {
  health: number;
  maxHealth: number;
  color: string;
}

export interface Bunker extends Entity {
    ownerId: number;
    health: number;
    maxHealth: number;
    color: string;
}

export interface Checkpoint {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Debris {
  id: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  health: number; // Crumbles when driven over
  color: string;
}

export interface Tree {
    id: string;
    x: number;
    y: number;
    size: number;
    health: number;
    maxHealth: number;
    isOnFire: boolean;
}

export enum PowerUpType {
  HEALTH = 'HEALTH',
  HEAVY_AMMO = 'HEAVY_AMMO',
  BOUNCE_AMMO = 'BOUNCE_AMMO'
}

export interface PowerUp {
  id: string;
  x: number;
  y: number;
  type: PowerUpType;
  rotation: number;
}

export interface ReplayFrame {
  tanks: { id: string, x: number, y: number, angle: number, health: number, maxHealth: number, level: number, isMoving: boolean, color: string, playerId: number, score: number, stoneCount: number }[];
  bullets: { x: number, y: number, width: number }[];
  particles: { x: number, y: number, color: string, size: number, type: 'fire' | 'smoke' | 'spark' | 'dust' | 'shockwave' }[];
  walls: { x: number, y: number, width: number, height: number, health: number }[]; 
  bunkers: { x: number, y: number, width: number, height: number, health: number, maxHealth: number, color: string }[];
  debris: { x: number, y: number, size: number, rotation: number, color: string }[];
  trees: { x: number, y: number, size: number, health: number, isOnFire: boolean }[];
  powerups: { x: number, y: number, type: PowerUpType }[];
  tracks: { x: number, y: number, angle: number, color: string, opacity: number }[];
  cam: { x: number, y: number, zoom: number };
}

export interface GameHistory {
  id: string;
  date: string;
  winner: string; // Name of winner
  winnerProfileId?: string;
  mode: GameMode;
  scores: { name: string; score: number; profileId?: string }[];
  note: string;
  replayData?: ReplayFrame[];
}