// combat.js — gunfire and fists. The player's pistol is a hitscan with
// spread, stopped by buildings; officers and mission crews shoot back
// with honest inaccuracy. Every shot is loud: it scares the street and,
// if anyone with eyes is near, it is witnessed.

import { PISTOL_RANGE, PISTOL_DAMAGE, PISTOL_SPREAD, MELEE_RANGE, MELEE_DAMAGE } from './config.js';
import { clamp, dist } from './rng.js';
import { losBlocked, pointInRect } from './city.js';
import { scarePeds, knockDown } from './people.js';
import { sfx } from './audio.js';

// Distance from muzzle to the first building along the ray, so tracers
// stop at walls instead of passing through them.
function wallDistance(city, x, y, angle) {
  const step = 18;
  let d = step;
  while (d < PISTOL_RANGE) {
    const px = x + Math.cos(angle) * d;
    const py = y + Math.sin(angle) * d;
    for (const b of city.buildings) if (pointInRect(px, py, b)) return d;
    d += step;
  }
  return PISTOL_RANGE;
}

function rayHit(G, x, y, angle, targets) {
  // Nearest target close enough to the ray, with a clear line.
  let best = null, bestD = Infinity;
  const wall = wallDistance(G.city, x, y, angle);
  for (const t of targets) {
    if (t.dead || t.hp <= 0) continue;
    const dx = t.x - x, dy = t.y - y;
    const along = dx * Math.cos(angle) + dy * Math.sin(angle);
    if (along < 8 || along > Math.min(PISTOL_RANGE, wall)) continue;
    const side = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
    if (side > 13) continue;
    if (losBlocked(G.city, x, y, t.x, t.y)) continue;
    if (along < bestD) { bestD = along; best = t; }
  }
  return { target: best, at: best ? bestD : wall };
}

function allTargets(G) {
  const list = [];
  for (const o of G.officers) list.push(o);
  for (const h of G.hostiles) list.push(h);
  for (const p of G.peds) if (p.state !== 'down') list.push(p);
  return list;
}

// The player fires. Returns true if a shot actually left the barrel.
export function playerShoot(G, rng) {
  const pl = G.player;
  if (pl.car || pl.shootCd > 0 || G.mode !== 'play') return false;
  pl.shootCd = 0.17;
  pl.firedT = 3;
  const angle = pl.aim + rng.range(-PISTOL_SPREAD, PISTOL_SPREAD);
  const { target, at } = rayHit(G, pl.x, pl.y, angle, allTargets(G));
  const ex = pl.x + Math.cos(angle) * at;
  const ey = pl.y + Math.sin(angle) * at;
  G.tracers.push({ x1: pl.x, y1: pl.y, x2: ex, y2: ey, t: 0.09, hostile: false });
  sfx('shot');
  scarePeds(G, pl.x, pl.y, 300);
  G.loudEvent = { x: pl.x, y: pl.y, t: 0.5 };
  if (target) {
    target.hp -= PISTOL_DAMAGE;
    G.effects.push({ kind: 'hit', x: target.x, y: target.y, t: 0.25 });
    if (target.kind === 'ped') { knockDown(target, 1); }
    if (target.hp <= 0 && target.kind !== 'ped') target.dead = true;
    sfx('hit');
  }
  return true;
}

export function playerMelee(G) {
  const pl = G.player;
  if (pl.car || pl.meleeCd > 0 || G.mode !== 'play') return;
  pl.meleeCd = 0.42;
  sfx('melee');
  for (const t of allTargets(G)) {
    if (dist(pl.x, pl.y, t.x, t.y) < MELEE_RANGE) {
      t.hp -= MELEE_DAMAGE;
      if (t.kind === 'ped') knockDown(t, 0.9);
      else if (t.hp <= 0) t.dead = true;
      G.effects.push({ kind: 'hit', x: t.x, y: t.y, t: 0.25 });
      scarePeds(G, pl.x, pl.y, 200);
      G.loudEvent = { x: pl.x, y: pl.y, t: 0.5 };
      return;
    }
  }
}

// One hostile (officer or crew) takes a shot at the player.
function hostileShoot(G, h, rng) {
  const pl = G.player;
  const target = pl.car || pl;
  const d = dist(h.x, h.y, target.x, target.y);
  const spread = 0.05 + d / 2600;
  const angle = Math.atan2(target.y - h.y, target.x - h.x) + rng.range(-spread, spread);
  const reach = Math.min(d + rng.range(-14, 30), PISTOL_RANGE);
  G.tracers.push({
    x1: h.x, y1: h.y,
    x2: h.x + Math.cos(angle) * reach, y2: h.y + Math.sin(angle) * reach,
    t: 0.09, hostile: true,
  });
  sfx(d < 300 ? 'shot' : 'shotFar');
  // Hit chance falls with range; cover (a building between) negates it.
  const chance = clamp(0.62 - d / 640, 0.08, 0.6);
  if (!losBlocked(G.city, h.x, h.y, target.x, target.y) && rng.chance(chance)) {
    if (pl.car) {
      pl.car.hp -= rng.range(3, 7);
      G.effects.push({ kind: 'spark', x: pl.car.x, y: pl.car.y, t: 0.2 });
    } else {
      pl.hp -= rng.range(5, 11);
      pl.hurtT = 0.4;
      G.effects.push({ kind: 'hurt', x: pl.x, y: pl.y, t: 0.3 });
    }
  }
}

// Officers fire when the player is an active shooter or the heat is at
// its worst; crews fire on sight of the player near their ground.
export function updateHostileFire(G, dt, rng) {
  const pl = G.player;
  const stars = G.stars;
  const shooters = [];
  if (pl.firedT > 0 || stars >= 4) for (const o of G.officers) if (!o.dead) shooters.push(o);
  for (const h of G.hostiles) if (!h.dead) shooters.push(h);
  for (const h of shooters) {
    h.shootCd -= dt;
    const target = pl.car || pl;
    const d = dist(h.x, h.y, target.x, target.y);
    if (h.shootCd <= 0 && d < 390 && d > 26 && !losBlocked(G.city, h.x, h.y, target.x, target.y)) {
      hostileShoot(G, h, rng);
      h.shootCd = rng.range(0.55, 1.15);
    }
  }
}

// Crew members hold their ground but press in when the player camps.
export function updateCrew(c, G, dt) {
  if (c.dead) return;
  const target = G.player.car || G.player;
  const d = dist(c.x, c.y, target.x, target.y);
  c.heading = Math.atan2(target.y - c.y, target.x - c.x);
  if (d > 165) {
    c.x += Math.cos(c.heading) * 96 * dt;
    c.y += Math.sin(c.heading) * 96 * dt;
  }
}

export function updateTracers(G, dt) {
  for (const t of G.tracers) t.t -= dt;
  G.tracers = G.tracers.filter((t) => t.t > 0);
  for (const e of G.effects) e.t -= dt;
  G.effects = G.effects.filter((e) => e.t > 0);
}
