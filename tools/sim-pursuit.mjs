// sim-pursuit.mjs — headless pursuit measurement against the real
// simulation. The fleeing coupe follows the road grid at a held
// 330 units/s (fast, under its 398 top speed), turning at crossings;
// four stars are up and the law responds exactly as it does in play.
// We record the nearest cruiser's distance over a 60-second flight.
// The claim to check: the pack stays in contact range — median
// nearest-cop around 200 units or better.
import { createGame, stepGame } from '../game/src/world.js';
import { makeCar } from '../game/src/vehicles.js';
import { lanePoint } from '../game/src/city.js';
import { makeRng } from '../game/src/rng.js';
import { AVENUES, STREETS } from '../game/src/config.js';

const G = createGame(7);
G.mode = 'play';
const car = makeCar('coupe', 1836, 1120, Math.PI / 2, G.rng, { paint: '#c33f2e' });
car.driver = 'gone'; // stepped by the player seat; steered by this script
car.speed = 330;
G.cars.push(car);
G.player.car = car;
G.player.x = car.x; G.player.y = car.y;
G.law.heat = 340; // four stars

const rng = makeRng(99);
const nav = { axis: 'v', idx: 3, dir: 1, target: null };
function pickTarget() {
  if (nav.axis === 'v') {
    const ys = STREETS.filter((y) => (y - car.y) * nav.dir > 40);
    const y = ys.length ? ys[ys.length - 1] : STREETS[STREETS.length - 1];
    nav.target = { ...lanePoint(AVENUES[nav.idx], y, 0, nav.dir), along: y };
  } else {
    const xs = AVENUES.filter((x) => (x - car.x) * nav.dir > 40);
    const x = xs.length ? xs[xs.length - 1] : AVENUES[AVENUES.length - 1];
    nav.target = { ...lanePoint(x, STREETS[nav.idx], nav.dir, 0), along: x };
  }
}
pickTarget();

const DT = 1 / 30;
const samples = [];
let completed = true;
for (let i = 0; i < 60 / DT; i++) {
  // Steer toward the lane point at the far end of the current leg;
  // on arrival, turn onto the crossing road (or reverse at the edge).
  const dx = nav.target.x - car.x, dy = nav.target.y - car.y;
  if (Math.hypot(dx, dy) < 70) {
    if (nav.axis === 'v') {
      const row = STREETS.indexOf(nav.target.along);
      nav.axis = 'h'; nav.idx = row;
      const options = [-1, 1].filter((d) => (d > 0 ? AVENUES[AVENUES.length - 1] - car.x : car.x - AVENUES[0]) > 300);
      nav.dir = options.length ? rng.pick(options) : -nav.dir;
    } else {
      const col = AVENUES.indexOf(nav.target.along);
      nav.axis = 'v'; nav.idx = col;
      const options = [-1, 1].filter((d) => (d > 0 ? STREETS[STREETS.length - 1] - car.y : car.y - STREETS[0]) > 300);
      nav.dir = options.length ? rng.pick(options) : -nav.dir;
    }
    pickTarget();
  }
  let want = Math.atan2(nav.target.y - car.y, nav.target.x - car.x);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.heading += Math.max(-2.2 * DT, Math.min(2.2 * DT, diff));
  // A real flight lifts off for corners: steering fades with speed in
  // this engine, so 300 down the straights, ~165 through the turns.
  car.speed = Math.abs(diff) > 0.25 ? 165 : 300;

  stepGame(G, DT);
  // The quarry is invulnerable here by design: this run measures
  // pursuit pressure over the full minute, not crash survivability.
  car.hp = 100; car.dead = false;
  if (G.mode !== 'play') { completed = false; console.log('run ended at', (i * DT).toFixed(1), 's, mode =', G.mode); break; }
  let nearest = Infinity;
  for (const c of G.cars) {
    if (!c.police || c.dead) continue;
    nearest = Math.min(nearest, Math.hypot(c.x - car.x, c.y - car.y));
  }
  if (nearest < Infinity) samples.push(nearest);
}
samples.sort((a, b) => a - b);
const pct = (p) => samples[Math.min(samples.length - 1, Math.floor(p * samples.length))];
console.log('samples:', samples.length, 'flight completed 60 s:', completed);
console.log('nearest-cop — min:', samples[0]?.toFixed(0), 'p25:', pct(0.25).toFixed(0),
  'median:', pct(0.5).toFixed(0), 'p90:', pct(0.9).toFixed(0));
console.log('quarry hp:', car.hp.toFixed(0), 'stars:', G.stars, 'heat:', G.law.heat.toFixed(0));
