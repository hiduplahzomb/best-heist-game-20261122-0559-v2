// Render: every pixel of Gilded Shadow — the noir floor, sweeping vision
// cones, glowing loot, the alarm meter, and the briefing / caught / debrief
// screens. All art is drawn in code; the game loads no image or font files.

import { VIEW, PALETTE, TOOLS, HUD_HEIGHT } from './config.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCone(ctx, x, y, facing, halfAngle, range, fill, edge) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, facing - halfAngle, facing + halfAngle);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawGem(ctx, x, y, size, color, glow) {
  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = 14;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size * 0.75, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size * 0.75, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.moveTo(x, y - size * 0.6);
  ctx.lineTo(x + size * 0.3, y - size * 0.1);
  ctx.lineTo(x, y + size * 0.2);
  ctx.lineTo(x - size * 0.3, y - size * 0.1);
  ctx.closePath();
  ctx.fill();
}

function drawButton(ctx, rect, label, mouse, accent) {
  const hover = mouse && mouse.x >= rect.x && mouse.x <= rect.x + rect.w && mouse.y >= rect.y && mouse.y <= rect.y + rect.h;
  ctx.save();
  rr(ctx, rect.x, rect.y, rect.w, rect.h, 8);
  ctx.fillStyle = hover ? (accent || '#e8b93e') : '#2a3352';
  ctx.fill();
  ctx.strokeStyle = accent || '#e8b93e';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = hover ? '#10141f' : '#e8eaf2';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
  ctx.restore();
  return hover;
}

// ---- The floor ------------------------------------------------------------

