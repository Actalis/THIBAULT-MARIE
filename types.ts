

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
  RACE = 'RACE',
  HORDE = 'HORDE'
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
  attachedBranches: number; // Branches collected on chassis (Camouflage)
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
  // Resources
  stoneCount: number;
  woodCount: number; 
  waterCount: number; // New Resource
  electronicsCount: number; 
  lastHealTime: number;
  lastWaterCollectTime: number; // Timer for water collection
  // Mud Tracks Logic
  muddyTreadsTimer: number; // Time in ms remaining for muddy tracks
  // Infantry Mode
  isSoldier: boolean; 
  // Status Effects
  stunnedUntil: number; // Timestamp until which the tank is immobilized
  lastImpactTime: number; // For sound debouncing
  // AI
  isAI?: boolean;
}

export interface Bullet extends Entity {
  ownerId: number;
  damage: number;
  type: WeaponType;
  bouncesLeft: number;
  // New Homing mechanics
  isElectrified: boolean;
  homingTargetId: number | null; // PlayerID to chase
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
  type: 'fire' | 'smoke' | 'spark' | 'dust' | 'shockwave' | 'blood' | 'electric' | 'leaf' | 'branch' | 'stone' | 'ripple';
}

export enum TerrainType {
  GRASS = 'GRASS',
  SAND = 'SAND',
  MUD = 'MUD',
  ASPHALT = 'ASPHALT',
  WATER = 'WATER'
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
  isBorder?: boolean;
}

export interface Rock extends Entity {
    health: number;
    maxHealth: number;
    rotation: number; // Visual rotation
    shapePoints: {x:number, y:number}[]; // For rugged look
}

export interface Bunker extends Entity {
    ownerId: number;
    health: number;
    maxHealth: number;
    color: string;
    // Storage
    storedStone: number;
    storedWood: number;
    storedElectronics?: number;
    // Upgrade System
    level: number; // 1 = Basic, 2 = Drone Port, 3 = Mecha Factory
    upgradeHits: number; // Hits received to validate upgrade
    lastDroneSpawn: number;
    lastMechaSpawn: number;
    // Special Ability
    hasShield: boolean; // Electric shield
    // Turret Construction
    turretBuildStatus: number[]; // Array of 4 integers (0=empty, 1=half, 2=built)
}

export interface Turret extends Entity {
    ownerId: number;
    health: number;
    maxHealth: number;
    cooldown: number;
    targetId: string | null;
    slotIndex: number; // Which of the 5 slots it occupies (0-3 for corners)
}

export interface Drone extends Entity {
    ownerId: number;
    health: number;
    maxHealth: number;
    cooldown: number;
    targetId: string | null;
    wobbleOffset: number; // Random offset for oscillation
    spinSpeed: number; // For destabilization effect
    isAI?: boolean;
}

export interface Mecha extends Entity {
    ownerId: number;
    health: number;
    maxHealth: number;
    cooldown: number;
    targetId: string | null;
    isAttacking: boolean; // Visual state for flamethrower
    isAI?: boolean;
}

export interface Checkpoint {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export enum DebrisType {
    STONE = 'STONE',
    WOOD = 'WOOD',
    ELECTRONICS = 'ELECTRONICS'
}

export interface Debris {
  id: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  health: number; // Crumbles when driven over
  color: string;
  type: DebrisType;
}

export interface Tree {
    id: string;
    x: number;
    y: number;
    size: number;
    health: number;
    maxHealth: number;
    growth: number; // 0.0 to 1.0 (size factor)
    isOnFire: boolean;
    // Elastic physics
    wobbleX: number;
    wobbleY: number;
    wobbleVelX: number;
    wobbleVelY: number;
    // Regrowth
    regrowAt: number; // Timestamp when it grows back. 0 if alive.
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
  tanks: any[];
  bullets: any[];
  particles: any[];
  walls: any[]; 
  rocks: any[];
  bunkers: any[];
  turrets: any[];
  drones: any[];
  mechas: any[];
  debris: any[];
  trees: any[];
  powerups: any[];
  tracks: any[];
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
