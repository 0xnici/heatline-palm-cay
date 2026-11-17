// render.js — draws Palm Cay on a 2D canvas: water and sand, the road
// grid, pastel roofs, palms, traffic, the law, and the player. The light
// stays sun-soaked all day; only its warmth drifts with the clock.
// Everything is culled to the camera's view, so the full city costs
// only what fits on screen.

import {
  WORLD_W, WORLD_H, WATER_X, SAND_X, ROAD_HALF, AVENUES, STREETS, PALETTE,
} from './config.js';
import { clamp } from './rng.js';
import { currentMarker } from './missions.js';

const VW = 1280, VH = 720;

function inView(x, y, pad, view) {
  return x > view.x - pad && x < view.x + VW + pad && y > view.y - pad && y < view.y + VH + pad;
}

// Warmth of the light by hour: 0 at night's edge, 1 at golden hour.
function lightWarmth(clockMin) {
  const h = clockMin / 60;
  if (h < 6 || h > 20) return 0.25;
  if (h < 9) return 0.55;
  if (h < 16) return 0.4;
  if (h < 19) return 1;
  return 0.6;
}

export function drawWorld(ctx, G) {
  const camX = G.camera.x - VW / 2;
  const camY = G.camera.y - VH / 2;
  const view = { x: camX, y: camY };
  ctx.save();
  ctx.translate(-camX, -camY);

  // Sea first, then the island on top of it.
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(camX - 10, camY - 10, VW + 20, VH + 20);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(WATER_X, camY - 10, camX + VW + 20 - WATER_X, VH + 20);
  ctx.strokeStyle = 'rgba(255,255,255,0.13)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let y = Math.floor(camY / 46) * 46; y < camY + VH + 46; y += 46) {
    const off = Math.sin(y * 0.05 + G.time * 0.7) * 9;
    ctx.moveTo(WATER_X + 12 + off, y);
    ctx.lineTo(Math.min(camX + VW, WORLD_W), y);
  }
  ctx.stroke();

  // Land: grass base, then the sand strip.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(camX - 10, camY - 10, Math.min(VW + 20, SAND_X - camX + 10), VH + 20);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(SAND_X, camY - 10, WATER_X - SAND_X, VH + 20);
  // Promenade between the coast avenue and the sand.
  ctx.fillStyle = '#d8c49a';
  ctx.fillRect(3200 + ROAD_HALF, camY - 10, SAND_X - 3200 - ROAD_HALF, VH + 20);

  // Parks and lots sit inside their blocks.
  for (const p of G.city.parks) {
    if (!inView(p.x + p.w / 2, p.y + p.h / 2, Math.max(p.w, p.h), view)) continue;
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(p.x + 14, p.y + 14, p.w - 28, 10);
  }
  for (const l of G.city.lots) {
    if (!inView(l.x + l.w / 2, l.y + l.h / 2, Math.max(l.w, l.h), view)) continue;
    ctx.fillStyle = '#8f8a7d';
    ctx.fillRect(l.x, l.y, l.w, l.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let x = l.x + 26; x < l.x + l.w - 10; x += 58) {
      ctx.beginPath(); ctx.moveTo(x, l.y + 12); ctx.lineTo(x, l.y + 62); ctx.stroke();
    }
  }

  // Sidewalks, then asphalt, then markings.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const a of AVENUES) ctx.fillRect(a - ROAD_HALF - 15, camY - 10, (ROAD_HALF + 15) * 2, VH + 20);
  for (const s of STREETS) ctx.fillRect(camX - 10, s - ROAD_HALF - 15, VW + 20, (ROAD_HALF + 15) * 2);
  ctx.fillStyle = PALETTE.asphalt;
  for (const a of AVENUES) ctx.fillRect(a - ROAD_HALF, camY - 10, ROAD_HALF * 2, VH + 20);
  for (const s of STREETS) ctx.fillRect(camX - 10, s - ROAD_HALF, VW + 20, ROAD_HALF * 2);
  ctx.strokeStyle = PALETTE.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  ctx.beginPath();
  for (const a of AVENUES) { ctx.moveTo(a, camY - 10); ctx.lineTo(a, camY + VH + 10); }
  for (const s of STREETS) { ctx.moveTo(camX - 10, s); ctx.lineTo(camX + VW + 10, s); }
  ctx.stroke();
  ctx.setLineDash([]);
  // Crosswalks at every crossing in view.
  ctx.fillStyle = PALETTE.crosswalk;
  for (const c of G.city.crossings) {
    if (!inView(c.x, c.y, 90, view)) continue;
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(c.x - ROAD_HALF - 12, c.y + i * 18 - 5, 10, 10);
      ctx.fillRect(c.x + ROAD_HALF + 2, c.y + i * 18 - 5, 10, 10);
      ctx.fillRect(c.x + i * 18 - 5, c.y - ROAD_HALF - 12, 10, 10);
      ctx.fillRect(c.x + i * 18 - 5, c.y + ROAD_HALF + 2, 10, 10);
    }
  }

  // Marina piers and boats.
  for (const pier of G.city.piers) {
    ctx.fillStyle = '#8a6a44';
    ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let x = pier.x + 12; x < pier.x + pier.w; x += 24) ctx.fillRect(x, pier.y, 3, pier.h);
  }
  for (const b of G.city.boats) drawBoat(ctx, b);

  // Buildings: soft shadow, pastel roof, a lighter cap, a sign.
  for (const b of G.city.buildings) {
    if (!inView(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h), view)) continue;
    ctx.fillStyle = 'rgba(20,30,20,0.25)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = b.tone;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = 'rgba(0,0,0,0.13)';
    ctx.fillRect(b.x + 12, b.y + 12, b.w - 24, b.h - 24);
    if (b.kind === 'police') badge(ctx, b.x + b.w / 2, b.y + b.h / 2, '#2e6fc3');
    if (b.kind === 'hospital') badge(ctx, b.x + b.w / 2, b.y + b.h / 2, '#c33f2e');
    if (b.sign) {
      ctx.fillStyle = 'rgba(30,26,20,0.75)';
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.sign, b.x + b.w / 2, b.y + b.h - 7);
    }
  }

  // Palms: a bent trunk and a star of fronds.
  for (const p of G.city.palms) {
    if (!inView(p.x, p.y, 40, view)) continue;
    ctx.strokeStyle = '#7a5c38';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 3, p.y - 6); ctx.stroke();
    ctx.strokeStyle = '#3f8f3a';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + p.x * 0.01;
      ctx.beginPath();
      ctx.moveTo(p.x + 3, p.y - 6);
      ctx.quadraticCurveTo(
        p.x + 3 + Math.cos(a) * 10 * p.s, p.y - 12 * p.s,
        p.x + 3 + Math.cos(a) * 16 * p.s, p.y - 3 * p.s);
      ctx.stroke();
    }
  }

  // Hidden packages glint.
  for (const pack of G.city.packages) {
    if (pack.taken || !inView(pack.x, pack.y, 40, view)) continue;
    const pulse = 1 + Math.sin(G.time * 4 + pack.id) * 0.18;
    ctx.fillStyle = 'rgba(255,205,60,0.30)';
    ctx.beginPath(); ctx.arc(pack.x, pack.y, 15 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b62a';
    ctx.fillRect(pack.x - 6, pack.y - 4, 12, 9);
    ctx.fillStyle = '#8a6a14';
    ctx.fillRect(pack.x - 6, pack.y - 1, 12, 2);
  }

  // Objective beacon: a column of light and a bobbing diamond.
  const marker = currentMarker(G);
  if (marker && G.mode === 'play') beacon(ctx, marker.x, marker.y, '#ffd23e', G.time);
  const taxi = G.taxi;
  if (taxi.phase === 'offer') beacon(ctx, taxi.x, taxi.y, '#39c2d7', G.time);
  if (taxi.phase === 'ride') beacon(ctx, taxi.destX, taxi.destY, '#39c2d7', G.time);

  // People, then cars, then the player on top of the street.
  for (const p of G.peds) if (inView(p.x, p.y, 30, view)) drawPed(ctx, p);
  for (const o of G.officers) if (inView(o.x, o.y, 30, view)) drawOfficer(ctx, o);
  for (const h of G.hostiles) if (inView(h.x, h.y, 30, view)) drawHostile(ctx, h);
  for (const car of G.cars) if (inView(car.x, car.y, 70, view)) drawCar(ctx, car, G.time);
  if (!G.player.car) drawPlayer(ctx, G);

  // Tracers and hit sparks.
  for (const t of G.tracers) {
    ctx.strokeStyle = t.hostile ? 'rgba(255,90,60,0.85)' : 'rgba(255,230,150,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
  }
  for (const e of G.effects) {
    ctx.strokeStyle = e.kind === 'hurt' ? 'rgba(220,40,30,0.8)' : 'rgba(255,200,80,0.8)';
    ctx.lineWidth = 2;
    const r = 8 + (0.3 - e.t) * 30;
    ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(3, r), 0, Math.PI * 2); ctx.stroke();
  }
  // Smoke from dying engines.
  for (const car of G.cars) {
    if (car.hp >= 45 || !inView(car.x, car.y, 60, view)) continue;
    const n = car.hp < 18 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const wob = Math.sin(G.time * 3 + car.id * 7 + i * 2.1) * 6;
      ctx.fillStyle = `rgba(40,40,40,${0.20 - i * 0.05})`;
      ctx.beginPath();
      ctx.arc(car.x + wob, car.y - 8 - i * 11 - (G.time * 9 + i * 13) % 12, 6 + i * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();

  // Golden light over everything, and a soft vignette.
  const warm = lightWarmth(G.clockMin);
  ctx.fillStyle = `rgba(255,166,66,${0.05 + warm * 0.06})`;
  ctx.fillRect(0, 0, VW, VH);
  const grad = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.55, VW / 2, VH / 2, VH * 1.02);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(10,16,26,0.28)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VW, VH);
}

