// The thief: movement with wall sliding, sneak mode, and the three tools
// (smoke, EMP, decoy coin). Tool effects live in main.js; this file only
// reads the inputs and asks for them.

import { PLAYER, TOOLS } from './config.js';
import { circleHitsRect } from './vision.js';

export function createPlayer(spawn, loadout) {
  return {
    x: spawn.x,
    y: spawn.y,
    radius: PLAYER.radius,
    facing: -Math.PI / 2,
    sneaking: false,
    moving: false,
    tools: { smoke: loadout.smoke, emp: loadout.emp, coin: loadout.coin },
    keycards: new Set(),
    hasDiamond: false,
    lootValue: 0,
    lootCount: 0,
  };
}

function slideMove(p, dx, dy, solids) {
  const nx = p.x + dx;
  let blocked = false;
  for (const w of solids) {
    if (w.open) continue;
    if (circleHitsRect(nx, p.y, p.radius, w)) { blocked = true; break; }
  }
  if (!blocked) p.x = nx;
  const ny = p.y + dy;
  blocked = false;
  for (const w of solids) {
    if (w.open) continue;
    if (circleHitsRect(p.x, ny, p.radius, w)) { blocked = true; break; }
  }
  if (!blocked) p.y = ny;
}

export function updatePlayer(player, dt, input, solids, world) {
  let mx = 0;
  let my = 0;
  if (input.isDown('left')) mx -= 1;
  if (input.isDown('right')) mx += 1;
  if (input.isDown('up')) my -= 1;
  if (input.isDown('down')) my += 1;
  player.sneaking = input.isDown('sneak');
  player.moving = mx !== 0 || my !== 0;

  if (player.moving) {
    const len = Math.hypot(mx, my);
    const speed = player.sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    slideMove(player, (mx / len) * speed * dt, (my / len) * speed * dt, solids);
    player.facing = Math.atan2(my, mx);
  }

  if (input.wasPressed('smoke') && player.tools.smoke > 0) {
    player.tools.smoke -= 1;
    world.onSmoke(player.x, player.y);
  }
  if (input.wasPressed('emp') && player.tools.emp > 0) {
    player.tools.emp -= 1;
    world.onEmp();
  }
  const click = input.consumeClick();
  if (click && player.tools.coin > 0 && click.y > 56) {
    player.tools.coin -= 1;
    const dx = click.x - player.x;
    const dy = click.y - player.y;
    const dist = Math.hypot(dx, dy);
    const range = Math.min(dist, TOOLS.coin.throwRange);
    const tx = dist > 0 ? player.x + (dx / dist) * range : player.x;
    const ty = dist > 0 ? player.y + (dy / dist) * range : player.y;
    world.onCoin(tx, ty);
  }
}
