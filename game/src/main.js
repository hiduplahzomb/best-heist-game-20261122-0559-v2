// GILDED SHADOW — main loop and phase machine.
// briefing (plan + buy tools) -> playing (infiltrate, then getaway) ->
// caught / level complete -> campaign complete. One file owns the flow;
// every system it calls lives in its own module.

import { VIEW, PLAYER, TOOLS, SCORE, STARTING_BUDGET, CAMERA } from './config.js';
import { LEVELS } from './levels.js';
import { createInput } from './input.js';
import { sfx } from './audio.js';
import { createGuard, updateGuard } from './guard.js';
import { createCamera, updateCamera, disableAllCameras } from './camera.js';
import { createAlarm, updateAlarm, bindAlarm } from './alarm.js';
import { createPlayer, updatePlayer } from './player.js';
import { createLootItems, collectLootItem, createKeycards } from './loot.js';
import { pointInRect } from './vision.js';
import {
  drawWorld, drawHUD, drawBriefing, drawCaught,
  drawLevelComplete, drawCampaignComplete, drawPaused,
} from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = createInput(canvas);

const params = new URLSearchParams(window.location.search);

// ---- Campaign state -------------------------------------------------------

let phase = 'briefing'; // briefing | playing | caught | levelComplete | campaignComplete
let paused = false;
let levelIndex = 0;
const campaign = { score: 0, budget: STARTING_BUDGET };
let shop = freshShop();
let loadoutSnapshot = null;
let world = null;
let breakdown = null;
let caughtReason = '';
let screenButtons = null;

function freshShop() {
  return { smoke: 0, emp: 0, coin: 0, intel: false, budget: campaign.budget };
}

function gradeFor(total) {
  if (total >= 24000) return 'GHOST LEGEND';
  if (total >= 18000) return 'MASTER THIEF';
  if (total >= 12000) return 'PROFESSIONAL';
  return 'AMATEUR';
}

// ---- Level setup ----------------------------------------------------------

function loadLevel(index, loadout) {
  const level = LEVELS[index];
  const doors = level.doors.map((d) => ({ ...d, open: false }));
  const solids = [...level.walls.map((w) => ({ ...w })), ...doors];
  world = {
    level,
    levelIndex: index,
    solids,
    doors,
    guards: level.guards.map(createGuard),
    cameras: level.cameras.map(createCamera),
    loot: createLootItems(level.loot),
    keycards: createKeycards(level.keycards),
    terminals: level.terminals.map((t) => ({ ...t, used: false })),
    player: createPlayer(level.spawn, loadout),
    alarm: bindAlarm(createAlarm()),
    smoke: [],
    noise: null,
    coinFx: null,
    time: 0,
    elapsed: 0,
    intel: !!loadout.intel,
    frozen: false, // screenshot presets hold the staged state
    message: null,
    prompt: null,
  };
}

function showMessage(text, color) {
  world.message = { text, color: color || '#ffd94d', ttl: 2.6 };
}

// ---- Tool effects ---------------------------------------------------------

function toolCallbacks() {
  return {
    onSmoke(x, y) {
      world.smoke.push({ x, y, r: TOOLS.smoke.radius, ttl: TOOLS.smoke.duration });
      sfx.smoke();
    },
    onEmp() {
      disableAllCameras(world.cameras, TOOLS.emp.duration);
      for (const g of world.guards) {
        if (Math.hypot(g.x - world.player.x, g.y - world.player.y) < TOOLS.emp.radius) {
          g.confused = 2.5;
          g.awareness = 0;
          if (g.state === 'chase') g.state = 'search';
        }
      }
      sfx.emp();
      showMessage('EMP pulse — cameras down, guards stunned', '#7fd4ff');
    },
    onCoin(x, y) {
      world.noise = { x, y, lureRadius: TOOLS.coin.lureRadius, ttl: 5 };
      world.coinFx = { x, y, ttl: 1 };
      sfx.coin();
    },
  };
}

// ---- Interaction ----------------------------------------------------------