function badge(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - 1.5, y - 6, 3, 12);
  ctx.fillRect(x - 6, y - 1.5, 12, 3);
}

function beacon(ctx, x, y, color, time) {
  const bob = Math.sin(time * 3.2) * 5;
  ctx.fillStyle = color + '2e';
  ctx.fillRect(x - 13, y - 190, 26, 190);
  ctx.fillStyle = color;
  ctx.save();
  ctx.translate(x, y - 34 + bob);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-8, -8, 16, 16);
  ctx.restore();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, 20 + Math.sin(time * 3.2) * 3, 0, Math.PI * 2); ctx.stroke();
}

function drawBoat(ctx, b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.a);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(2, 3, 24, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = b.tone;
  ctx.beginPath();
  ctx.moveTo(-22, 0); ctx.lineTo(-14, -7); ctx.lineTo(16, -7); ctx.lineTo(24, 0); ctx.lineTo(16, 7); ctx.lineTo(-14, 7);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f4f1e8';
  ctx.fillRect(-6, -4, 12, 8);
  ctx.restore();
}

export function drawCar(ctx, car, time) {
  const { len, wid } = car.spec;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.heading);
  ctx.fillStyle = 'rgba(15,20,15,0.30)';
  ctx.beginPath(); ctx.ellipse(2, 4, len / 2, wid / 2 + 2, 0, 0, Math.PI * 2); ctx.fill();
  // Wheels.
  ctx.fillStyle = '#15161a';
  const wy = wid / 2 - 1;
  for (const [wx, wyy] of [[len / 4, -wy], [len / 4, wy], [-len / 4, -wy], [-len / 4, wy]])
    ctx.fillRect(wx - 6, wyy - 3, 12, 6);
  // Body.
  ctx.fillStyle = car.dead ? '#3a3a3a' : car.paint;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 6);
  ctx.fill();
  if (car.police) {
    ctx.fillStyle = '#22406e';
    ctx.fillRect(-len / 2, -3, len, 6);
    // Lightbar: red and blue trade places twice a second.
    const phase = Math.floor(time * 4 + car.id) % 2;
    ctx.fillStyle = phase ? '#ff3b30' : '#2e6fc3';
    ctx.fillRect(-7, -wid / 2 + 2, 6, wid - 4);
    ctx.fillStyle = phase ? '#2e6fc3' : '#ff3b30';
    ctx.fillRect(1, -wid / 2 + 2, 6, wid - 4);
  }
  // Cabin and glass.
  ctx.fillStyle = 'rgba(18,26,34,0.88)';
  roundRect(ctx, -len * 0.16, -wid / 2 + 3.5, len * 0.34, wid - 7, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,200,225,0.5)';
  ctx.fillRect(len * 0.14, -wid / 2 + 4.5, 3.5, wid - 9);
  // Headlights.
  ctx.fillStyle = '#ffeeb0';
  ctx.fillRect(len / 2 - 2, -wid / 2 + 3, 2.5, 4);
  ctx.fillRect(len / 2 - 2, wid / 2 - 7, 2.5, 4);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFigure(ctx, x, y, heading, shirt, skin, opts = {}) {
  ctx.fillStyle = 'rgba(15,20,15,0.28)';
  ctx.beginPath(); ctx.ellipse(x + 1, y + 3, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
  if (opts.down) {
    ctx.fillStyle = shirt;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading);
    ctx.beginPath(); ctx.ellipse(0, 0, 11, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(12, 0, 4.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(x, y, 7.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(x + Math.cos(heading) * 2.5, y + Math.sin(heading) * 2.5, 4.3, 0, Math.PI * 2); ctx.fill();
  if (opts.cap) {
    ctx.fillStyle = opts.cap;
    ctx.beginPath(); ctx.arc(x + Math.cos(heading) * 2.5, y + Math.sin(heading) * 2.5, 4.5, Math.PI * 0.9, Math.PI * 1.9); ctx.fill();
  }
}

function drawPed(ctx, p) {
  drawFigure(ctx, p.x, p.y, p.heading, p.shirt, p.skin, { down: p.state === 'down' });
}

function drawOfficer(ctx, o) {
  drawFigure(ctx, o.x, o.y, o.heading, '#1d2f52', '#d9a066', { cap: '#12233f', down: o.dead });
}

function drawHostile(ctx, h) {
  drawFigure(ctx, h.x, h.y, h.heading, '#4a1f1f', '#a66a3f', { down: h.dead });
}

function drawPlayer(ctx, G) {
  const pl = G.player;
  // Aim line while the pistol is up.
  if (pl.firedT > 0 || (typeof window !== 'undefined' && G.wantAim)) {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pl.x, pl.y);
    ctx.lineTo(pl.x + Math.cos(pl.aim) * 44, pl.y + Math.sin(pl.aim) * 44);
    ctx.stroke();
  }
  drawFigure(ctx, pl.x, pl.y, pl.heading, pl.hurtT > 0 ? '#c33f2e' : '#0f7a72', '#f2c79b', { cap: '#f4f1e8' });
}
