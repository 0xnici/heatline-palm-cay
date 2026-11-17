// police.js — the Palm Cay PD: the wanted model (heat, stars, cooling),
// the pursuit driver that leads its quarry and cuts across the grid when
// far away, and the foot officers who finish the arrest. The Interceptor
// out-paces every civilian car in a straight line; corners, where all
// steering fades with speed, are where a chase is won or lost.

import {
  HEAT_PER_STAR, MAX_STARS, COP_CARS_BY_STAR, COP_FOOT_BY_STAR,
  COOL_DRAIN, COOL_DELAY, AVENUES, STREETS, LANE_OFF,
} from './config.js';
import { clamp, angleDelta, dist } from './rng.js';
import { makeCar, stepCarPhysics } from './vehicles.js';
import { nearestCrossing, pointInRect } from './city.js';

export function createLaw() {
  return { heat: 0, unseenT: 0, arrestT: 0, floorT: 0, sirenNear: false };
}

export function starsOf(law) {
  if (law.heat <= 0) return 0;
  return Math.min(MAX_STARS, Math.ceil(law.heat / HEAT_PER_STAR));
}

export function addHeat(law, amount) {
  law.heat = clamp(law.heat + amount, 0, HEAT_PER_STAR * MAX_STARS);
  law.unseenT = 0;
}

// While floorT runs, heat does not drain: some jobs are loud by design.
export function holdHeat(law, seconds) {
  law.floorT = Math.max(law.floorT, seconds);
}

export function focusOf(G) {
  // What the law is chasing: the player, or the car the player drives.
  if (G.player.car) {
    const c = G.player.car;
    return { x: c.x, y: c.y, vx: Math.cos(c.heading) * c.speed, vy: Math.sin(c.heading) * c.speed, inCar: true };
  }
  return { x: G.player.x, y: G.player.y, vx: G.player.vx || 0, vy: G.player.vy || 0, inCar: false };
}

// Pursuit steering for one police car. Returns the physics impact.
export function driveCop(car, G, dt) {
  const f = focusOf(G);
  const d = dist(car.x, car.y, f.x, f.y);

  let aimX, aimY;
  if (d > 620) {
    // Too far to chase a tail: cut across to the crossing nearest the
    // quarry and pick the trail up there.
    const c = nearestCrossing(G.city, f.x, f.y);
    aimX = c.x; aimY = c.y;
  } else {
    // Lead the quarry: the faster the gap closes, the further ahead of
    // its nose you aim. clamp(dist/240, 0.15, 0.75) of a second.
    const lead = clamp(d / 240, 0.15, 0.75);
    aimX = f.x + f.vx * lead;
    aimY = f.y + f.vy * lead;
  }

  // Building sense: if the nose is about to meet a wall, bend the aim
  // around the building's centre instead of into it.
  const hx = Math.cos(car.heading), hy = Math.sin(car.heading);
  const probeX = car.x + hx * 58, probeY = car.y + hy * 58;
  for (const b of G.city.buildings) {
    if (pointInRect(probeX, probeY, b, 14)) {
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const away = Math.atan2(probeY - cy, probeX - cx);
      aimX = car.x + Math.cos(away) * 120 + hx * 60;
      aimY = car.y + Math.sin(away) * 120 + hy * 60;
      break;
    }
  }

  const desired = Math.atan2(aimY - car.y, aimX - car.x);
  const delta = angleDelta(car.heading, desired);
  let steer = clamp(delta * 2.6, -1, 1);
  let throttle = Math.abs(delta) < 1.15 ? 1 : 0.3;
  let brake = 0;

  if (car.revT > 0) {
    // Back out of whatever we are stuck against.
    car.revT -= dt;
    brake = 1; throttle = 0;
    steer = -steer;
  } else if (f.inCar === false && d < 40) {
    throttle = 0; // officers make the arrest; the car just looms
  } else if (d < 46) {
    throttle = 0.45; // stay on the bumper without bouncing off it
  }

  const impact = stepCarPhysics(car, { throttle, brake, steer }, dt, G.city);

  // Wedged against the scenery: reverse briefly and try another line.
  if (Math.abs(car.speed) < 7 && throttle > 0.5) {
    car.stuckT = (car.stuckT || 0) + dt;
    if (car.stuckT > 2.2) { car.revT = 0.7; car.stuckT = 0; }
  } else car.stuckT = 0;

  return impact;
}