export function drawWorld(ctx, w) {
  const { level, time } = w;
  ctx.fillStyle = PALETTE.floor;
  ctx.fillRect(0, HUD_HEIGHT, VIEW.width, VIEW.height - HUD_HEIGHT);

  // Subtle floor tiles.
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 1;
  for (let x = 14; x < 1010; x += 62) {
    ctx.beginPath(); ctx.moveTo(x, 58); ctx.lineTo(x, 626); ctx.stroke();
  }
  for (let y = 58; y < 626; y += 62) {
    ctx.beginPath(); ctx.moveTo(14, y); ctx.lineTo(1010, y); ctx.stroke();
  }

  // Shadow zones: dark green pools where detection is slower.
  for (const z of level.shadowZones) {
    ctx.fillStyle = PALETTE.shadowZone;
    ctx.fillRect(z.x, z.y, z.w, z.h);
    ctx.strokeStyle = PALETTE.shadowEdge;
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(z.x, z.y, z.w, z.h);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(64,220,160,0.5)';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SHADOW', z.x + 6, z.y + 14);
  }

  // Patrol routes (Floor Intel).
  if (w.intel) {
    ctx.strokeStyle = 'rgba(255,255,255,0.30)';
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1.5;
    for (const g of w.guards) {
      ctx.beginPath();
      g.waypoints.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.closePath();
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // Exit door.
  const ex = level.exit;
  const exitActive = w.player.hasDiamond;
  ctx.save();
  ctx.shadowColor = exitActive ? '#2ed573' : '#555';
  ctx.shadowBlur = exitActive ? 18 : 4;
  ctx.fillStyle = exitActive ? '#1d7a4a' : '#333a4d';
  rr(ctx, ex.x, ex.y, ex.w, ex.h, 6);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = exitActive ? '#d8ffe9' : '#8a93b2';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(exitActive ? 'EXIT ►' : 'EXIT', ex.x + ex.w / 2, ex.y + ex.h / 2 + 5);
  if (!exitActive) {
    ctx.fillStyle = 'rgba(138,147,178,0.8)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('SEALED', ex.x + ex.w / 2, ex.y + ex.h / 2 + 19);
  }

  // The Meridian Diamond: the job's target, glowing with a light beam.
  if (!w.player.hasDiamond) {
    const d = level.diamond;
    const pulse = 1 + Math.sin(time * 3) * 0.12;
    const grad = ctx.createLinearGradient(d.x, 58, d.x, d.y);
    grad.addColorStop(0, 'rgba(255,217,77,0)');
    grad.addColorStop(1, 'rgba(255,217,77,0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(d.x - 10, 58, 20, d.y - 58);
    ctx.strokeStyle = `rgba(255,217,77,${0.5 + 0.3 * Math.sin(time * 3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(d.x, d.y, 26 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    drawGem(ctx, d.x, d.y, 16, PALETTE.goldBright, '#ffd94d');
    ctx.fillStyle = PALETTE.goldBright;
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('◆ MERIDIAN DIAMOND', d.x, d.y + 40);
  }

  // Side loot.
  for (const item of w.loot) {
    if (item.taken) continue;
    if (item.kind === 'gem') {
      drawGem(ctx, item.x, item.y, 9, item.value >= 750 ? '#7fd4ff' : '#ff9ff3', '#7fd4ff');
    } else if (item.kind === 'painting') {
      ctx.fillStyle = '#8a6d2b';
      ctx.fillRect(item.x - 11, item.y - 8, 22, 16);
      ctx.fillStyle = '#4a6fa5';
      ctx.fillRect(item.x - 8, item.y - 5, 16, 10);
    } else {
      ctx.fillStyle = '#2ed573';
      rr(ctx, item.x - 10, item.y - 7, 20, 14, 3);
      ctx.fill();
      ctx.fillStyle = '#0d1322';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', item.x, item.y + 3);
    }
    ctx.fillStyle = 'rgba(232,185,62,0.9)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$' + item.value, item.x, item.y + 22);
  }

  // Keycards.
  for (const card of w.keycards) {
    if (card.taken) continue;
    ctx.save();
    ctx.shadowColor = '#4a9eff';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#2f6fd0';
    rr(ctx, card.x - 10, card.y - 7, 20, 14, 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(card.cardId, card.x, card.y + 3);
  }

  // Hack terminals.
  for (const t of w.terminals) {
    ctx.fillStyle = t.used ? '#2a2f42' : '#1d3a5f';
    rr(ctx, t.x - 12, t.y - 12, 24, 24, 4);
    ctx.fill();
    ctx.fillStyle = t.used ? '#555' : '#4a9eff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⌨', t.x, t.y + 5);
    if (!t.used) {
      ctx.fillStyle = 'rgba(74,158,255,0.85)';
      ctx.font = '9px system-ui, sans-serif';
      ctx.fillText('HACK', t.x, t.y + 24);
    }
  }

  // Walls with gold trim.
  for (const wall of w.solids) {
    if (wall.open) continue;
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.fillStyle = 'rgba(201,162,39,0.55)';
    ctx.fillRect(wall.x, wall.y, wall.w, 2);
  }
  // Locked doors stand out.
  for (const door of w.doors) {
    if (door.open) continue;
    ctx.fillStyle = '#5a2d2d';
    ctx.fillRect(door.x, door.y, door.w, door.h);
    ctx.strokeStyle = PALETTE.warn;
    ctx.lineWidth = 2;
    ctx.strokeRect(door.x + 1, door.y + 1, door.w - 2, door.h - 2);
    ctx.fillStyle = PALETTE.warn;
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(door.x + door.w / 2, door.y + door.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('LOCKED ' + door.cardId, 0, 3);
    ctx.restore();
  }

  // Smoke clouds hide the thief.
  for (const c of w.smoke) {
    const alpha = Math.min(0.75, (c.ttl / 1.2) * 0.75);
    const grad = ctx.createRadialGradient(c.x, c.y, 4, c.x, c.y, c.r);
    grad.addColorStop(0, `rgba(180,190,210,${alpha})`);
    grad.addColorStop(1, 'rgba(180,190,210,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Camera cones first (under guard cones).
  for (const cam of w.cameras) {
    if (cam.disabled > 0) continue;
    drawCone(
      ctx, cam.x, cam.y, cam.facing, cam.viewAngle, cam.viewRange,
      cam.tracking ? 'rgba(255,71,87,0.32)' : PALETTE.cameraCone,
      cam.tracking ? 'rgba(255,71,87,0.7)' : 'rgba(190,80,255,0.55)',
    );
  }

  // Guard vision cones, coloured by state.
  for (const g of w.guards) {
    let fill = 'rgba(255,165,2,0.20)';
    let edge = 'rgba(255,165,2,0.55)';
    if (g.state === 'chase') { fill = 'rgba(255,71,87,0.34)'; edge = 'rgba(255,71,87,0.8)'; }
    else if (g.state === 'suspicious' || g.state === 'search') { fill = 'rgba(255,140,0,0.28)'; edge = 'rgba(255,140,0,0.7)'; }
    drawCone(ctx, g.x, g.y, g.facing, g.viewAngle, g.viewRange, fill, edge);
  }

  // Cameras (the mounts).
  for (const cam of w.cameras) {
    ctx.fillStyle = cam.disabled > 0 ? '#3a3f52' : '#2b3247';
    ctx.beginPath();
    ctx.arc(cam.x, cam.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = cam.tracking ? PALETTE.danger : '#8a93b2';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = cam.disabled > 0 ? '#666' : (cam.tracking ? '#ff4757' : '#ff5e7a');
    ctx.beginPath();
    ctx.arc(cam.x + Math.cos(cam.facing) * 5, cam.y + Math.sin(cam.facing) * 5, 3, 0, Math.PI * 2);
    ctx.fill();
    if (cam.disabled > 0) {
      ctx.fillStyle = '#8a93b2';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(Math.ceil(cam.disabled) + 's', cam.x, cam.y - 14);
    }
  }

  // Guards.
  for (const g of w.guards) {
    ctx.fillStyle = '#2f3542';
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = g.state === 'chase' ? PALETTE.danger : '#dfe4ea';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Facing tick.
    ctx.strokeStyle = '#dfe4ea';
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(g.facing) * (g.radius + 5), g.y + Math.sin(g.facing) * (g.radius + 5));
    ctx.stroke();
    // Awareness arc.
    if (g.awareness > 2 && g.state !== 'chase') {
      ctx.strokeStyle = g.awareness > 60 ? PALETTE.warn : '#f1c40f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.radius + 6, -Math.PI / 2, -Math.PI / 2 + (g.awareness / 100) * Math.PI * 2);
      ctx.stroke();
    }
    // State marker.
    if (g.state === 'chase') {
      ctx.fillStyle = PALETTE.danger;
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', g.x, g.y - g.radius - 8);
    } else if (g.state === 'suspicious' || g.state === 'search') {
      ctx.fillStyle = PALETTE.warn;
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', g.x, g.y - g.radius - 8);
    }
    if (g.confused > 0) {
      ctx.fillStyle = '#7fd4ff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('~', g.x, g.y - g.radius - 8);
    }
  }

  // The thief.
  const p = w.player;
  const inShadow = w.level.shadowZones.some((z) => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h);
  if (p.sneaking) {
    ctx.strokeStyle = 'rgba(232,185,62,0.6)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (inShadow) {
    ctx.strokeStyle = 'rgba(64,220,160,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#14141f';
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // Hood direction.
  ctx.fillStyle = PALETTE.goldBright;
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(p.facing) * (p.radius + 2), p.y + Math.sin(p.facing) * (p.radius + 2));
  ctx.lineTo(p.x + Math.cos(p.facing + 2.4) * 7, p.y + Math.sin(p.facing + 2.4) * 7);
  ctx.lineTo(p.x + Math.cos(p.facing - 2.4) * 7, p.y + Math.sin(p.facing - 2.4) * 7);
  ctx.closePath();
  ctx.fill();
  if (p.hasDiamond) {
    drawGem(ctx, p.x, p.y - 24, 7, PALETTE.goldBright, '#ffd94d');
  }

  // Thrown coin sparkle.
  if (w.coinFx) {
    ctx.strokeStyle = `rgba(255,217,77,${Math.min(1, w.coinFx.ttl)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w.coinFx.x, w.coinFx.y, 10 + (1 - w.coinFx.ttl) * 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.goldBright;
    ctx.beginPath();
    ctx.arc(w.coinFx.x, w.coinFx.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Interaction prompt.
  if (w.prompt) {
    ctx.fillStyle = 'rgba(10,14,26,0.85)';
    const pw = ctx.measureText(w.prompt).width + 24;
    rr(ctx, p.x - pw / 2, p.y - 52, pw, 24, 6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(w.prompt, p.x, p.y - 35);
  }

  // Toast message.
  if (w.message && w.message.ttl > 0) {
    ctx.globalAlpha = Math.min(1, w.message.ttl);
    ctx.fillStyle = 'rgba(10,14,26,0.88)';
    ctx.font = 'bold 15px system-ui, sans-serif';
    const mw = ctx.measureText(w.message.text).width + 32;
    rr(ctx, VIEW.width / 2 - mw / 2, HUD_HEIGHT + 10, mw, 30, 8);
    ctx.fill();
    ctx.fillStyle = w.message.color || '#ffd94d';
    ctx.textAlign = 'center';
    ctx.fillText(w.message.text, VIEW.width / 2, HUD_HEIGHT + 30);
    ctx.globalAlpha = 1;
  }
}

// ---- HUD ------------------------------------------------------------------

export function drawHUD(ctx, w) {
  ctx.fillStyle = '#0a0e1a';
  ctx.fillRect(0, 0, VIEW.width, HUD_HEIGHT);
  ctx.fillStyle = 'rgba(201,162,39,0.6)';
  ctx.fillRect(0, HUD_HEIGHT - 2, VIEW.width, 2);

  // Level + objective.
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`LVL ${w.level.id} · ${w.level.name}`, 14, 21);
  const objective = w.player.hasDiamond ? 'GETAWAY — reach the EXIT!' : 'Steal the Meridian Diamond ◆';
  ctx.fillStyle = w.player.hasDiamond ? PALETTE.danger : PALETTE.muted;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(objective, 14, 40);

  // Alarm meter.
  const ax = 330;
  const aw = 300;
  const av = w.alarm.value;
  const alarmColor = av >= 100 ? PALETTE.danger : av >= 30 ? PALETTE.warn : PALETTE.calm;
  ctx.fillStyle = PALETTE.muted;
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ALARM', ax, 18);
  ctx.fillStyle = '#1e2438';
  rr(ctx, ax, 24, aw, 14, 4);
  ctx.fill();
  if (av > 0) {
    const flash = w.alarm.lockdown && Math.sin(w.time * 10) > 0;
    ctx.fillStyle = flash ? '#ff8a94' : alarmColor;
    rr(ctx, ax, 24, Math.max(8, (aw * av) / 100), 14, 4);
    ctx.fill();
  }
  ctx.fillStyle = alarmColor;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText(w.alarm.lockdown ? `LOCKDOWN ${Math.ceil(w.alarm.lockdownTimer)}s` : `${Math.floor(av)}%`, ax + aw + 10, 36);

  // Score / loot / time.
  const mins = Math.floor(w.elapsed / 60);
  const secs = Math.floor(w.elapsed % 60).toString().padStart(2, '0');
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.goldBright;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(`SCORE ${w.score}`, VIEW.width - 14, 21);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`Loot $${w.player.lootValue} · ${mins}:${secs}`, VIEW.width - 14, 40);

  // Tool bar (bottom-left).
  const tools = [
    { label: `${TOOLS.smoke.key} Smoke`, count: w.player.tools.smoke },
    { label: `${TOOLS.emp.key} EMP`, count: w.player.tools.emp },
    { label: 'Click Coin', count: w.player.tools.coin },
  ];
  ctx.font = '12px system-ui, sans-serif';
  let tx = 14;
  for (const t of tools) {
    const tw = ctx.measureText(t.label).width + 34;
    ctx.fillStyle = t.count > 0 ? 'rgba(42,51,82,0.9)' : 'rgba(42,51,82,0.45)';
    rr(ctx, tx, VIEW.height - 30, tw, 22, 6);
    ctx.fill();
    ctx.fillStyle = t.count > 0 ? PALETTE.text : PALETTE.muted;
    ctx.textAlign = 'left';
    ctx.fillText(`${t.label} ×${t.count}`, tx + 8, VIEW.height - 15);
    tx += tw + 8;
  }
  ctx.fillStyle = PALETTE.muted;
  ctx.textAlign = 'right';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('WASD move · Shift sneak · E interact · P pause · M mute', VIEW.width - 14, VIEW.height - 15);
}

// ---- Screens --------------------------------------------------------------

function drawOverlay(ctx) {
  ctx.fillStyle = 'rgba(8,11,22,0.92)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

export function drawBriefing(ctx, shop, mouse) {
  drawOverlay(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.goldBright;
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('GILDED SHADOW', VIEW.width / 2, 72);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('The Meridian Vault Heist', VIEW.width / 2, 100);

  // Level card.
  ctx.fillStyle = '#161d33';
  rr(ctx, 112, 122, 800, 96, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(201,162,39,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Level ${shop.level.id} — ${shop.level.name}`, 132, 150);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '14px system-ui, sans-serif';
  const lines = wrapText(ctx, shop.level.brief, 760);
  lines.forEach((line, i) => ctx.fillText(line, 132, 176 + i * 20));

  // Budget.
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.goldBright;
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(`Budget: $${shop.budget}`, 912, 246);

  // Shop rows.
  const rows = [];
  const defs = [
    { key: 'smoke', name: TOOLS.smoke.name, desc: 'A cloud that hides you for 3.6s', price: TOOLS.smoke.price },
    { key: 'emp', name: TOOLS.emp.name, desc: 'Kills all cameras for 10s, stuns guards', price: TOOLS.emp.price },
    { key: 'coin', name: TOOLS.coin.name, desc: 'Click to throw — lures guards away', price: TOOLS.coin.price },
    { key: 'intel', name: TOOLS.intel.name, desc: 'Reveals every patrol route on the floor', price: TOOLS.intel.price },
  ];
  let y = 258;
  for (const def of defs) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#12182b';
    rr(ctx, 112, y, 800, 42, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(def.name, 128, y + 19);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(def.desc, 128, y + 34);
    ctx.fillStyle = PALETTE.goldBright;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`$${def.price}`, 700, y + 26);
    const minus = { x: 716, y: y + 8, w: 28, h: 26 };
    const plus = { x: 800, y: y + 8, w: 28, h: 26 };
    const count = def.key === 'intel' ? (shop.intel ? 1 : 0) : shop[def.key];
    drawButton(ctx, minus, '−', mouse);
    drawButton(ctx, plus, '+', mouse);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(count), 772, y + 26);
    rows.push({ key: def.key, minus, plus });
    y += 50;
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('WASD move · Shift sneak · E interact · Q smoke · R EMP · Click throws a coin · Shadows slow detection', VIEW.width / 2, 478);
  if (shop.campaignScore > 0) {
    ctx.fillStyle = PALETTE.goldBright;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`Campaign score so far: ${shop.campaignScore}`, VIEW.width / 2, 502);
  }

  const start = { x: 412, y: 522, w: 200, h: 52 };
  drawButton(ctx, start, 'START HEIST', mouse, '#e8b93e');
  return { start, rows };
}

export function drawCaught(ctx, reason, score, mouse) {
  drawOverlay(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.danger;
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText('CAUGHT!', VIEW.width / 2, 220);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText(reason, VIEW.width / 2, 268);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText(`Score this run: ${score} — the vault keeps its diamond. For now.`, VIEW.width / 2, 300);
  const retry = { x: 412, y: 360, w: 200, h: 52 };
  drawButton(ctx, retry, 'TRY AGAIN', mouse, '#ff4757');
  return { retry };
}

export function drawLevelComplete(ctx, breakdown, isLast, mouse) {
  drawOverlay(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.calm;
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText('CLEAN GETAWAY', VIEW.width / 2, 150);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(breakdown.levelName, VIEW.width / 2, 182);

  const rows = [
    ['The Meridian Diamond', breakdown.diamond],
    ['Side loot', breakdown.loot],
    ['Time bonus', breakdown.timeBonus],
    ['Ghost bonus (alarm stayed low)', breakdown.ghostBonus],
  ];
  ctx.font = '16px system-ui, sans-serif';
  let y = 240;
  for (const [label, value] of rows) {
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(label, 312, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = value > 0 ? PALETTE.goldBright : PALETTE.muted;
    ctx.fillText(value > 0 ? `+${value}` : '—', 712, y);
    y += 34;
  }
  ctx.strokeStyle = 'rgba(201,162,39,0.5)';
  ctx.beginPath();
  ctx.moveTo(312, y + 4);
  ctx.lineTo(712, y + 4);
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.fillText('Level total', 312, y + 34);
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.goldBright;
  ctx.fillText(String(breakdown.levelTotal), 712, y + 34);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(`Campaign total: ${breakdown.campaignTotal}`, VIEW.width / 2, y + 66);

  const next = { x: 412, y: y + 96, w: 200, h: 52 };
  drawButton(ctx, next, isLast ? 'FINISH THE JOB' : 'NEXT FLOOR', mouse, '#2ed573');
  return { next };
}

export function drawCampaignComplete(ctx, total, grade, mouse) {
  drawOverlay(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.goldBright;
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText('THE MERIDIAN JOB', VIEW.width / 2, 170);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.fillText('COMPLETE', VIEW.width / 2, 210);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Three floors. One diamond. No alarms that mattered.', VIEW.width / 2, 248);
  ctx.fillStyle = PALETTE.goldBright;
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText(`${total} points`, VIEW.width / 2, 310);
  ctx.fillStyle = PALETTE.calm;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`Rank: ${grade}`, VIEW.width / 2, 346);
  const again = { x: 412, y: 400, w: 200, h: 52 };
  drawButton(ctx, again, 'PLAY AGAIN', mouse, '#e8b93e');
  return { again };
}

export function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(8,11,22,0.7)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 36px system-ui, sans-serif';
  ctx.fillText('PAUSED', VIEW.width / 2, 300);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Press P to resume', VIEW.width / 2, 332);
}
