// vehicles.js — car entities, the shared arcade driving physics, the
// traffic driver that follows the road grid, and the parked cars that
// line the kerbs and lots. Police and the player drive through the same
// physics, so a chase is fair: the law wins on pace, you win in corners.

import { CAR_MODELS, CIVILIAN_MODELS, CAR_PAINTS, LANE_OFF, ROAD_HALF, AVENUES, STREETS, WORLD_W, WORLD_H } from './config.js';
import { clamp, angleDelta } from './rng.js';
import { resolveCircle, groundAt } from './city.js';

let nextCarId = 1;

export function makeCar(modelKey, x, y, heading, rng, opts = {}) {
  const spec = CAR_MODELS[modelKey];
  return {
    id: nextCarId++,
    kind: 'car',
    model: modelKey,
    spec,
    x, y, heading,
    speed: 0,
    hp: 100,
    paint: opts.paint || (modelKey === 'interceptor' ? '#f2f2f2' : rng.pick(CAR_PAINTS)),
    police: modelKey === 'interceptor',
    parked: !!opts.parked,
    driver: opts.parked ? 'none' : 'traffic',
    route: null,       // traffic: { axis, idx, dir, crossAi, crossSi, decided }
    stuckT: 0,
    crashCooldown: 0,
    dead: false,
  };
}

// Arcade step shared by everyone. control: { throttle 0..1, brake 0..1,
// steer -1..1 }. Returns the impact speed if the car hit a building.
export function stepCarPhysics(car, control, dt, city) {
  const spec = car.spec;
  const onSand = groundAt(city, car.x, car.y) === 'sand';
  const topHere = spec.top * (onSand ? 0.5 : 1);

  if (control.throttle > 0) {
    const room = Math.max(0, 1 - car.speed / topHere);
    car.speed += spec.accel * control.throttle * room * dt;
  }
  if (control.brake > 0) {
    if (car.speed > 12) car.speed -= 340 * dt;
    else car.speed = Math.max(car.speed - 120 * dt, -88);
  }
  // Rolling drag and air drag.
  car.speed -= car.speed * 0.22 * dt;
  if (!control.throttle && !control.brake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);

  // Steering: authority peaks at city speed and fades as you go faster,
  // which is what makes a hard corner the great equaliser in a chase.
  const speedRatio = clamp(Math.abs(car.speed) / spec.top, 0, 1);
  const authority = spec.grip * (1 - 0.52 * speedRatio);
  const bite = clamp(car.speed / 130, -1, 1);
  car.heading += control.steer * authority * bite * dt;

  const prevX = car.x, prevY = car.y;
  car.x += Math.cos(car.heading) * car.speed * dt;
  car.y += Math.sin(car.heading) * car.speed * dt;

  // The sea is a wall to cars, and so is the edge of the world: slide
  // along both, shedding speed, never through them.
  if (groundAt(city, car.x, car.y) === 'water') {
    car.x = prevX;
    if (groundAt(city, car.x, car.y) === 'water') car.y = prevY;
    car.speed *= 0.4;
  }
  if (car.x < 18 || car.x > WORLD_W - 18 || car.y < 18 || car.y > WORLD_H - 18) {
    car.x = clamp(car.x, 18, WORLD_W - 18);
    car.y = clamp(car.y, 18, WORLD_H - 18);
    car.speed *= 0.5;
  }

  let impact = 0;
  const before = car.speed;
  if (resolveCircle(city, car, 17)) {
    impact = Math.abs(before);
    car.speed = -before * 0.22;
    car.hp -= impact * 0.16;
  }
  if (car.crashCooldown > 0) car.crashCooldown -= dt;
  return impact;
}

// ---- traffic -----------------------------------------------------------

// Start a car on a road leg: axis 'v' rides an avenue, 'h' a street.
export function startLeg(car, axis, idx, dir, rng) {
  car.route = { axis, idx, dir, decided: false };
  if (axis === 'v') {
    car.x = AVENUES[idx] - dir * LANE_OFF;
    car.heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    car.y = STREETS[idx] + dir * LANE_OFF;
    car.heading = dir > 0 ? 0 : Math.PI;
  }
}

// The crossing this leg is heading for, and the aim point on our lane.
function legTarget(car, city) {
  const r = car.route;
  if (r.axis === 'v') {
    let si = -1;
    for (let i = 0; i < STREETS.length; i++) {
      if ((STREETS[i] - car.y) * r.dir > -20) { si = i; break; }
    }
    if (si === -1) si = r.dir > 0 ? STREETS.length - 1 : 0;
    return { cx: AVENUES[r.idx], cy: STREETS[si], ai: r.idx, si, x: AVENUES[r.idx] - r.dir * LANE_OFF, y: STREETS[si] };
  }
  let ai = -1;
  for (let i = 0; i < AVENUES.length; i++) {
    if ((AVENUES[i] - car.x) * r.dir > -20) { ai = i; break; }
  }
  if (ai === -1) ai = r.dir > 0 ? AVENUES.length - 1 : 0;
  return { cx: AVENUES[ai], cy: STREETS[r.idx], ai, si: r.idx, x: AVENUES[ai], y: STREETS[r.idx] + r.dir * LANE_OFF };
}

