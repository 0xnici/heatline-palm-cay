// Drawing: the living city from the camera's view — ground, beach and water,
// roads with lane paint, buildings with lit windows, palms, props, cars with
// headlights at dusk, people, bullets and sparks — then the screens that sit
// over it (title, pause, cards, busted, wasted, ending). HUD lives in hud.js.
import { PALETTE, VIEW, WORLD, FONT } from './config.js';
import { AVENUES, STREETS, ROAD_HALF, BEACH_X, WATER_X } from './city.js';
import { drawHud } from './hud.js';
import { wantedStars } from './police.js';

export const SCREEN_TITLE = 'title'; export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused'; export const SCREEN_CARD = 'card';
export const SCREEN_BUSTED = 'busted'; export const SCREEN_WASTED = 'wasted';

function skyTint(clock) {
  const h = (clock / 60) % 24;
  if (h > 6.5 && h < 16.5) return null; // full day
  if (h >= 16.5 && h < 19.5) return 'rgba(255,120,60,0.13)'; // golden hour
  if (h >= 19.5 || h < 5) return 'rgba(10,16,60,0.42)'; // night
  return 'rgba(255,170,90,0.14)'; // dawn
}
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  function resize() {
    const r = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * r); canvas.height = Math.round(window.innerHeight * r);
  }
  window.addEventListener('resize', resize); resize();

  function drawGround(state, cam) {
    const x0 = cam.x - VIEW.width / 2; const y0 = cam.y - VIEW.height / 2;
    ctx.fillStyle = PALETTE.grass; ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // parks
    for (const pr of state.city.props) if (pr.kind === 'park') { ctx.fillStyle = PALETTE.park; ctx.fillRect(pr.x - x0, pr.y - y0, pr.w, pr.h); }
    // beach + water
    ctx.fillStyle = PALETTE.sand; ctx.fillRect(BEACH_X - x0, 0, WATER_X - BEACH_X, VIEW.height);
    const grad = ctx.createLinearGradient(WATER_X - x0, 0, WORLD.width - x0, 0);
    grad.addColorStop(0, PALETTE.water); grad.addColorStop(1, PALETTE.waterDeep);
    ctx.fillStyle = grad; ctx.fillRect(WATER_X - x0, 0, WORLD.width - WATER_X, VIEW.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    for (let i = 0; i < 9; i += 1) {
      const wy = ((i * 290 + state.elapsed * 22) % (WORLD.height + 200)) - 100;
      ctx.beginPath(); ctx.moveTo(WATER_X - x0 + 14, wy - y0); ctx.lineTo(WATER_X - x0 + 60, wy - y0); ctx.stroke();
    }
    // sidewalks then roads
    ctx.fillStyle = PALETTE.sidewalk;
    for (const a of AVENUES) ctx.fillRect(a - ROAD_HALF - 22 - x0, 0, (ROAD_HALF + 22) * 2, VIEW.height);
    for (const s of STREETS) ctx.fillRect(0, s - ROAD_HALF - 22 - y0, VIEW.width, (ROAD_HALF + 22) * 2);
    ctx.fillStyle = PALETTE.road;
    for (const a of AVENUES) ctx.fillRect(a - ROAD_HALF - x0, 0, ROAD_HALF * 2, VIEW.height);
    for (const s of STREETS) ctx.fillRect(0, s - ROAD_HALF - y0, VIEW.width, ROAD_HALF * 2);
    // lane dashes
    ctx.strokeStyle = PALETTE.lane; ctx.lineWidth = 3; ctx.setLineDash([26, 22]); ctx.globalAlpha = 0.65;
    for (const a of AVENUES) { ctx.beginPath(); ctx.moveTo(a - x0, 0); ctx.lineTo(a - x0, VIEW.height); ctx.stroke(); }
    for (const s of STREETS) { ctx.beginPath(); ctx.moveTo(0, s - y0); ctx.lineTo(VIEW.width, s - y0); ctx.stroke(); }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    // crosswalks at crossings
    ctx.fillStyle = 'rgba(240,240,230,0.5)';
    for (const a of AVENUES) for (const s of STREETS) {
      if (Math.abs(a - cam.x) > 800 || Math.abs(s - cam.y) > 600) continue;
      for (let i = -2; i <= 2; i += 1) ctx.fillRect(a - ROAD_HALF - x0, s + i * 18 - 5 - y0, 14, 10);
    }
  }
  function drawBuilding(b, x0, y0) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(b.x - x0 + 6, b.y - y0 + 8, b.w, b.h);
    ctx.fillStyle = b.color; ctx.fillRect(b.x - x0, b.y - y0, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(b.x - x0, b.y - y0, b.w, 7);
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 3; ctx.strokeRect(b.x - x0 + 5, b.y - y0 + 5, b.w - 10, b.h - 10);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(b.x - x0 + b.w * 0.18, b.y - y0 + b.h * 0.16, 22, 16);
    ctx.fillRect(b.x - x0 + b.w * 0.68, b.y - y0 + b.h * 0.62, 26, 18);
    ctx.fillStyle = 'rgba(0,0,0,0.20)'; ctx.fillRect(b.x - x0, b.y - y0 + b.h - 9, b.w, 9);
    // window grid
    ctx.fillStyle = 'rgba(255,236,170,0.75)';
    const cols = Math.floor(b.w / 26); const rows = Math.floor(b.h / 24);
    for (let i = 0; i < cols; i += 1) for (let j = 0; j < rows; j += 1) {
      if ((i * 7 + j * 13 + b.floors) % 3 === 0) continue;
      ctx.fillRect(b.x - x0 + 9 + i * 26, b.y - y0 + 9 + j * 24, 11, 9);
    }
    if (b.name) {
      ctx.font = `bold 13px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff7e6';
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 4;
      ctx.fillText(b.name.toUpperCase(), b.x - x0 + b.w / 2, b.y - y0 + b.h + 17);
      ctx.shadowBlur = 0;
    }
  }
  function drawPalm(p, x0, y0, t) {
    const x = p.x - x0; const y = p.y - y0;
    ctx.strokeStyle = PALETTE.trunk; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 5, y - 12); ctx.stroke();
    ctx.strokeStyle = PALETTE.palm; ctx.lineWidth = 4;
    const sway = Math.sin(t * 1.3 + p.x) * 2;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + sway * 0.05;
      ctx.beginPath(); ctx.moveTo(x + 5, y - 12);
      ctx.quadraticCurveTo(x + 5 + Math.cos(a) * 15, y - 12 + Math.sin(a) * 10 - 4, x + 5 + Math.cos(a) * 24 * p.s, y - 12 + Math.sin(a) * 15 * p.s + 7);
      ctx.stroke();
    }
  }
  function drawProp(pr, x0, y0) {
    const x = pr.x - x0; const y = pr.y - y0;
    if (pr.kind === 'boat') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(pr.angle);
      ctx.fillStyle = pr.color; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(14, -8); ctx.lineTo(22, 0); ctx.lineTo(14, 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f7f3e3'; ctx.fillRect(-4, -3, 10, 6); ctx.restore();
    } else if (pr.kind === 'umbrella') {
      ctx.fillStyle = pr.color; ctx.beginPath(); ctx.arc(x, y, 15, 0, 6.29); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 6.29); ctx.fill();
    } else if (pr.kind === 'crate') {
      ctx.fillStyle = '#a67c52'; ctx.fillRect(x - 9, y - 9, 18, 18);
      ctx.strokeStyle = '#7d5a38'; ctx.strokeRect(x - 9, y - 9, 18, 18);
    } else if (pr.kind === 'lifeguard') {
      ctx.fillStyle = pr.color; ctx.fillRect(x - 14, y - 14, 28, 28);
      ctx.fillStyle = PALETTE.danger; ctx.fillRect(x - 14, y - 4, 28, 7);
    }
  }
  function drawCar(c, x0, y0, t) {
    const x = c.x - x0; const y = c.y - y0; const m = c.model;
    ctx.save(); ctx.translate(x, y); ctx.rotate(c.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-m.len / 2 + 3, -m.wid / 2 + 4, m.len, m.wid);
    ctx.fillStyle = c.dead ? '#3a3a3a' : c.color;
    ctx.beginPath(); ctx.roundRect(-m.len / 2, -m.wid / 2, m.len, m.wid, 6); ctx.fill();
    ctx.fillStyle = 'rgba(20,26,36,0.9)';
    ctx.beginPath(); ctx.roundRect(-m.len * 0.16, -m.wid / 2 + 3, m.len * 0.34, m.wid - 6, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(m.len * 0.2, -m.wid / 2 + 3, 4, m.wid - 6);
    ctx.fillStyle = '#20242a';
    for (const [wx, wy] of [[-m.len / 2 + 8, -m.wid / 2 - 2], [m.len / 2 - 8, -m.wid / 2 - 2], [-m.len / 2 + 8, m.wid / 2 - 3], [m.len / 2 - 8, m.wid / 2 - 3]]) ctx.fillRect(wx - 4, wy, 9, 5);
    ctx.fillStyle = '#ffe9a8'; ctx.fillRect(m.len / 2 - 3, -m.wid / 2 + 3, 3, 5); ctx.fillRect(m.len / 2 - 3, m.wid / 2 - 8, 3, 5);
    ctx.fillStyle = '#ff5964'; ctx.fillRect(-m.len / 2, -m.wid / 2 + 3, 3, 5); ctx.fillRect(-m.len / 2, m.wid / 2 - 8, 3, 5);
    if (c.kind === 'police') {
      ctx.fillStyle = '#274690'; ctx.fillRect(-m.len * 0.3, -m.wid / 2, m.len * 0.24, m.wid);
      const flash = Math.floor(t * 6) % 2 === 0;
      ctx.fillStyle = flash ? '#ff3b30' : '#3b82f6'; ctx.fillRect(-6, -5, 12, 10);
      ctx.fillStyle = '#10151d'; ctx.font = `bold 9px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('PCPD', 0, 3 + 6);
    }
    if (c.isTruck) { ctx.fillStyle = '#bfe9ec'; ctx.fillRect(-m.len / 2 + 4, -m.wid / 2 + 3, m.len * 0.5, m.wid - 6); }
    ctx.restore();
    if (c.health < 45 && !c.dead) { // smoke from a hurt engine
      ctx.fillStyle = `rgba(60,60,60,${0.25 + 0.15 * Math.sin(t * 9 + c.id)})`;
      ctx.beginPath(); ctx.arc(x + Math.cos(c.angle) * 22, y + Math.sin(c.angle) * 22 - 6, 6 + Math.sin(t * 7) * 2, 0, 6.29); ctx.fill();
    }
  }
  function drawPerson(p, x0, y0, t, isPlayer) {
    const x = p.x - x0; const y = p.y - y0;
    const bob = p.speed || isPlayer ? Math.sin((p.walkPhase || t * 8)) * 1.6 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y + 8, 9, 4, 0, 0, 6.29); ctx.fill();
    if (p.dead) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(1.4);
      ctx.fillStyle = p.shirt; ctx.fillRect(-11, -4, 22, 8);
      ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(14, 0, 5.5, 0, 6.29); ctx.fill(); ctx.restore();
      return;
    }
    ctx.strokeStyle = '#2b2f36'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x + Math.cos(p.angle + 2.4) * 8, y + 8 + bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x + Math.cos(p.angle - 2.4) * 8, y + 8 - bob); ctx.stroke();
    ctx.fillStyle = p.shirt; ctx.beginPath(); ctx.arc(x, y, 10.5, 0, 6.29); ctx.fill();
    ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(x + Math.cos(p.angle) * 2.5, y + Math.sin(p.angle) * 2.5, 6.4, 0, 6.29); ctx.fill();
    if (p.officer) { ctx.fillStyle = '#10151d'; ctx.beginPath(); ctx.arc(x, y, 5.6, 3.4, 6.0); ctx.fill(); }
    if (isPlayer) {
      ctx.strokeStyle = '#ffd60a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 13 + Math.sin(t * 4) * 1.2, 0, 6.29); ctx.stroke();
      if (p.punchTimer > 0) { ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(x + Math.cos(p.aimAngle) * 17, y + Math.sin(p.aimAngle) * 17, 4, 0, 6.29); ctx.fill(); }
      // gun toward aim
      ctx.strokeStyle = '#14181f'; ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(p.aimAngle) * 16, y + Math.sin(p.aimAngle) * 16); ctx.stroke();
    }
  }
  function drawWorld(state) {
    const cam = state.camera;
    const shakeX = state.shake ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake ? (Math.random() - 0.5) * state.shake : 0;
    const x0 = cam.x - VIEW.width / 2 + shakeX; const y0 = cam.y - VIEW.height / 2 + shakeY;
    drawGround(state, { x: cam.x + shakeX, y: cam.y + shakeY });
    for (const pr of state.city.props) if (pr.kind !== 'park') drawProp(pr, x0, y0);
    for (const b of state.city.buildings) if (b.x + b.w > x0 - 60 && b.x < x0 + VIEW.width + 60 && b.y + b.h > y0 - 60 && b.y < y0 + VIEW.height + 60) drawBuilding(b, x0, y0);
    // mission + taxi + package markers
    const pulse = 1 + Math.sin(state.elapsed * 5) * 0.18;
    const marker = (wx, wy, color, glyph) => {
      const x = wx - x0; const y = wy - y0;
      if (x < -40 || y < -40 || x > VIEW.width + 40 || y > VIEW.height + 40) return;
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 17 * pulse, 0, 6.29); ctx.globalAlpha = 0.28; ctx.fill(); ctx.globalAlpha = 1;
      ctx.font = `bold 20px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = color;
      ctx.fillText(glyph, x, y - 34 - Math.sin(state.elapsed * 5) * 4);
      ctx.beginPath(); ctx.arc(x, y, 5, 0, 6.29); ctx.fill();
    };
    // (marker positions come from missions via state through hud import cycle guard)
    if (state.markerPos) marker(state.markerPos.x, state.markerPos.y, PALETTE.accent, '◆');
    if (state.missions.taxi) {
      const t = state.missions.taxi;
      marker(t.phase === 'pickup' ? t.x : t.dx, t.phase === 'pickup' ? t.y : t.dy, '#06d6a0', 'T');
    }
    for (const pk of state.city.packages) {
      if (pk.taken) continue;
      const x = pk.x - x0; const y = pk.y - y0;
      if (x < 0 || y < 0 || x > VIEW.width || y > VIEW.height) continue;
      ctx.fillStyle = `rgba(255,214,10,${0.55 + 0.4 * Math.sin(state.elapsed * 6 + pk.x)})`;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-6, -6, 12, 12); ctx.restore();
    }
    for (const palm of state.city.palms) if (Math.abs(palm.x - cam.x) < 760 && Math.abs(palm.y - cam.y) < 540) drawPalm(palm, x0, y0, state.elapsed);
    for (const c of state.cars) if (Math.abs(c.x - cam.x) < 760 && Math.abs(c.y - cam.y) < 540) drawCar(c, x0, y0, state.elapsed);
    for (const p of state.peds) if (Math.abs(p.x - cam.x) < 720 && Math.abs(p.y - cam.y) < 500) drawPerson(p, x0, y0, state.elapsed, false);
    for (const t of state.thugs) drawPerson(t, x0, y0, state.elapsed, false);
    for (const o of state.officers) drawPerson({ ...o, officer: true }, x0, y0, state.elapsed, false);
    if (!state.player.car) drawPerson(state.player, x0, y0, state.elapsed, true);
    // bullets + particles
    ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 2.4;
    for (const b of state.combat.bullets) {
      ctx.beginPath(); ctx.moveTo(b.x - x0 - b.vx * 0.016, b.y - y0 - b.vy * 0.016); ctx.lineTo(b.x - x0, b.y - y0); ctx.stroke();
    }
    for (const pt of state.combat.particles) {
      ctx.fillStyle = pt.color; ctx.globalAlpha = Math.max(0, pt.life * 2.4);
      ctx.fillRect(pt.x - x0 - pt.size / 2, pt.y - y0 - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
    const tint = skyTint(state.clock);
    if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, VIEW.width, VIEW.height); }
    // wanted vignette
    const stars = wantedStars(state.player.heat);
    if (stars >= 3) {
      const flash = 0.05 + 0.03 * Math.sin(state.elapsed * 6);
      ctx.fillStyle = Math.floor(state.elapsed * 2) % 2 ? `rgba(239,71,111,${flash})` : `rgba(59,130,246,${flash})`;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
  }
  function panel(title, lines, prompt, accent = PALETTE.accent) {
    ctx.fillStyle = 'rgba(8,12,20,0.72)'; ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = PALETTE.panel; ctx.beginPath(); ctx.roundRect(340, 150, 600, 400, 16); ctx.fill();
    ctx.strokeStyle = accent; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(340, 150, 600, 400, 16); ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = accent; ctx.font = `bold 44px ${FONT}`;
    ctx.fillText(title, VIEW.width / 2, 236);
    ctx.font = `19px ${FONT}`; ctx.fillStyle = PALETTE.text;
    lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 300 + i * 34));
    ctx.font = `bold 20px ${FONT}`; ctx.fillStyle = '#ffe9a8';
    ctx.fillText(prompt, VIEW.width / 2, 508);
  }
  function drawTitle(state, hasSave) {
    drawWorld(state);
    const g = ctx.createLinearGradient(0, 60, 0, 420);
    g.addColorStop(0, 'rgba(20,10,40,0.62)'); g.addColorStop(1, 'rgba(20,10,40,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW.width, 430);
    ctx.textAlign = 'center';
    ctx.font = `bold 104px ${FONT}`; ctx.fillStyle = '#ffb703';
    ctx.shadowColor = '#ef476f'; ctx.shadowBlur = 26;
    ctx.fillText('HEATLINE', VIEW.width / 2, 168);
    ctx.shadowBlur = 0;
    ctx.font = `bold 44px ${FONT}`; ctx.fillStyle = '#fff7e6';
    ctx.fillText('— PALM CAY —', VIEW.width / 2, 232);
    ctx.font = `21px ${FONT}`; ctx.fillStyle = '#ffe9a8';
    ctx.fillText('An open-world crime story in a sun-soaked coastal city', VIEW.width / 2, 282);
    ctx.font = `19px ${FONT}`; ctx.fillStyle = PALETTE.text;
    ctx.fillText(hasSave ? 'ENTER — Continue      N — New game' : 'Press ENTER to start', VIEW.width / 2, 640);
    ctx.font = `15px ${FONT}`; ctx.fillStyle = PALETTE.muted;
    ctx.fillText('WASD walk · Shift sprint · E enter car · Mouse aim, click shoot · F melee · P pause · M mute', VIEW.width / 2, 672);
  }
  function draw(state, screen, extra) {
    const r = window.devicePixelRatio || 1;
    ctx.setTransform(r * (canvas.width / r) / VIEW.width * (VIEW.width / (canvas.width / r)), 0, 0, 1, 0, 0);
    // Fit 1280x720 into the canvas exactly (canvas is sized to the window).
    ctx.setTransform(canvas.width / VIEW.width, 0, 0, canvas.height / VIEW.height, 0, 0);
    if (screen === SCREEN_TITLE) { drawTitle(state, extra?.hasSave); return; }
    drawWorld(state);
    drawHud(ctx, state);
    if (screen === SCREEN_PAUSED) panel('PAUSED', ['The Cay waits for no one — except now.', `Cash $${state.player.cash} · Respect ${state.player.respect}`, `Jobs done: ${state.missions.jobIndex} of 5 · Packages ${state.missions.packagesFound}/12`], 'P or ESC — resume');
    else if (screen === SCREEN_CARD && extra?.card) panel(extra.card.title.toUpperCase(), extra.card.lines, 'ENTER — continue', extra.card.kind === 'done' || extra.card.kind === 'ending' ? PALETTE.good : PALETTE.accent);
    else if (screen === SCREEN_BUSTED) panel('BUSTED', ['The PCPD got cuffs on you.', 'Fine paid: $200 · Heat cleared · Jobs reset'], 'ENTER — back on the street', PALETTE.danger);
    else if (screen === SCREEN_WASTED) panel('WASTED', ['Palm Cay General patched you up.', 'Bill paid: $120 · Heat cleared · Jobs reset'], 'ENTER — discharge yourself', PALETTE.danger);
  }
  return { draw };
}