function nearestInteractable() {
  const p = world.player;
  let best = null;
  let bestDist = PLAYER.interactRange;
  const consider = (kind, item, x, y) => {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestDist) { bestDist = d; best = { kind, item }; }
  };
  if (!p.hasDiamond) consider('diamond', null, world.level.diamond.x, world.level.diamond.y);
  for (const item of world.loot) if (!item.taken) consider('loot', item, item.x, item.y);
  for (const card of world.keycards) if (!card.taken) consider('keycard', card, card.x, card.y);
  for (const t of world.terminals) if (!t.used) consider('terminal', t, t.x, t.y);
  for (const door of world.doors) {
    if (!door.open) consider('door', door, door.x + door.w / 2, door.y + door.h / 2);
  }
  const ex = world.level.exit;
  if (pointInRect(p.x, p.y, { x: ex.x - 10, y: ex.y - 10, w: ex.w + 20, h: ex.h + 20 })) {
    best = { kind: 'exit', item: null };
  }
  return best;
}

function promptFor(target) {
  if (!target) return null;
  switch (target.kind) {
    case 'diamond': return 'Press E — take the Meridian Diamond';
    case 'loot': return `Press E — take ${target.item.label} ($${target.item.value})`;
    case 'keycard': return `Press E — take ${target.item.label}`;
    case 'terminal': return 'Press E — hack the cameras (12s)';
    case 'door': return world.player.keycards.has(target.item.cardId)
      ? `Press E — unlock ${target.item.label}` : `Locked — find Keycard ${target.item.cardId}`;
    case 'exit': return world.player.hasDiamond
      ? 'Press E — escape!' : 'Exit sealed — steal the diamond first';
    default: return null;
  }
}

function doInteract(target) {
  const p = world.player;
  switch (target.kind) {
    case 'diamond': {
      p.hasDiamond = true;
      world.alarm.add(15);
      for (const g of world.guards) {
        g.awareness = Math.max(g.awareness, 50);
        if (g.state === 'patrol') g.state = 'suspicious';
        g.lastSeen = { x: p.x, y: p.y };
      }
      sfx.diamond();
      showMessage('THE DIAMOND IS YOURS — GETAWAY! Reach the exit!', '#ff4757');
      break;
    }
    case 'loot': {
      const value = collectLootItem(p, target.item);
      sfx.pickup();
      showMessage(`+ $${value} — ${target.item.label}`);
      break;
    }
    case 'keycard': {
      target.item.taken = true;
      p.keycards.add(target.item.cardId);
      sfx.pickup();
      showMessage(`${target.item.label} taken — a vault door opens now`);
      break;
    }
    case 'terminal': {
      target.item.used = true;
      disableAllCameras(world.cameras, CAMERA.disableTime);
      sfx.emp();
      showMessage('Cameras hacked — blind for 12 seconds', '#7fd4ff');
      break;
    }
    case 'door': {
      if (p.keycards.has(target.item.cardId)) {
        target.item.open = true;
        sfx.click();
        showMessage(`${target.item.label} unlocked`);
      } else {
        showMessage(`Locked — find Keycard ${target.item.cardId} first`, '#ffa502');
      }
      break;
    }
    case 'exit': {
      if (p.hasDiamond) completeLevel();
      else showMessage('The exit is sealed — steal the diamond first', '#ffa502');
      break;
    }
  }
}

// ---- Endings --------------------------------------------------------------

function caught(reason) {
  caughtReason = reason;
  phase = 'caught';
  sfx.caught();
}

function completeLevel() {
  const p = world.player;
  const timeBonus = Math.max(0, Math.floor(world.level.parTime - world.elapsed)) * SCORE.timeBonusPerSecond;
  const ghostBonus = world.alarm.max < SCORE.ghostAlarmMax ? SCORE.ghostBonus : 0;
  const levelTotal = SCORE.diamond + p.lootValue + timeBonus + ghostBonus;
  campaign.score += levelTotal;
  campaign.budget += 50 + Math.floor(p.lootValue / 10);
  breakdown = {
    levelName: `Level ${world.level.id} — ${world.level.name}`,
    diamond: SCORE.diamond,
    loot: p.lootValue,
    timeBonus,
    ghostBonus,
    levelTotal,
    campaignTotal: campaign.score,
  };
  phase = 'levelComplete';
  sfx.escape();
}

