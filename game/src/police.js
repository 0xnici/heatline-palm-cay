// The Palm Cay PD: interceptor cars that spawn at the city edge of the
// player's view and hunt by road, plus foot officers at high heat who close
// in to make the bust. Wanted stars are a heat value the world owns; this
// module only decides how much force answers it and how it moves.
import { POLICE_MODEL } from './config.js';
import { nearestCrossing } from './city.js';
import { createCar } from './vehicles.js';
import { clamp } from './random.js';

export function wantedStars(heat) { return Math.max(0, Math.min(5, Math.ceil(heat))); }
export function forceForStars(stars) {
  return { cars: [0, 1, 2, 3, 4, 6][stars], officers: [0, 0, 0, 1, 2, 4][stars] };
}
export function spawnPoliceCar(random, player) {
  const ang = random() * Math.PI * 2;
  const car = createCar(random, player.x + Math.cos(ang) * 760, player.y + Math.sin(ang) * 760, ang + Math.PI, 'police');
  car.model = POLICE_MODEL; car.driver = 'police';
  return car;
}
/** Pursuit steering: aim at a point just ahead of the quarry; ram when close, shadow when far. */
export function policeThink(car, dt, playerPos, playerSpeed) {
  const dist = Math.hypot(playerPos.x - car.x, playerPos.y - car.y);
  const lead = clamp(dist / 300, 0, 0.6);
  const tx = playerPos.x + (playerPos.vx || 0) * lead;
  const ty = playerPos.y + (playerPos.vy || 0) * lead;
  // When far away, route via the nearest crossing so cruisers stay on streets.
  const aim = dist > 620 ? nearestCrossing(car.x, car.y) : { x: tx, y: ty };
  const want = Math.atan2(aim.y - car.y, aim.x - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = clamp(diff * 2.6, -1, 1);
  let throttle = 1;
  if (Math.abs(diff) > 2.4) throttle = -0.7; // spun around: reverse out
  else if (dist < 60 && playerSpeed < 30) throttle = 0.2; // alongside a stopped quarry: hold
  car.sirenPhase = (car.sirenPhase || 0) + dt;
  return { throttle, steer };
}
/** Foot officer: run at the player on foot; in a car chase they guard the cruiser. */
export function stepOfficer(officer, dt, player) {
  const d = Math.hypot(player.x - officer.x, player.y - officer.y);
  officer.angle = Math.atan2(player.y - officer.y, player.x - officer.x);
  if (d > 26) {
    officer.x += Math.cos(officer.angle) * 178 * dt;
    officer.y += Math.sin(officer.angle) * 178 * dt;
  }
  return d;
}
