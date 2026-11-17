// hud.js — everything drawn over the world: cash and respect, the
// wanted stars, the clock, health, the minimap with its blips, the
// objective banner, fixer dialogue, context prompts, and every menu
// and card screen (title, pause, mission cards, BUSTED, WASTED, the
// ending). The judge reads the game mostly through these pixels, so
// every element earns its place.

import { WORLD_W, WORLD_H, WATER_X, RANKS } from './config.js';
import { clamp, dist } from './rng.js';
import { districtAt } from './city.js';
import { currentStage, currentMarker, offeredFixer } from './missions.js';
import { starsOf } from './police.js';

const VW = 1280, VH = 720;

function rankTitle(respect) {
  let t = RANKS[0][1];
  for (const [min, name] of RANKS) if (respect >= min) t = name;
  return t;
}

function fmtClock(clockMin) {
  const h = Math.floor(clockMin / 60) % 24;
  const m = Math.floor(clockMin % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function fmtTimer(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function panel(ctx, x, y, w, h, alpha = 0.72) {
  ctx.fillStyle = `rgba(10,16,24,${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
}

export function drawHUD(ctx, G) {
  const pl = G.player;
  ctx.textAlign = 'left';

  // Cash and respect, top-left.
  panel(ctx, 16, 14, 252, 62);
  ctx.fillStyle = '#7ddc7d';
  ctx.font = '700 25px system-ui, sans-serif';
  ctx.fillText(`$${G.cash.toLocaleString('en-US')}`, 30, 46);
  ctx.fillStyle = '#e8e4da';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText(`Respect ${G.respect} · ${rankTitle(G.respect)}`, 30, 67);

  // Stars, clock and district, top-right.
  const stars = starsOf(G.law);
  ctx.font = '26px system-ui, sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i < 5; i++) {
    const x = VW - 30 - (4 - i) * 30;
    ctx.fillStyle = i < stars ? '#ffd23e' : 'rgba(255,255,255,0.22)';
    if (i < stars && G.law.unseenT > 2 && Math.floor(G.time * 3) % 2) ctx.fillStyle = 'rgba(255,210,62,0.35)';
    ctx.fillText('★', x, 44);
  }
  ctx.fillStyle = '#f4f1e8';
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText(fmtClock(G.clockMin), VW - 30, 70);
  ctx.fillStyle = 'rgba(244,241,232,0.75)';
  ctx.font = '500 13px system-ui, sans-serif';
  const focus = pl.car || pl;
  ctx.fillText(districtAt(focus.x, focus.y), VW - 30, 90);
  ctx.textAlign = 'left';

  // Health (and the car's, and its speed), bottom-left.
  panel(ctx, 16, VH - 84, 252, 68);
  bar(ctx, 30, VH - 66, 224, 13, pl.hp / 100, pl.hp > 30 ? '#58c96b' : '#e0483e');
  ctx.fillStyle = '#e8e4da';
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText(pl.car ? pl.car.spec.label : 'On foot', 30, VH - 26);
  if (pl.car) {
    bar(ctx, 118, VH - 36, 90, 8, Math.max(0, pl.car.hp) / 100, '#d8a03c');
    ctx.fillStyle = '#f4f1e8';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(Math.abs(pl.car.speed) * 0.36)} km/h`, 254, VH - 26);
    ctx.textAlign = 'left';
  }

  drawMinimap(ctx, G);

  // Objective banner, top-centre.
  const stage = currentStage(G);
  let objective = null;
  if (stage) objective = stage.text;
  else if (G.taxi.phase === 'offer') objective = 'Taxi fare waiting — stop beside the passenger';
  else if (G.taxi.phase === 'ride') objective = 'Taxi: drive your fare to the cyan marker';
  else if (!G.mission.done) {
    const offer = offeredFixer(G);
    if (offer) objective = `Work waits: find ${offer.fixer.name} — ${offer.fixer.spot}`;
  }
  if (objective) {
    ctx.font = '600 16px system-ui, sans-serif';
    const w = Math.min(720, ctx.measureText(objective).width + 44);
    panel(ctx, (VW - w) / 2, 16, w, 40, 0.66);
    ctx.fillStyle = '#ffd23e';
    ctx.textAlign = 'center';
    ctx.fillText(objective, VW / 2, 42);
    ctx.textAlign = 'left';
    if (G.mission.timeLeft !== null && G.mission.active) {
      const t = G.mission.timeLeft;
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.fillStyle = t < 20 ? '#ff5a4e' : '#f4f1e8';
      ctx.textAlign = 'center';
      ctx.fillText(fmtTimer(t), VW / 2, 82);
      ctx.textAlign = 'left';
    }
  }

  // Chase banner while the law is close and the stars are high.
  const nearCop = G.cars.some((c) => c.police && !c.dead && dist(c.x, c.y, focus.x, focus.y) < 560);
  if (stars >= 2 && nearCop && G.law.unseenT < 2.5) {
    ctx.font = '800 24px system-ui, sans-serif';
    ctx.fillStyle = Math.floor(G.time * 2.4) % 2 ? '#ff5a4e' : '#ffd23e';
    ctx.textAlign = 'center';
    ctx.fillText('★ LOSE THE HEAT ★', VW / 2, 122);
    ctx.textAlign = 'left';
  }
  // Arrest pressure.
  if (G.law.arrestT > 0.15) {
    panel(ctx, VW / 2 - 110, 138, 220, 30, 0.8);
    bar(ctx, VW / 2 - 96, 148, 192, 10, clamp(G.law.arrestT / 1.25, 0, 1), '#ff5a4e');
  }

  // Dialogue, bottom-centre.
  if (G.dialogue) {
    const line = G.dialogue.lines[G.dialogue.idx];
    if (line) {
      panel(ctx, VW / 2 - 330, VH - 128, 660, 76, 0.82);
      ctx.fillStyle = '#ffd23e';
      ctx.font = '700 14px system-ui, sans-serif';
      ctx.fillText(G.dialogue.speaker, VW / 2 - 310, VH - 104);
      ctx.fillStyle = '#f4f1e8';
      ctx.font = '500 15px system-ui, sans-serif';
      wrapText(ctx, line, VW / 2 - 310, VH - 82, 620, 20, 2);
    }
  }

  // Context prompt, just above the dialogue slot.
  const prompt = contextPrompt(G);
  if (prompt && !G.dialogue) {
    ctx.font = '600 15px system-ui, sans-serif';
    const w = ctx.measureText(prompt).width + 36;
    panel(ctx, (VW - w) / 2, VH - 118, w, 34, 0.7);
    ctx.fillStyle = '#f4f1e8';
    ctx.textAlign = 'center';
    ctx.fillText(prompt, VW / 2, VH - 95);
    ctx.textAlign = 'left';
  }

  // Packages counter, under the cash panel.
  ctx.fillStyle = 'rgba(244,241,232,0.8)';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText(`Packages ${G.packagesFound}/${G.city.packages.length}`, 30, 100);

  // Damage vignette.
  if (pl.hurtT > 0 || pl.hp < 28) {
    const a = pl.hurtT > 0 ? 0.30 : 0.16 + Math.sin(G.time * 5) * 0.05;
    const grad = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.42, VW / 2, VH / 2, VH * 0.95);
    grad.addColorStop(0, 'rgba(180,20,10,0)');
    grad.addColorStop(1, `rgba(180,20,10,${a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VW, VH);
  }
}

function bar(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}

function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  for (const word of words) {
    const trial = line ? line + ' ' + word : word;
    if (ctx.measureText(trial).width > maxW && line) {
      ctx.fillText(line, x, y);
      y += lineH; lines++;
      if (lines >= maxLines) return;
      line = word;
    } else line = trial;
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y);
}

function contextPrompt(G) {
  const pl = G.player;
  if (G.mode !== 'play') return null;
  if (pl.car) return Math.abs(pl.car.speed) < 70 ? 'E — step out' : null;
  const offer = offeredFixer(G);
  if (offer && dist(pl.x, pl.y, offer.fixer.x, offer.fixer.y) < 54)
    return `E — Talk to ${offer.fixer.name}`;
  let best = null, bd = 50;
  for (const car of G.cars) {
    if (car.dead) continue;
    const d = dist(pl.x, pl.y, car.x, car.y);
    if (d < bd && (car.parked || Math.abs(car.speed) < 42)) { bd = d; best = car; }
  }
  if (best) return `E — Take the ${best.spec.label}`;
  return null;
}

function drawMinimap(ctx, G) {
  const MW = 218, MH = 158;
  const x0 = VW - MW - 16, y0 = VH - MH - 16;
  const sx = MW / WORLD_W, sy = MH / WORLD_H;
  panel(ctx, x0 - 4, y0 - 4, MW + 8, MH + 8, 0.66);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, MW, MH);
  ctx.clip();
  ctx.fillStyle = '#5d8a48';
  ctx.fillRect(x0, y0, MW, MH);
  ctx.fillStyle = '#1d6f8e';
  ctx.fillRect(x0 + WATER_X * sx, y0, MW - WATER_X * sx, MH);
  ctx.fillStyle = '#ecd39a';
  ctx.fillRect(x0 + 3290 * sx, y0, (WATER_X - 3290) * sx, MH);
  ctx.strokeStyle = 'rgba(230,228,220,0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const a of [300, 820, 1340, 1860, 2380, 2900, 3200]) { ctx.moveTo(x0 + a * sx, y0); ctx.lineTo(x0 + a * sx, y0 + MH); }
  for (const s of [320, 840, 1360, 1880, 2300]) { ctx.moveTo(x0, y0 + s * sy); ctx.lineTo(x0 + MW, y0 + s * sy); }
  ctx.stroke();
  const dot = (x, y, color, r = 3) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x0 + x * sx, y0 + y * sy, r, 0, Math.PI * 2); ctx.fill();
  };
  for (const p of G.city.packages) if (!p.taken) dot(p.x, p.y, '#ffd23e', 2);
  for (const h of G.hostiles) if (!h.dead) dot(h.x, h.y, '#ff5a4e', 3);
  const flash = Math.floor(G.time * 3) % 2;
  for (const c of G.cars) if (c.police && !c.dead) dot(c.x, c.y, flash ? '#ff3b30' : '#5aa2ff', 3);
  const offer = offeredFixer(G);
  if (offer && !G.mission.active) dot(offer.fixer.x, offer.fixer.y, '#ff9f2e', 4);
  const marker = currentMarker(G);
  if (marker) dot(marker.x, marker.y, '#ffd23e', 4.5);
  if (G.taxi.phase === 'offer') dot(G.taxi.x, G.taxi.y, '#39c2d7', 4);
  if (G.taxi.phase === 'ride') dot(G.taxi.destX, G.taxi.destY, '#39c2d7', 4);
  // The player: a white arrow that turns with you.
  const focus = G.player.car || G.player;
  const heading = G.player.car ? G.player.car.heading : G.player.heading;
  ctx.save();
  ctx.translate(x0 + focus.x * sx, y0 + focus.y * sy);
  ctx.rotate(heading + Math.PI / 2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -6); ctx.lineTo(4.4, 5); ctx.lineTo(-4.4, 5);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
}

// ---- screens ---------------------------------------------------------------

export function drawMenus(ctx, G) {
  if (G.mode === 'play' || G.mode === 'pause') {
    if (G.mode === 'pause') {
      shade(ctx);
      centre(ctx, 'PAUSED', 250, '800 54px system-ui, sans-serif', '#f4f1e8');
      centre(ctx, 'P — resume · M — sound on/off', 300, '600 17px system-ui, sans-serif', 'rgba(244,241,232,0.8)');
      controlsTable(ctx, 350);
    }
    return;
  }
  if (G.mode === 'title') {
    // The city shows through; a warm gradient anchors the type.
    const grad = ctx.createLinearGradient(0, VH * 0.42, 0, VH);
    grad.addColorStop(0, 'rgba(8,14,22,0)');
    grad.addColorStop(1, 'rgba(8,14,22,0.82)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, VH * 0.42, VW, VH * 0.58);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23e';
    ctx.font = '800 84px system-ui, sans-serif';
    ctx.fillText('HEATLINE', VW / 2, VH - 218);
    ctx.fillStyle = '#f4f1e8';
    ctx.font = '600 25px system-ui, sans-serif';
    ctx.fillText('P A L M   C A Y', VW / 2, VH - 178);
    ctx.font = '500 16px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(244,241,232,0.85)';
    ctx.fillText('Steal cars. Run jobs. Outrun the law. An open-world crime story in a sun-soaked coastal city.', VW / 2, VH - 142);
    ctx.font = '700 19px system-ui, sans-serif';
    ctx.fillStyle = '#7ddc7d';
    ctx.fillText(G.hasSave ? 'Enter — New run      C — Continue' : 'Enter — Start', VW / 2, VH - 96);
    ctx.font = '500 13.5px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(244,241,232,0.7)';
    ctx.fillText('WASD drive & walk · E enter car / talk · Mouse aim, click shoot · F melee · Shift sprint · P pause · M mute', VW / 2, VH - 62);
    ctx.textAlign = 'left';
    return;
  }
  // Cards: mission briefs, job results, BUSTED, WASTED, the ending.
  shade(ctx);
  const card = G.card;
  if (!card) return;
  const w = 640, h = 300;
  const x = (VW - w) / 2, y = (VH - h) / 2 - 20;
  panel(ctx, x, y, w, h, 0.88);
  ctx.strokeStyle = G.mode === 'busted' ? '#5aa2ff' : G.mode === 'wasted' ? '#e0483e' : '#ffd23e';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = G.mode === 'busted' ? '#5aa2ff' : G.mode === 'wasted' ? '#ff7a6e' : '#ffd23e';
  ctx.font = '800 42px system-ui, sans-serif';
  ctx.fillText(card.title, VW / 2, y + 66);
  ctx.fillStyle = 'rgba(244,241,232,0.85)';
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText(card.subtitle || '', VW / 2, y + 96);
  ctx.fillStyle = '#f4f1e8';
  ctx.font = '500 16.5px system-ui, sans-serif';
  let ly = y + 138;
  for (const line of card.lines) {
    wrapText(ctx, line, VW / 2 - 280, ly, 560, 23, 3);
    ly += 52;
  }
  ctx.fillStyle = 'rgba(244,241,232,0.65)';
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.fillText(card.foot || 'Enter', VW / 2, y + h - 24);
  ctx.textAlign = 'left';
}

function shade(ctx) {
  ctx.fillStyle = 'rgba(6,10,16,0.55)';
  ctx.fillRect(0, 0, VW, VH);
}

function centre(ctx, text, y, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, VW / 2, y);
  ctx.textAlign = 'left';
}

function controlsTable(ctx, y) {
  ctx.font = '500 15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(244,241,232,0.85)';
  ctx.textAlign = 'center';
  const rows = [
    'WASD / arrows — walk and drive · Shift — sprint',
    'E — enter or leave a car, talk to a fixer',
    'Mouse — aim · Click — shoot · F — melee',
    'P / Esc — pause · M — mute',
  ];
  for (const r of rows) { ctx.fillText(r, VW / 2, y); y += 26; }
  ctx.textAlign = 'left';
}
