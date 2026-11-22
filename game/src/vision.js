// Vision: line-of-sight and cone tests shared by guards and cameras.
// Walls block sight; smoke clouds hide the thief; shadow zones slow detection.

export function segmentHitsRect(x1, y1, x2, y2, r) {
  // Slab method: does the segment enter the rectangle?
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x1 < r.x || x1 > r.x + r.w) return false;
  } else {
    let t1 = (r.x - x1) / dx;
    let t2 = (r.x + r.w - x1) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y1 < r.y || y1 > r.y + r.h) return false;
  } else {
    let t1 = (r.y - y1) / dy;
    let t2 = (r.y + r.h - y1) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

export function lineOfSightClear(x1, y1, x2, y2, walls) {
  for (const w of walls) {
    if (w.open) continue;
    if (segmentHitsRect(x1, y1, x2, y2, w)) return false;
  }
  return true;
}

export function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function pointInCone(ox, oy, facing, halfAngle, range, tx, ty) {
  const dx = tx - ox;
  const dy = ty - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return { inside: false, dist };
  if (dist < 6) return { inside: true, dist };
  const ang = Math.atan2(dy, dx);
  const inside = Math.abs(angleDifference(ang, facing)) <= halfAngle;
  return { inside, dist };
}

// Full visibility test: in the cone AND a clear line of sight.
export function canSeeObserver(observer, tx, ty, walls) {
  const cone = pointInCone(observer.x, observer.y, observer.facing, observer.viewAngle, observer.viewRange, tx, ty);
  if (!cone.inside) return { seen: false, dist: cone.dist };
  if (!lineOfSightClear(observer.x, observer.y, tx, ty, walls)) return { seen: false, dist: cone.dist };
  return { seen: true, dist: cone.dist };
}

export function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function circleHitsRect(cx, cy, radius, r) {
  const nx = Math.max(r.x, Math.min(cx, r.x + r.w));
  const ny = Math.max(r.y, Math.min(cy, r.y + r.h));
  return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) < radius * radius;
}