export function driveTraffic(car, dt, city, cars, rng) {
  if (!car.route) startLeg(car, 'v', rng.int(0, AVENUES.length - 1), rng.pick([1, -1]), rng);
  const r = car.route;
  const t = legTarget(car, city);
  const distCross = Math.hypot(t.cx - car.x, t.cy - car.y);

  // Decide this crossing's move once, early enough to swing wide.
  if (!r.decided && distCross < 150) {
    r.decided = true;
    const roll = rng.next();
    r.action = roll < 0.52 ? 'straight' : roll < 0.76 ? 'left' : 'right';
    if ((r.axis === 'v' && ((r.idx === 0 && r.action === 'left' && r.dir > 0) || (r.idx === AVENUES.length - 1 && r.action === 'right' && r.dir > 0))) ||
        (r.axis === 'h' && ((r.idx === 0 && r.action === 'right' && r.dir > 0) || (r.idx === STREETS.length - 1 && r.action === 'left' && r.dir > 0)))) {
      r.action = 'straight';
    }
  }

  // Aim point: our lane at the crossing, or swung onto the exit lane
  // when a turn is decided. New heading after the turn: the right
  // vector of travel for a right turn, its negation for a left.
  let aimX = t.x, aimY = t.y;
  let newHeading = null;
  if (r.decided && r.action !== 'straight') {
    const hx = r.axis === 'v' ? 0 : r.dir;
    const hy = r.axis === 'v' ? r.dir : 0;
    const turn = r.action === 'right' ? 1 : -1;
    newHeading = turn === 1 ? { x: -hy, y: hx } : { x: hy, y: -hx };
    if (newHeading.x !== 0) {
      aimX = t.cx + newHeading.x * 170;
      aimY = STREETS[t.si] + newHeading.x * LANE_OFF;
    } else {
      aimX = AVENUES[t.ai] - newHeading.y * LANE_OFF;
      aimY = t.cy + newHeading.y * 170;
    }
  }

  const desired = Math.atan2(aimY - car.y, aimX - car.x);
  const steer = clamp(angleDelta(car.heading, desired) * 2.4, -1, 1);

  // Speed: cruise, slower for a turn, and keep off the car in front.
  let target = Math.min(car.spec.top * 0.4, 148);
  if (r.decided && r.action !== 'straight' && distCross < 130) target = 74;
  const fx = Math.cos(car.heading), fy = Math.sin(car.heading);
  for (const other of cars) {
    if (other === car || other.dead) continue;
    const rx = other.x - car.x, ry = other.y - car.y;
    const ahead = rx * fx + ry * fy;
    const side = Math.abs(rx * -fy + ry * fx);
    if (ahead > 0 && ahead < 58 && side < 17) {
      target = Math.min(target, Math.max(0, other.speed) * (ahead < 30 ? 0 : 0.92));
    }
  }
  const control = {
    throttle: car.speed < target ? 0.85 : 0,
    brake: car.speed > target + 24 ? 0.7 : 0,
    steer,
  };
  const impact = stepCarPhysics(car, control, dt, city);

  // Arrived at the crossing: commit the decided move.
  const passed = r.axis === 'v' ? (car.y - t.cy) * r.dir > 14 : (car.x - t.cx) * r.dir > 14;
  if (passed) {
    if (!r.decided || r.action === 'straight') {
      const nr = { axis: r.axis, idx: r.idx, dir: r.dir, decided: false };
      // Fell off the end of a road: turn around onto the same road.
      const beyond = r.axis === 'v'
        ? (r.dir > 0 && t.si === STREETS.length - 1) || (r.dir < 0 && t.si === 0)
        : (r.dir > 0 && t.ai === AVENUES.length - 1) || (r.dir < 0 && t.ai === 0);
      if (beyond) nr.dir = -r.dir;
      car.route = nr;
    } else if (newHeading) {
      if (newHeading.x !== 0) car.route = { axis: 'h', idx: t.si, dir: newHeading.x, decided: false };
      else car.route = { axis: 'v', idx: t.ai, dir: newHeading.y, decided: false };
    }
  }

  // Wedged recovery: barely moved for 3 s while trying to drive.
  if (Math.abs(car.speed) < 6 && control.throttle > 0) {
    car.stuckT += dt;
    if (car.stuckT > 3) {
      car.stuckT = 0;
      const c = city.crossings.reduce((a, b) =>
        (Math.hypot(b.x - car.x, b.y - car.y) < Math.hypot(a.x - car.x, a.y - car.y) ? b : a));
      if (car.route.axis === 'v') { car.x = AVENUES[car.route.idx] - car.route.dir * LANE_OFF; car.y = c.y - car.route.dir * 120; }
      else { car.y = STREETS[car.route.idx] + car.route.dir * LANE_OFF; car.x = c.x - car.route.dir * 120; }
      car.speed = 40;
    }
  } else car.stuckT = 0;

  return impact;
}

// Parked cars: neat rows in the lots, parallel at the kerbs elsewhere.
export function spawnParked(city, rng, count) {
  const cars = [];
  for (const lot of city.lots) {
    const n = rng.int(2, 4);
    for (let i = 0; i < n; i++) {
      const x = lot.x + 30 + i * 58;
      const y = lot.y + 30;
      if (x < lot.x + lot.w - 20) cars.push(makeCar(rng.pick(CIVILIAN_MODELS), x, y, Math.PI / 2, rng, { parked: true }));
    }
  }
  const kerbAvenues = [820, 1340, 2380, 3200];
  for (const ax of kerbAvenues) {
    for (let i = 0; i < count / kerbAvenues.length; i++) {
      const y = rng.range(120, 2480);
      let nearCross = false;
      for (const s of STREETS) if (Math.abs(y - s) < 84) nearCross = true;
      if (nearCross) continue;
      const side = rng.pick([1, -1]);
      const car = makeCar(rng.pick(CIVILIAN_MODELS), ax + side * (ROAD_HALF - 13), y, side > 0 ? Math.PI / 2 : -Math.PI / 2, rng, { parked: true });
      cars.push(car);
    }
  }
  return cars;
}