// ---- Update ---------------------------------------------------------------

function updatePlaying(dt) {
  world.time += dt;
  world.elapsed += dt;

  updatePlayer(world.player, dt, input, world.solids, toolCallbacks());

  const target = nearestInteractable();
  world.prompt = promptFor(target);
  if (input.wasPressed('interact') && target) doInteract(target);
  if (phase !== 'playing') return;

  // Guards and cameras.
  let anySeen = false;
  const guardWorld = {
    player: world.player,
    walls: world.solids,
    smoke: world.smoke,
    shadowZones: world.level.shadowZones,
    noise: world.noise,
    time: world.time,
    onSpotted: () => {
      world.alarm.add(8);
      sfx.spotted();
      showMessage('SPOTTED! Break line of sight!', '#ff4757');
    },
    onCaught: () => caught('A guard caught you red-handed.'),
  };
  for (const g of world.guards) {
    if (updateGuard(g, dt, guardWorld)) anySeen = true;
    if (phase !== 'playing') return;
  }
  const camWorld = { player: world.player, walls: world.solids, smoke: world.smoke, time: world.time, alarm: world.alarm };
  for (const cam of world.cameras) {
    if (updateCamera(cam, dt, camWorld)) anySeen = true;
  }

  // Alarm.
  const alarmEvent = updateAlarm(world.alarm, dt, { anySeen, getaway: world.player.hasDiamond });
  if (alarmEvent === 'lockdown') {
    sfx.alarm();
    showMessage('LOCKDOWN! 30 seconds to reach the exit!', '#ff4757');
    for (const g of world.guards) {
      g.state = 'chase';
      g.awareness = 100;
      g.lastSeen = { x: world.player.x, y: world.player.y };
    }
  } else if (alarmEvent === 'lockdownExpired') {
    caught('Lockdown — the response team arrived.');
    return;
  }

  // Timers.
  for (const c of world.smoke) c.ttl -= dt;
  world.smoke = world.smoke.filter((c) => c.ttl > 0);
  if (world.noise) {
    world.noise.ttl -= dt;
    if (world.noise.ttl <= 0) world.noise = null;
  }
  if (world.coinFx) {
    world.coinFx.ttl -= dt;
    if (world.coinFx.ttl <= 0) world.coinFx = null;
  }
  if (world.message) {
    world.message.ttl -= dt;
    if (world.message.ttl <= 0) world.message = null;
  }

  // Walk into the exit with the diamond.
  const p = world.player;
  const ex = world.level.exit;
  if (p.hasDiamond && pointInRect(p.x, p.y, ex)) completeLevel();
}

function hudScore() {
  const p = world.player;
  return campaign.score + p.lootValue + (p.hasDiamond ? SCORE.diamond : 0);
}

// ---- Shop -----------------------------------------------------------------

function adjustShop(key, delta) {
  const price = TOOLS[key].price;
  if (key === 'intel') {
    if (delta > 0 && !shop.intel && shop.budget >= price) {
      shop.intel = true;
      shop.budget -= price;
      sfx.click();
    } else if (delta < 0 && shop.intel) {
      shop.intel = false;
      shop.budget += price;
      sfx.click();
    }
    return;
  }
  if (delta > 0 && shop.budget >= price && shop[key] < 5) {
    shop[key] += 1;
    shop.budget -= price;
    sfx.click();
  } else if (delta < 0 && shop[key] > 0) {
    shop[key] -= 1;
    shop.budget += price;
    sfx.click();
  }
}

function startHeist() {
  sfx.unlock();
  campaign.budget = shop.budget;
  const loadout = { smoke: shop.smoke, emp: shop.emp, coin: shop.coin, intel: shop.intel };
  loadoutSnapshot = { budget: campaign.budget, shop: { ...shop } };
  loadLevel(levelIndex, loadout);
  phase = 'playing';
  sfx.click();
}

