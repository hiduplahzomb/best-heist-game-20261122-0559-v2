// GILDED SHADOW — tuning constants and the noir palette.
// One place for every number the rest of the game reads.

export const VIEW = { width: 1024, height: 640 };
export const HUD_HEIGHT = 52;
export const PLAY = { x: 14, y: HUD_HEIGHT + 6, w: 996, h: 566 };

export const PALETTE = {
  floor: '#11172b',
  floorAlt: '#0d1322',
  wall: '#232c47',
  wallEdge: '#c9a227',
  shadowZone: 'rgba(32, 120, 92, 0.20)',
  shadowEdge: 'rgba(64, 220, 160, 0.55)',
  gold: '#e8b93e',
  goldBright: '#ffd94d',
  danger: '#ff4757',
  warn: '#ffa502',
  calm: '#2ed573',
  cameraCone: 'rgba(190, 80, 255, 0.28)',
  text: '#e8eaf2',
  muted: '#8a93b2',
};

export const PLAYER = {
  radius: 11,
  walkSpeed: 175,
  sneakSpeed: 88,
  interactRange: 38,
  catchRadius: 20,
};

export const GUARD = {
  radius: 12,
  patrolSpeed: 62,
  chaseSpeed: 138,
  searchSpeed: 88,
  viewRange: 185,
  viewAngle: 1.05, // radians, half-angle of the cone
  detectRate: 95, // awareness per second at point blank
  decayRate: 26,
  suspiciousAt: 30,
  alertAt: 100,
  chaseLoseTime: 2.2,
  searchTime: 4.5,
  waypointPause: 0.9,
};

export const CAMERA = {
  viewRange: 205,
  viewAngle: 0.48,
  alarmRate: 26, // alarm points per second while the thief is in frame
  disableTime: 12,
};

export const ALARM = {
  decayRate: 1.6,
  waryAt: 30,
  lockdownAt: 100,
  lockdownTime: 30,
  getawayRise: 1.1, // alarm creeps up once the diamond is taken
  diamondSpike: 15,
};

export const TOOLS = {
  smoke: { name: 'Smoke Bomb', price: 40, key: 'Q', radius: 74, duration: 3.6 },
  emp: { name: 'EMP Pulse', price: 60, key: 'R', radius: 320, duration: 10 },
  coin: { name: 'Decoy Coin', price: 15, key: 'Click', throwRange: 230, lureRadius: 270 },
  intel: { name: 'Floor Intel', price: 25, key: '—', description: 'Reveals patrol routes' },
};

export const SCORE = {
  diamond: 5000,
  ghostBonus: 2000,
  ghostAlarmMax: 30,
  timeBonusPerSecond: 10,
};

export const STARTING_BUDGET = 150;
