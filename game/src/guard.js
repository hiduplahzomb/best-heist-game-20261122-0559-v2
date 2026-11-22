// Guard AI: patrol waypoints, grow suspicious on a glimpse, chase on a
// confirmed sighting, then search the last known position and return to patrol.
// Detection is fair: sneaking, shadows and smoke all slow it down.

import { GUARD, PLAYER } from './config.js';
import { canSeeObserver, angleDifference, circleHitsRect, pointInRect } from './vision.js';

export function createGuard(def) {
  const [sx, sy] = def.waypoints[0];
  const [nx, ny] = def.waypoints[1] || def.waypoints[0];
  return {
    x: sx, y: sy,
    waypoints: def.waypoints,
    wpIndex: def.waypoints.length > 1 ? 1 : 0,
    speed: def.speed || GUARD.patrolSpeed,
    facing: Math.atan2(ny - sy, nx - sx),
    viewRange: GUARD.viewRange,
    viewAngle: GUARD.viewAngle,
    radius: GUARD.radius,
    awareness: 0,
    state: 'patrol', // patrol | suspicious | chase | search
    lastSeen: null,
    pauseTimer: 0,
    loseTimer: 0,
    searchTimer: 0,
    investigate: null,
    lookTimer: 0,
    confused: 0,
    baseFacing: Math.atan2(ny - sy, nx - sx),
  };
}

function slideMove(g, dx, dy, walls) {
  const nx = g.x + dx;
  let blocked = false;
  for (const w of walls) {
    if (w.open) continue;
    if (circleHitsRect(nx, g.y, g.radius, w)) { blocked = true; break; }
  }
  if (!blocked) g.x = nx;
  const ny = g.y + dy;
  blocked = false;
  for (const w of walls) {
    if (w.open) continue;
    if (circleHitsRect(g.x, ny, g.radius, w)) { blocked = true; break; }
  }
  if (!blocked) g.y = ny;
}

function moveToward(g, tx, ty, speed, dt, walls) {
  const dx = tx - g.x;
  const dy = ty - g.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const step = Math.min(dist, speed * dt);
  const mx = (dx / dist) * step;
  const my = (dy / dist) * step;
  slideMove(g, mx, my, walls);
  g.facing = Math.atan2(dy, dx);
  return dist <= step + 1;
}

function playerHiddenBySmoke(player, smoke) {
  for (const c of smoke) {
    if (Math.hypot(player.x - c.x, player.y - c.y) < c.r) return true;
  }
  return false;
}

function playerInShadow(player, shadowZones) {
  for (const z of shadowZones) {
    if (pointInRect(player.x, player.y, z)) return true;
  }
  return false;
}

// One guard tick. `world` carries player, walls, smoke, shadowZones, noise,
// time, and callbacks onSpotted / onCaught. Returns 'seen' when the guard
// currently has eyes on the thief.
export function updateGuard(g, dt, world) {
  const { player, walls } = world;
  if (g.confused > 0) {
    g.confused -= dt;
    g.awareness = Math.max(0, g.awareness - GUARD.decayRate * 2 * dt);
    return false;
  }

  const hidden = playerHiddenBySmoke(player, world.smoke);
  const vis = hidden
    ? { seen: false, dist: 999 }
    : canSeeObserver(g, player.x, player.y, walls);

  if (vis.seen) {
    let rate = GUARD.detectRate * (1.7 - vis.dist / GUARD.viewRange);
    if (player.sneaking) rate *= 0.45;
    if (playerInShadow(player, world.shadowZones)) rate *= 0.55;
    g.awareness = Math.min(100, g.awareness + rate * dt);
    g.lastSeen = { x: player.x, y: player.y };
    g.loseTimer = 0;
    if (g.awareness >= GUARD.alertAt && g.state !== 'chase') {
      g.state = 'chase';
      if (world.onSpotted) world.onSpotted(g);
    } else if (g.awareness >= GUARD.suspiciousAt && g.state === 'patrol') {
      g.state = 'suspicious';
    }
  } else {
    g.awareness = Math.max(0, g.awareness - GUARD.decayRate * dt);
    if (g.state === 'chase') {
      g.loseTimer += dt;
      if (g.loseTimer > GUARD.chaseLoseTime) {
        g.state = 'search';
        g.searchTimer = GUARD.searchTime;
      }
    } else if (g.state === 'suspicious' && g.awareness < GUARD.suspiciousAt && !g.investigate) {
      g.state = 'patrol';
    }
  }

  // A thrown coin pulls nearby patrolling guards to investigate.
  if (world.noise && (g.state === 'patrol' || g.state === 'suspicious')) {
    const d = Math.hypot(world.noise.x - g.x, world.noise.y - g.y);
    if (d < world.noise.lureRadius) {
      g.investigate = { x: world.noise.x, y: world.noise.y };
      g.state = 'suspicious';
      g.awareness = Math.max(g.awareness, 45);
    }
  }

  switch (g.state) {
    case 'patrol': {
      const target = g.waypoints[g.wpIndex];
      if (g.pauseTimer > 0) {
        g.pauseTimer -= dt;
        // Scan the room while paused: the cone sweeps, tension rises.
        g.facing = g.baseFacing + Math.sin(world.time * 2.2) * 0.55;
      } else if (moveToward(g, target[0], target[1], g.speed, dt, walls)) {
        g.wpIndex = (g.wpIndex + 1) % g.waypoints.length;
        const next = g.waypoints[g.wpIndex];
        g.baseFacing = Math.atan2(next[1] - g.y, next[0] - g.x);
        g.pauseTimer = GUARD.waypointPause;
      }
      break;
    }
    case 'suspicious': {
      if (g.investigate) {
        if (moveToward(g, g.investigate.x, g.investigate.y, GUARD.searchSpeed, dt, walls)) {
          g.investigate = null;
          g.lookTimer = 2.0;
        }
      } else if (g.lastSeen) {
        // Creep toward the glimpse, facing it.
        g.facing = Math.atan2(g.lastSeen.y - g.y, g.lastSeen.x - g.x);
        if (g.lookTimer > 0) g.lookTimer -= dt;
        else moveToward(g, g.lastSeen.x, g.lastSeen.y, GUARD.searchSpeed * 0.6, dt, walls);
      }
      break;
    }
    case 'chase': {
      const target = vis.seen ? { x: player.x, y: player.y } : g.lastSeen;
      if (target) moveToward(g, target.x, target.y, GUARD.chaseSpeed, dt, walls);
      if (Math.hypot(player.x - g.x, player.y - g.y) < PLAYER.catchRadius + 4) {
        if (world.onCaught) world.onCaught(g);
      }
      break;
    }
    case 'search': {
      if (g.lastSeen && !g.arrivedSearch) {
        if (moveToward(g, g.lastSeen.x, g.lastSeen.y, GUARD.searchSpeed, dt, walls)) {
          g.arrivedSearch = true;
        }
      } else {
        g.facing += dt * 1.8; // sweep the area, looking
        g.searchTimer -= dt;
        if (g.searchTimer <= 0) {
          g.state = 'patrol';
          g.awareness = 0;
          g.lastSeen = null;
          g.arrivedSearch = false;
        }
      }
      break;
    }
  }
  return vis.seen;
}