function retryLevel() {
  if (loadoutSnapshot) {
    campaign.budget = loadoutSnapshot.budget;
    shop = { ...loadoutSnapshot.shop };
  } else {
    shop = freshShop();
  }
  loadLevel(levelIndex, { smoke: 0, emp: 0, coin: 0, intel: false });
  phase = 'briefing';
  sfx.click();
}

function nextLevel() {
  levelIndex += 1;
  if (levelIndex >= LEVELS.length) {
    phase = 'campaignComplete';
    return;
  }
  shop = freshShop();
  loadLevel(levelIndex, { smoke: 0, emp: 0, coin: 0, intel: false });
  phase = 'briefing';
  sfx.click();
}

function restartCampaign() {
  levelIndex = 0;
  campaign.score = 0;
  campaign.budget = STARTING_BUDGET;
  shop = freshShop();
  loadLevel(0, { smoke: 0, emp: 0, coin: 0, intel: false });
  phase = 'briefing';
  sfx.click();
}

// ---- Click routing --------------------------------------------------------

function hit(rect, click) {
  return click && click.x >= rect.x && click.x <= rect.x + rect.w && click.y >= rect.y && click.y <= rect.y + rect.h;
}

function handleScreenClick() {
  const click = input.consumeClick();
  if (!click) return;
  if (phase === 'briefing' && screenButtons) {
    for (const row of screenButtons.rows) {
      if (hit(row.minus, click)) { adjustShop(row.key, -1); return; }
      if (hit(row.plus, click)) { adjustShop(row.key, 1); return; }
    }
    if (hit(screenButtons.start, click)) startHeist();
  } else if (phase === 'caught' && screenButtons) {
    if (hit(screenButtons.retry, click)) retryLevel();
  } else if (phase === 'levelComplete' && screenButtons) {
    if (hit(screenButtons.next, click)) nextLevel();
  } else if (phase === 'campaignComplete' && screenButtons) {
    if (hit(screenButtons.again, click)) restartCampaign();
  }
}

// ---- Screenshot presets ---------------------------------------------------
// ?shot=1..4 stages a real game state for the entry screenshots. Every preset
// is a state reachable by playing; the code renders it, nothing is faked.

function applyShotPreset() {
  const shot = params.get('shot');
  const levelParam = parseInt(params.get('level') || '0', 10);
  if (levelParam > 0 && levelParam < LEVELS.length) levelIndex = levelParam;
  if (!shot) return;

  if (shot === '1') {
    // Cover: mid-infiltration, thief near the diamond, one guard suspicious.
    levelIndex = 0;
    startHeistFromPreset({ smoke: 2, emp: 1, coin: 3, intel: true });
    world.player.x = 700;
    world.player.y = 300;
    world.player.facing = 0.4;
    world.player.lootValue = 500;
    world.player.lootCount = 1;
    world.loot[0].taken = true;
    world.alarm.value = 32;
    world.alarm.max = 32;
    const g = world.guards[0];
    g.x = 620; g.y = 150;
    g.state = 'suspicious';
    g.awareness = 58;
    g.lastSeen = { x: 700, y: 300 };
    g.facing = Math.atan2(300 - 150, 700 - 620);
    world.time = 12;
    world.frozen = true;
  } else if (shot === '2') {
    // Getaway: diamond taken, alarm high, guards closing in.
    levelIndex = 0;
    startHeistFromPreset({ smoke: 1, emp: 0, coin: 1, intel: false });
    world.player.x = 300;
    world.player.y = 500;
    world.player.facing = Math.PI;
    world.player.hasDiamond = true;
    world.player.lootValue = 1250;
    world.player.lootCount = 2;
    world.loot[0].taken = true;
    world.loot[2].taken = true;
    world.alarm.value = 76;
    world.alarm.max = 76;
    for (const g of world.guards) {
      g.state = 'chase';
      g.awareness = 100;
      g.lastSeen = { x: 300, y: 500 };
    }
    world.guards[0].x = 520; world.guards[0].y = 360;
    world.guards[0].facing = Math.atan2(500 - 360, 300 - 520);
    world.guards[1].x = 560; world.guards[1].y = 580;
    world.guards[1].facing = Math.atan2(500 - 580, 300 - 560);
    world.time = 45;
    world.elapsed = 96;
    world.frozen = true;
    showMessage('GETAWAY! Reach the exit!', '#ff4757');
  } else if (shot === '4') {
    levelIndex = 0;
    loadLevel(0, { smoke: 0, emp: 0, coin: 0, intel: false });
    caughtReason = 'A guard caught you red-handed.';
    phase = 'caught';
  }
}

