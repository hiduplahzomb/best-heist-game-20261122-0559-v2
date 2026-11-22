// Logic test for Gilded Shadow's pure modules (no DOM): guard AI, cameras,
// alarm, line-of-sight, smoke. Run: node test-logic.mjs
import { LEVELS } from './game/src/levels.js';
import { createGuard, updateGuard } from './game/src/guard.js';
import { createCamera, updateCamera } from './game/src/camera.js';
import { createAlarm, updateAlarm, bindAlarm } from './game/src/alarm.js';
import { canSeeObserver, lineOfSightClear } from './game/src/vision.js';

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name}`); }
}

const level = LEVELS[0];
const walls = level.walls.map((w) => ({ ...w }));

// 1. Guard spots a player standing in the open in front of it.
{
  const g = createGuard({ waypoints: [[200, 140], [820, 140]], speed: 62 });
  g.x = 300; g.y = 300; g.facing = 0; g.state = 'patrol';
  const player = { x: 420, y: 280, sneaking: false }; // clear of the mid divider
  let spotted = false;
  const world = {
    player, walls, smoke: [], shadowZones: level.shadowZones, noise: null, time: 0,
    onSpotted: () => { spotted = true; },
    onCaught: () => {},
  };
  for (let i = 0; i < 120; i++) updateGuard(g, 1 / 60, world); // 2 seconds
  check('guard reaches full alert on an exposed player', g.state === 'chase' && spotted);
}

// 2. A wall between guard and player blocks the sighting.
{
  const g = createGuard({ waypoints: [[200, 140], [820, 140]], speed: 62 });
  g.x = 200; g.y = 200; g.facing = 0;
  // Pillar at (240,180,44,44) sits between (200,200) and (400,200).
  const vis = canSeeObserver(g, 400, 200, walls);
  check('wall blocks line of sight', vis.seen === false);
  check('open line of sight is clear', lineOfSightClear(100, 100, 900, 100, walls) === true);
}

// 3. Sneaking + shadow slows detection a lot.
{
  const g = createGuard({ waypoints: [[200, 140], [820, 140]], speed: 62 });
  g.x = 300; g.y = 300; g.facing = 0;
  const player = { x: 420, y: 300, sneaking: true };
  // Put the player in the center shadow zone (440,300,150,90) instead.
  player.x = 500; player.y = 330;
  const world = {
    player, walls, smoke: [], shadowZones: level.shadowZones, noise: null, time: 0,
    onSpotted: () => {}, onCaught: () => {},
  };
  for (let i = 0; i < 60; i++) updateGuard(g, 1 / 60, world); // 1 second
  check('sneak + shadow keeps awareness low after 1s', g.awareness < 40);
}

// 4. Smoke hides the player completely.
{
  const g = createGuard({ waypoints: [[200, 140], [820, 140]], speed: 62 });
  g.x = 300; g.y = 300; g.facing = 0;
  const player = { x: 420, y: 300, sneaking: false };
  const world = {
    player, walls, smoke: [{ x: 420, y: 300, r: 74, ttl: 3 }], shadowZones: [], noise: null, time: 0,
    onSpotted: () => {}, onCaught: () => {},
  };
  for (let i = 0; i < 120; i++) updateGuard(g, 1 / 60, world);
  check('smoke cloud hides the player', g.awareness === 0 && g.state === 'patrol');
}

// 5. Chase ends in a catch when the guard reaches the player.
{
  const g = createGuard({ waypoints: [[200, 140], [820, 140]], speed: 62 });
  g.x = 300; g.y = 300; g.facing = 0; g.state = 'chase'; g.awareness = 100;
  g.lastSeen = { x: 340, y: 300 };
  const player = { x: 340, y: 300, sneaking: false };
  let caught = false;
  const world = {
    player, walls, smoke: [], shadowZones: [], noise: null, time: 0,
    onSpotted: () => {}, onCaught: () => { caught = true; },
  };
  for (let i = 0; i < 120 && !caught; i++) updateGuard(g, 1 / 60, world);
  check('chasing guard catches a stationary player', caught === true);
}

// 6. A thrown coin lures a patrolling guard.
{
  const g = createGuard({ waypoints: [[200, 140], [820, 140]], speed: 62 });
  g.x = 300; g.y = 300; g.facing = 0;
  const player = { x: 900, y: 550, sneaking: false };
  const world = {
    player, walls, smoke: [], shadowZones: [], noise: { x: 320, y: 320, lureRadius: 270, ttl: 5 }, time: 0,
    onSpotted: () => {}, onCaught: () => {},
  };
  updateGuard(g, 1 / 60, world);
  check('coin noise makes a guard investigate', g.state === 'suspicious' && g.investigate !== null);
}

// 7. Camera in-frame sighting feeds the alarm.
{
  const alarm = bindAlarm(createAlarm());
  const cam = createCamera({ x: 512, y: 70, baseAngle: Math.PI / 2, sweep: 0, speed: 0, phase: 0 });
  const player = { x: 512, y: 120, sneaking: false }; // above the display case
  const world = { player, walls, smoke: [], time: 0, alarm };
  for (let i = 0; i < 60; i++) updateCamera(cam, 1 / 60, world);
  check('camera raises the alarm while tracking', cam.tracking === true && alarm.value > 15);
  // Disabled camera does not track.
  cam.disabled = 5;
  updateCamera(cam, 1 / 60, world);
  check('disabled camera stops tracking', cam.tracking === false);
}

// 8. Alarm lockdown triggers at 100 and expires after 30s.
{
  const alarm = bindAlarm(createAlarm());
  alarm.add(100);
  const ev1 = updateAlarm(alarm, 0.1, { anySeen: false, getaway: false });
  check('alarm at 100 triggers lockdown', ev1 === 'lockdown' && alarm.lockdown === true);
  let ev2 = null;
  for (let i = 0; i < 31 && ev2 !== 'lockdownExpired'; i++) {
    ev2 = updateAlarm(alarm, 1, { anySeen: false, getaway: false });
  }
  check('lockdown expires after 30s', ev2 === 'lockdownExpired');
}

// 9. Alarm cools down when nobody sees the player.
{
  const alarm = bindAlarm(createAlarm());
  alarm.add(50);
  updateAlarm(alarm, 10, { anySeen: false, getaway: false });
  check('alarm decays in the quiet', alarm.value < 50);
}

// 10. All three levels load with sane entity counts.
{
  let ok = true;
  for (const lv of LEVELS) {
    if (!lv.guards.length || !lv.cameras.length || !lv.loot.length) ok = false;
    if (!lv.diamond || !lv.exit || !lv.spawn) ok = false;
  }
  check('all 3 levels have guards, cameras, loot, diamond, exit, spawn', ok);
  check('difficulty rises across levels',
    LEVELS[0].guards.length < LEVELS[1].guards.length &&
    LEVELS[1].guards.length < LEVELS[2].guards.length);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
