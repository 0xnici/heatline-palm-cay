// The HUD and the minimap, drawn on the same canvas after the world: cash,
// respect, health, wanted stars, vehicle/weapon line, objective, clock and
// district up top; the map, mission marker and blips in the corner.
import { PALETTE, VIEW, FONT } from './config.js';
import { AVENUES, STREETS, BEACH_X, WATER_X } from './city.js';
import { wantedStars } from './police.js';
import { objectiveText, jobMarker } from './missions.js';
import { WORLD } from './config.js';

const MAP = { x: VIEW.width - 216, y: VIEW.height - 216, w: 196, h: 196 };
function clockText(minutes) {
  const m = Math.floor(minutes) % (24 * 60);
  const h = Math.floor(m / 60); const mm = m % 60;
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(mm).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
export function drawMinimap(ctx, state) {
  const { x, y, w, h } = MAP;
  const sx = w / WORLD.width; const sy = h / WORLD.height;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.clip();
  ctx.fillStyle = '#57a75a'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PALETTE.sand; ctx.fillRect(x + BEACH_X * sx, y, (WORLD.width - BEACH_X) * sx, h);
  ctx.fillStyle = PALETTE.water; ctx.fillRect(x + WATER_X * sx, y, (WORLD.width - WATER_X) * sx, h);
  ctx.strokeStyle = '#3d4148'; ctx.lineWidth = 3;
  for (const a of AVENUES) { ctx.beginPath(); ctx.moveTo(x + a * sx, y); ctx.lineTo(x + a * sx, y + h); ctx.stroke(); }
  for (const s of STREETS) { ctx.beginPath(); ctx.moveTo(x, y + s * sy); ctx.lineTo(x + w, y + s * sy); ctx.stroke(); }
  const blip = (wx, wy, color, r = 2.4) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x + wx * sx, y + wy * sy, r, 0, 6.29); ctx.fill(); };
  for (const c of state.cars) {
    if (Math.hypot(c.x - state.player.x, c.y - state.player.y) > 900) continue;
    if (c.kind === 'police') blip(c.x, c.y, Math.floor(state.elapsed * 4) % 2 ? '#3b82f6' : '#ef476f', 3);
    else if (c === state.player.car) { /* player arrow covers it */ }
    else blip(c.x, c.y, 'rgba(255,255,255,0.55)', 1.8);
  }
  const mk = jobMarker(state.missions);
  if (mk) blip(mk.x, mk.y, PALETTE.accent, 4.5);
  if (state.missions.taxi) {
    const t = state.missions.taxi;
    blip(t.phase === 'pickup' ? t.x : t.dx, t.phase === 'pickup' ? t.y : t.dy, '#06d6a0', 4);
  }
  for (const pk of state.city.packages) if (!pk.taken) blip(pk.x, pk.y, 'rgba(255,214,10,0.8)', 1.6);
  // player arrow
  const p = state.player;
  ctx.translate(x + p.x * sx, y + p.y * sy); ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.stroke();
  ctx.fillStyle = PALETTE.text; ctx.font = `11px ${FONT}`; ctx.textAlign = 'left';
  ctx.fillText(state.district.toUpperCase(), x + 2, y + h + 16);
}
export function drawHud(ctx, state) {
  const p = state.player;
  ctx.textBaseline = 'top';
  // top-left stack: cash / respect / clock / district
  ctx.font = `bold 26px ${FONT}`; ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(10,14,20,0.55)'; ctx.beginPath(); ctx.roundRect(14, 12, 252, 104, 10); ctx.fill();
  ctx.fillStyle = '#7bf1a8'; ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, 26, 20);
  ctx.font = `15px ${FONT}`; ctx.fillStyle = PALETTE.text;
  ctx.fillText(`Respect ${p.respect}   ·   ${clockText(state.clock)}`, 26, 54);
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(state.district, 26, 78);
  ctx.fillText(p.car ? `${p.car.model.name} · ${Math.round(Math.abs(p.car.speed) * 0.36)} km/h` : 'On foot · Cay Pistol', 26, 96 - 0);
  // health bar
  ctx.fillStyle = 'rgba(10,14,20,0.55)'; ctx.fillRect(24, 124, 204, 13);
  ctx.fillStyle = p.health > 30 ? PALETTE.good : PALETTE.danger;
  ctx.fillRect(26, 126, 200 * Math.max(0, p.health) / 100, 9);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.strokeRect(24, 124, 204, 13);
  // wanted stars top-right
  const stars = wantedStars(p.heat);
  ctx.font = `30px ${FONT}`; ctx.textAlign = 'right';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < stars ? PALETTE.star : 'rgba(255,255,255,0.22)';
    ctx.fillText('★', VIEW.width - 18 - (4 - i) * 30, 14);
  }
  if (p.bust > 0.1) {
    ctx.fillStyle = PALETTE.danger; ctx.font = `bold 17px ${FONT}`;
    ctx.fillText('BUST METER — RUN!', VIEW.width - 18, 52);
  }
  // objective bar, bottom centre
  ctx.font = `16px ${FONT}`; ctx.textAlign = 'center';
  const obj = objectiveText(state.missions);
  const wdt = Math.min(760, ctx.measureText(obj).width + 36);
  ctx.fillStyle = 'rgba(10,14,20,0.66)'; ctx.beginPath(); ctx.roundRect((VIEW.width - wdt) / 2, VIEW.height - 44, wdt, 30, 8); ctx.fill();
  ctx.fillStyle = '#ffe9a8'; ctx.fillText(obj, VIEW.width / 2, VIEW.height - 38);
  // banner + dialogue
  if (state.bannerTime > 0 && state.banner) {
    ctx.textAlign = 'center';
    ctx.font = `bold 40px ${FONT}`; ctx.fillStyle = PALETTE.accent;
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8;
    ctx.fillText(state.banner.text, VIEW.width / 2, 128);
    ctx.font = `19px ${FONT}`; ctx.fillStyle = PALETTE.text;
    ctx.fillText(state.banner.sub, VIEW.width / 2, 172);
    ctx.shadowBlur = 0;
  }
  if (state.dialogueTime > 0 && state.dialogue) {
    ctx.font = `17px ${FONT}`; ctx.textAlign = 'center';
    const w2 = Math.min(820, ctx.measureText(state.dialogue).width + 40);
    ctx.fillStyle = 'rgba(10,14,20,0.78)'; ctx.beginPath(); ctx.roundRect((VIEW.width - w2) / 2, 66, w2, 34, 8); ctx.fill();
    ctx.fillStyle = '#fff7e6'; ctx.fillText(state.dialogue, VIEW.width / 2, 74);
  }
  drawMinimap(ctx, state);
}
