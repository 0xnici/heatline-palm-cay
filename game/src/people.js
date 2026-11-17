// people.js — the pedestrians of Palm Cay. They stroll the sidewalks
// corner to corner, about half of them in pairs, and they run when the
// street turns dangerous: a shot, a scream of tyres, a car mounting the
// kerb. They are also the city's eyes — most crimes only count as heat
// when a pedestrian or a cop actually sees them.

import { ROAD_HALF, AVENUES, STREETS } from './config.js';
import { clamp, dist } from './rng.js';
import { resolveCircle } from './city.js';

const SHIRTS = ['#e8e3d8', '#c33f2e', '#2e6fc3', '#3f9e58', '#e0a51f', '#e88bb0', '#7a4fa3', '#39b5a6', '#ef7d3c', '#4a4e57'];
const SKIN = ['#f2c79b', '#d9a066', '#a66a3f', '#7a4a28', '#ffd9b3'];

// A sidewalk corner beside a crossing.
function corner(ai, si, sx, sy) {
  return { x: AVENUES[ai] + sx * (ROAD_HALF + 11), y: STREETS[si] + sy * (ROAD_HALF + 11), ai, si, sx, sy };
}

export function makePed(city, rng, opts = {}) {
  const ai = rng.int(0, AVENUES.length - 1);
  const si = rng.int(0, STREETS.length - 1);
  const start = corner(ai, si, rng.pick([1, -1]), rng.pick([1, -1]));
  const ped = {
    kind: 'ped',
    x: start.x, y: start.y, heading: rng.range(0, Math.PI * 2),
    speed: rng.range(62, 92),
    corner: start,
    target: null,
    state: 'walk',       // walk | flee | down
    fleeT: 0, downT: 0,
    shirt: rng.pick(SHIRTS), skin: rng.pick(SKIN),
    leader: opts.leader || null,
    dead: false,
    hp: 30,
    stepT: rng.range(0, 0.4),
  };
  ped.target = nextCorner(city, ped, rng);
  return ped;
}

// Choose the next corner: along the avenue, along the street, or across.
function nextCorner(city, ped, rng) {
  const c = ped.corner;
  const options = [];
  if (c.ai > 0) options.push(corner(c.ai - 1, c.si, c.sx, c.sy));
  if (c.ai < AVENUES.length - 1) options.push(corner(c.ai + 1, c.si, c.sx, c.sy));
  if (c.si > 0) options.push(corner(c.ai, c.si - 1, c.sx, c.sy));
  if (c.si < STREETS.length - 1) options.push(corner(c.ai, c.si + 1, c.sx, c.sy));
  options.push(corner(c.ai, c.si, -c.sx, c.sy));
  options.push(corner(c.ai, c.si, c.sx, -c.sy));
  // Prefer carrying on in roughly the same direction.
  return rng.pick(options);
}

export function spawnCrowd(city, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const ped = makePed(city, rng);
    peds.push(ped);
    if (rng.chance(0.45)) {
      const pal = makePed(city, rng, { leader: ped });
      pal.x = ped.x + rng.range(-9, 9);
      pal.y = ped.y + rng.range(-9, 9);
      pal.corner = ped.corner;
      pal.target = ped.target;
      peds.push(pal);
    }
  }
  return peds;
}

// Danger makes the street empty fast. world calls this on gunfire, on a
// car hitting someone, on any loud crime at a point.
export function scarePeds(G, x, y, radius) {
  for (const p of G.peds) {
    if (p.state === 'down' || p.dead) continue;
    if (dist(p.x, p.y, x, y) < radius) {
      p.state = 'flee';
      p.fleeT = 2 + Math.random() * 2;
      p.fleeFrom = { x, y };
    }
  }
}

export function updatePed(p, G, dt, rng) {
  if (p.dead) return;
  if (p.state === 'down') {
    p.downT -= dt;
    if (p.downT <= 0 && p.hp > 0) { p.state = 'flee'; p.fleeT = 2.5; p.fleeFrom = { x: p.x, y: p.y }; }
    return;
  }
  if (p.state === 'flee') {
    p.fleeT -= dt;
    const from = p.fleeFrom || { x: p.x, y: p.y };
    const a = Math.atan2(p.y - from.y, p.x - from.x);
    p.heading = a;
    p.x += Math.cos(a) * 232 * dt;
    p.y += Math.sin(a) * 232 * dt;
    resolveCircle(G.city, p, 10);
    if (p.fleeT <= 0) {
      p.state = 'walk';
      const c = G.city.crossings.reduce((a2, b) =>
        (Math.hypot(b.x - p.x, b.y - p.y) < Math.hypot(a2.x - p.x, a2.y - p.y) ? b : a2));
      p.corner = corner(c.ai, c.si, Math.sign(p.x - c.x) || 1, Math.sign(p.y - c.y) || 1);
      p.target = nextCorner(G.city, p, rng);
    }
    return;
  }
  // Walking: companions shadow their leader, everyone else follows the
  // corner-to-corner stroll.
  if (p.leader && !p.leader.dead) {
    const lx = p.leader.x - Math.cos(p.leader.heading) * 13;
    const ly = p.leader.y - Math.sin(p.leader.heading) * 13;
    const d = dist(p.x, p.y, lx, ly);
    if (d > 4) {
      const a = Math.atan2(ly - p.y, lx - p.x);
      p.heading = a;
      const sp = clamp(d * 3, 30, 150);
      p.x += Math.cos(a) * sp * dt;
      p.y += Math.sin(a) * sp * dt;
    }
    p.state = p.leader.state === 'flee' ? 'walk' : p.state;
    if (p.leader.state === 'flee') { p.state = 'flee'; p.fleeT = p.leader.fleeT; p.fleeFrom = p.leader.fleeFrom; }
    return;
  }
  const t = p.target;
  if (!t) { p.target = nextCorner(G.city, p, rng); return; }
  const d = dist(p.x, p.y, t.x, t.y);
  if (d < 7) {
    p.corner = t;
    p.target = nextCorner(G.city, p, rng);
    return;
  }
  const a = Math.atan2(t.y - p.y, t.x - p.x);
  p.heading = a;
  p.x += Math.cos(a) * p.speed * dt;
  p.y += Math.sin(a) * p.speed * dt;
  resolveCircle(G.city, p, 10);
  p.x = clamp(p.x, 24, 3560);
  p.y = clamp(p.y, 24, 2560);
}

// A car strike: down they go; whether they get up is about the speed.
export function knockDown(p, severity) {
  if (p.state === 'down') return;
  p.state = 'down';
  p.downT = severity > 0.75 ? 999 : 6;
  if (severity > 0.75) p.hp = 0;
}