function startHeistFromPreset(loadout) {
  campaign.budget = STARTING_BUDGET;
  shop = { ...loadout, budget: campaign.budget };
  loadoutSnapshot = { budget: campaign.budget, shop: { ...shop } };
  loadLevel(levelIndex, loadout);
  phase = 'playing';
}

// ---- Main loop ------------------------------------------------------------

function draw() {
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  if (phase === 'briefing') {
    drawWorld(ctx, world);
    drawHUD(ctx, { ...world, score: campaign.score });
    screenButtons = drawBriefing(ctx, { level: world.level, budget: shop.budget, smoke: shop.smoke, emp: shop.emp, coin: shop.coin, intel: shop.intel, campaignScore: campaign.score }, input.mouse);
  } else if (phase === 'playing') {
    drawWorld(ctx, world);
    drawHUD(ctx, { ...world, score: hudScore() });
    if (paused) drawPaused(ctx);
  } else if (phase === 'caught') {
    drawWorld(ctx, world);
    drawHUD(ctx, { ...world, score: hudScore() });
    screenButtons = drawCaught(ctx, caughtReason, hudScore(), input.mouse);
  } else if (phase === 'levelComplete') {
    drawWorld(ctx, world);
    drawHUD(ctx, { ...world, score: campaign.score });
    screenButtons = drawLevelComplete(ctx, breakdown, levelIndex >= LEVELS.length - 1, input.mouse);
  } else if (phase === 'campaignComplete') {
    drawWorld(ctx, world);
    drawHUD(ctx, { ...world, score: campaign.score });
    screenButtons = drawCampaignComplete(ctx, campaign.score, gradeFor(campaign.score), input.mouse);
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (input.wasPressed('mute')) sfx.toggleMute();
  if (phase === 'playing' && input.wasPressed('pause')) paused = !paused;

  if (phase === 'playing' && !paused && !world.frozen) {
    updatePlaying(dt);
  } else if (phase !== 'playing') {
    handleScreenClick();
  } else if (paused) {
    input.consumeClick();
  }

  draw();
  input.endFrame();
  requestAnimationFrame(frame);
}

// ---- Boot -----------------------------------------------------------------

window.addEventListener('pointerdown', () => sfx.unlock(), { once: true });
window.addEventListener('keydown', () => sfx.unlock(), { once: true });

// Debug hook for automated play-testing (read-only state snapshot).
window.__heist = {
  get phase() { return phase; },
  get paused() { return paused; },
  snapshot() {
    if (!world) return null;
    return {
      phase,
      level: world.levelIndex,
      player: {
        x: Math.round(world.player.x), y: Math.round(world.player.y),
        hasDiamond: world.player.hasDiamond, lootValue: world.player.lootValue,
        tools: { ...world.player.tools }, keycards: [...world.player.keycards],
      },
      guards: world.guards.map((g) => ({
        x: Math.round(g.x), y: Math.round(g.y), facing: g.facing,
        state: g.state, awareness: Math.round(g.awareness),
      })),
      cameras: world.cameras.map((c) => ({
        x: c.x, y: c.y, facing: c.facing, tracking: c.tracking, disabled: c.disabled,
      })),
      alarm: Math.round(world.alarm.value),
      alarmMax: Math.round(world.alarm.max),
      lockdown: world.alarm.lockdown,
      elapsed: Math.round(world.elapsed),
      diamond: { x: world.level.diamond.x, y: world.level.diamond.y },
      exit: { x: world.level.exit.x + world.level.exit.w / 2, y: world.level.exit.y + world.level.exit.h / 2 },
      lootLeft: world.loot.filter((i) => !i.taken).length,
    };
  },
};

loadLevel(levelIndex, { smoke: 0, emp: 0, coin: 0, intel: false });
applyShotPreset();
requestAnimationFrame(frame);
