// Pedestrians: strollers on the sidewalks and beach who chat-walk in pairs of
// intent — a waypoint, a pace, a shirt colour — and who flee screaming from
// gunfire, crashes and speeding cars, then calm down and resume their day.
import { BEACH_X, STREETS, AVENUES } from './city.js';
import { pickFrom, rangeIn } from './random.js';

const SHIRTS = ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#f7f3e3', '#c77dff', '#ff9f1c', '#e0fbfc'];
let nextId = 1;
export function createPedestrian(random, x, y) {
  return {
    id: nextId++, x, y, angle: random() * 6.28, speed: 0, health: 40,
    shirt: pickFrom(random, SHIRTS), skin: pickFrom(random, ['#f2c9a0', '#c68863', '#8d5524', '#ffdbac']),
    state: 'walk', panic: 0, target: null, wait: rangeIn(random, 0, 2), dead: false, down: 0,
    thug: false, fireTimer: 0,
  };
}
export function spawnPedestrians(random, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    if (random() < 0.18) { peds.push(createPedestrian(random, BEACH_X + 40 + random() * 200, 100 + random() * 2400)); continue; }
    const vertical = random() < 0.5;
    const road = pickFrom(random, vertical ? AVENUES : STREETS);
    const off = (random() < 0.5 ? -1 : 1) * (64 + random() * 14);
    const along = 100 + random() * 2400;
    peds.push(createPedestrian(random, vertical ? road + off : along, vertical ? along : road + off));
  }
  return peds;
}
function newTarget(ped, random) {
  const vertical = random() < 0.5;
  const road = pickFrom(random, vertical ? AVENUES : STREETS);
  const off = (random() < 0.5 ? -1 : 1) * (64 + random() * 14);
  const along = Math.max(60, Math.min(2540, (vertical ? ped.y : ped.x) + rangeIn(random, -700, 700)));
  ped.target = vertical ? { x: road + off, y: along } : { x: along, y: road + off };
}
export function stepPedestrian(ped, dt, random, danger, city) {
  if (ped.dead) return;
  if (ped.down > 0) { ped.down -= dt; return; }
  if (danger && Math.hypot(danger.x - ped.x, danger.y - ped.y) < 190) ped.panic = 2.6;
  if (ped.panic > 0) ped.panic -= dt;
  let speed = 62;
  if (ped.panic > 0) {
    speed = 196;
    if (danger) ped.angle = Math.atan2(ped.y - danger.y, ped.x - danger.x);
  } else {
    if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 18) {
      if (ped.wait > 0) { ped.wait -= dt; ped.speed = 0; return; }
      newTarget(ped, random); ped.wait = rangeIn(random, 0, 3);
    }
    ped.angle = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
  }
  ped.speed = speed;
  ped.x += Math.cos(ped.angle) * speed * dt;
  ped.y += Math.sin(ped.angle) * speed * dt;
  // Simple building avoidance: slide along walls via the shared collider.
  importCollide(city, ped);
  ped.x = Math.max(16, Math.min(3560, ped.x)); ped.y = Math.max(16, Math.min(2584, ped.y));
}
function importCollide(city, ped) {
  for (const b of city.buildings) {
    if (ped.x > b.x - 12 && ped.x < b.x + b.w + 12 && ped.y > b.y - 12 && ped.y < b.y + b.h + 12) {
      const left = ped.x - (b.x - 12); const right = (b.x + b.w + 12) - ped.x;
      const top = ped.y - (b.y - 12); const bot = (b.y + b.h + 12) - ped.y;
      const m = Math.min(left, right, top, bot);
      if (m === left) ped.x = b.x - 12; else if (m === right) ped.x = b.x + b.w + 12;
      else if (m === top) ped.y = b.y - 12; else ped.y = b.y + b.h + 12;
    }
  }
}
