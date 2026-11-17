// Cars: five civilian models plus the police interceptor. One physics step
// serves the player, traffic and police — throttle, brake/reverse, steering
// that bites harder at low speed, drag, and body damage from impacts.
import { CAR_MODELS, POLICE_MODEL } from './config.js';
import { AVENUES, STREETS, collideCircle, nearestCrossing } from './city.js';
import { angleLerp, clamp, pickFrom } from './random.js';

let nextId = 1;
export function createCar(random, x, y, angle, kind) {
  const model = kind === 'police' ? POLICE_MODEL : pickFrom(random, CAR_MODELS);
  return {
    id: nextId++, kind, model, color: kind === 'police' ? '#f4f6f8' : pickFrom(random, model.colors),
    x, y, angle, speed: 0, health: 100, driver: kind === 'parked' ? null : 'ai',
    steer: 0, throttle: 0, target: null, wait: 0, honk: 0, dead: false,
  };
}
export function spawnParkedCars(city, random, count) {
  const cars = [];
  for (let i = 0; i < count && i < city.parkSpots.length * 2; i += 1) {
    const avenue = pickFrom(random, AVENUES);
    const y = 120 + random() * 2360;
    if (STREETS.some((s) => Math.abs(y - s) < 80)) continue;
    const side = random() < 0.5 ? -34 : 34;
    cars.push(createCar(random, avenue + side, y, side < 0 ? Math.PI : 0, 'parked'));
  }
  return cars;
}
export function spawnTraffic(random, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const vertical = random() < 0.5;
    const a = pickFrom(random, vertical ? AVENUES : STREETS);
    const along = 140 + random() * 2300;
    const dir = random() < 0.5 ? 1 : -1;
    const lane = 26 * dir;
    const car = vertical
      ? createCar(random, a + lane, along, dir > 0 ? Math.PI / 2 : -Math.PI / 2, 'traffic')
      : createCar(random, along, a + lane, dir > 0 ? 0 : Math.PI, 'traffic');
    car.speed = car.model.topSpeed * 0.4;
    cars.push(car);
  }
  return cars;
}
/** Advance one car. input: {throttle -1..1, steer -1..1}. Returns impact speed or 0. */
export function driveCar(car, dt, throttle, steer) {
  const m = car.model;
  const accel = throttle > 0 ? m.accel : m.accel * 0.62;
  car.speed += throttle * accel * dt;
  car.speed -= car.speed * 0.55 * dt; // drag + rolling resistance
  if (throttle === 0) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 60 * dt);
  const maxRev = m.topSpeed * 0.36;
  car.speed = clamp(car.speed, -maxRev, m.topSpeed);
  const steerAuthority = clamp(Math.abs(car.speed) / 60, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += steer * m.grip * steerAuthority * dt * clamp(120 / (60 + Math.abs(car.speed)), 0.45, 1.6);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  return Math.abs(car.speed);
}
/** Traffic brain: cruise the current road, slow for the car ahead, turn at crossings. */
export function trafficThink(car, dt, cars, random) {
  let throttle = 0.72; let steer = 0;
  // Hold the lane line: aim at a point ahead on the same road.
  if (!car.target || Math.hypot(car.target.x - car.x, car.target.y - car.y) < 90) {
    const cross = nearestCrossing(car.x + Math.cos(car.angle) * 260, car.y + Math.sin(car.angle) * 260);
    car.target = cross;
    if (random() < 0.4) { // sometimes turn: aim down the crossing road instead
      const vertical = AVENUES.includes(cross.x) && Math.abs(Math.cos(car.angle)) < 0.5;
      car.target = vertical ? { x: cross.x, y: cross.y } : cross;
    }
  }
  const want = Math.atan2(car.target.y - car.y, car.target.x - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  steer = clamp(diff * 2.2, -1, 1);
  // Keep right-hand lane offset.
  const laneX = car.target.x - Math.sin(want) * 0 + Math.cos(want + Math.PI / 2) * 0;
  void laneX;
  for (const other of cars) {
    if (other === car || other.dead) continue;
    const fx = car.x + Math.cos(car.angle) * 62; const fy = car.y + Math.sin(car.angle) * 62;
    if (Math.hypot(other.x - fx, other.y - fy) < 40) { throttle = -0.4; break; }
    if (Math.hypot(other.x - car.x, other.y - car.y) < 56) throttle = Math.min(throttle, 0.1);
  }
  if (car.wait > 0) { car.wait -= dt; throttle = -0.2; }
  return { throttle, steer };
}
/** Circle-vs-car and car-vs-car shoves with damage; returns worst impact for the player car. */
export function collideCars(cars, city, playerCar) {
  let playerImpact = 0;
  for (const car of cars) {
    if (car.dead) continue;
    const before = { x: car.x, y: car.y };
    collideCircle(city, car, 24);
    if (car.hitWall) {
      car.hitWall = false;
      const impact = Math.abs(car.speed);
      if (impact > 90) { car.health -= impact * 0.12; if (car === playerCar) playerImpact = Math.max(playerImpact, impact); }
      car.speed *= -0.25; car.x = before.x; car.y = before.y;
      collideCircle(city, car, 24); car.hitWall = false;
    }
  }
  for (let i = 0; i < cars.length; i += 1) for (let j = i + 1; j < cars.length; j += 1) {
    const a = cars[i]; const b = cars[j];
    if (a.dead || b.dead) continue;
    const dx = b.x - a.x; const dy = b.y - a.y; const d = Math.hypot(dx, dy);
    if (d > 0.01 && d < 46) {
      const push = (46 - d) / 2; const nx = dx / d; const ny = dy / d;
      a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
      const rel = Math.abs(a.speed - b.speed) + Math.abs(a.speed) * 0.2;
      if (rel > 70) {
        a.health -= rel * 0.08; b.health -= rel * 0.08;
        if (a === playerCar || b === playerCar) playerImpact = Math.max(playerImpact, rel);
        a.speed *= 0.55; b.speed *= 0.55;
      }
    }
  }
  for (const car of cars) if (car.health <= 0 && !car.dead) { car.dead = true; car.speed = 0; }
  return playerImpact;
}
export { angleLerp };