export function makeOfficer(x, y) {
  return {
    kind: 'officer', x, y, heading: 0, hp: 60, speedWalk: 150,
    shootCd: 0, burstT: 0, dead: false, downT: 0,
  };
}

// Keep the response matched to the stars: spawn in a ring around the
// player (never on top of them), retire the surplus from far away.
export function updateLaw(G, dt, rng) {
  const law = G.law;
  const stars = starsOf(law);

  if (law.floorT > 0) law.floorT -= dt;
  else if (law.unseenT > COOL_DELAY && law.heat > 0) {
    law.heat = Math.max(0, law.heat - COOL_DRAIN * dt);
  }

  const f = focusOf(G);
  const wantCars = COP_CARS_BY_STAR[stars];
  const copCars = G.cars.filter((c) => c.police && !c.dead);
  if (copCars.length < wantCars) {
    // Spawn at a crossing in the 400–640 ring around the quarry.
    const options = G.city.crossings.filter((c) => {
      const d = dist(c.x, c.y, f.x, f.y);
      return d > 400 && d < 640;
    });
    if (options.length) {
      const c = rng.pick(options);
      // They spawn responding to the call: nose already toward the
      // quarry, so the first second is spent closing, not turning.
      const car = makeCar('interceptor', c.x, c.y, Math.atan2(f.y - c.y, f.x - c.x), rng);
      car.driver = 'police';
      G.cars.push(car);
    }
  }
  for (const c of copCars) {
    const d = dist(c.x, c.y, f.x, f.y);
    if ((stars === 0 && d > 620) || d > 1500) c.dead = true;
  }

  const wantFoot = f.inCar ? (stars >= 4 ? 2 : 0) : COP_FOOT_BY_STAR[stars];
  const officers = G.officers.filter((o) => !o.dead);
  if (officers.length < wantFoot) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(300, 420);
    const x = clamp(f.x + Math.cos(a) * d, 40, 3560);
    const y = clamp(f.y + Math.sin(a) * d, 40, 2560);
    G.officers.push(makeOfficer(x, y));
  }
  for (const o of officers) {
    if (dist(o.x, o.y, f.x, f.y) > 900 || stars === 0) o.dead = true;
  }

  // The arrest clock: close, slow and seen is what gets you caught.
  let arresting = false;
  if (stars > 0) {
    if (!f.inCar) {
      for (const o of G.officers) if (!o.dead && dist(o.x, o.y, f.x, f.y) < 34) arresting = true;
      for (const c of copCars) if (dist(c.x, c.y, f.x, f.y) < 40) arresting = true;
    } else {
      const pc = G.player.car;
      if (Math.abs(pc.speed) < 26) {
        for (const c of copCars) if (dist(c.x, c.y, f.x, f.y) < 52) arresting = true;
        for (const o of G.officers) if (!o.dead && dist(o.x, o.y, f.x, f.y) < 40) arresting = true;
      }
    }
  }
  law.arrestT = arresting ? law.arrestT + dt : Math.max(0, law.arrestT - dt * 2);
  return law.arrestT > 1.25;
}

// Officers walk the quarry down. They keep a shooter's distance when
// the player is armed and the heat is high; otherwise they close in.
export function updateOfficer(o, G, dt) {
  if (o.dead) return;
  const f = focusOf(G);
  const d = dist(o.x, o.y, f.x, f.y);
  const armed = G.player.firedT > 0;
  const holdAt = armed && starsOf(G.law) >= 3 ? 120 : 16;
  if (d > holdAt) {
    const a = Math.atan2(f.y - o.y, f.x - o.x);
    o.heading = a;
    const sp = Math.min(o.speedWalk, (d - holdAt) * 2.2);
    o.x += Math.cos(a) * sp * dt;
    o.y += Math.sin(a) * sp * dt;
  }
}
