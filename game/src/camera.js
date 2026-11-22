// Security cameras: fixed mounts with a sweeping cone. Being in frame feeds
// the alarm meter. An EMP pulse or a hacked terminal disables them for a while.

import { CAMERA } from './config.js';
import { canSeeObserver } from './vision.js';

export function createCamera(def) {
  return {
    x: def.x,
    y: def.y,
    baseAngle: def.baseAngle,
    sweep: def.sweep,
    speed: def.speed,
    phase: def.phase || 0,
    facing: def.baseAngle,
    viewRange: CAMERA.viewRange,
    viewAngle: CAMERA.viewAngle,
    disabled: 0,
    tracking: false,
  };
}

export function updateCamera(cam, dt, world) {
  cam.facing = cam.baseAngle + Math.sin(world.time * cam.speed + cam.phase) * cam.sweep;
  if (cam.disabled > 0) {
    cam.disabled -= dt;
    cam.tracking = false;
    return false;
  }
  let hidden = false;
  for (const c of world.smoke) {
    if (Math.hypot(world.player.x - c.x, world.player.y - c.y) < c.r) { hidden = true; break; }
  }
  const vis = hidden ? { seen: false } : canSeeObserver(cam, world.player.x, world.player.y, world.walls);
  cam.tracking = vis.seen;
  if (vis.seen) world.alarm.add(CAMERA.alarmRate * dt);
  return vis.seen;
}

export function disableAllCameras(cameras, seconds) {
  for (const cam of cameras) cam.disabled = Math.max(cam.disabled, seconds);
}
