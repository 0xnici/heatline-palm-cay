// shots.js — the four deterministic screenshot scenes (?shot=cover |
// onfoot | chase | mission, with &seed=). Each scene stages the real
// game state and then runs the real simulation for a fixed number of
// fixed-length steps, so the picture is the game itself, reproducible
// from the seed alone: the cover over the beach avenue at golden hour,
// downtown on foot with a job on the HUD, a four-star chase with the
// cruisers on the player's tail, and a timed delivery mid-dialogue.

import { makeCar } from './vehicles.js';
import { JOB_BUILDERS } from './missions.js';
import { stepGame } from './world.js';

const DT = 1 / 30;

function runSteps(G, n, afterEach) {
  for (let i = 0; i < n; i++) {
    stepGame(G, DT);
    if (afterEach) afterEach();
  }
}

function stageCover(G) {
  G.mode = 'title';
  // Extra traffic on the coast avenue so the cover street is alive.
  const spots = [
    ['sedan', 3200 - 24, 1180, Math.PI / 2], ['hatch', 3200 + 24, 1690, -Math.PI / 2],
    ['coupe', 2900 - 24, 1420, Math.PI / 2], ['sedan', 2900 + 24, 1050, -Math.PI / 2],
  ];
  for (const [model, x, y, heading] of spots) {
    const car = makeCar(model, x, y, heading, G.rng);
    car.driver = 'traffic';
    car.route = { axis: 'v', idx: model === 'coupe' || x < 3000 ? 5 : 6, dir: heading > 0 ? 1 : -1, decided: false };
    car.speed = 90;
    G.cars.push(car);
  }
  const cam = { x: 3020, y: 1460 };
  runSteps(G, 46, () => { G.camera.x = cam.x; G.camera.y = cam.y; });
  G.camera.x = cam.x; G.camera.y = cam.y;
}

function stageOnfoot(G) {
  G.mode = 'play';
  G.player.x = 1796;
  G.player.y = 1296;
  G.player.heading = 0.65;
  G.camera.x = G.player.x; G.camera.y = G.player.y;
  // Job one is on the books: the HUD carries its objective and marker.
  G.mission.active = JOB_BUILDERS[0](G);
  G.mission.stageIdx = 0;
  runSteps(G, 36);
}

function stageChase(G) {
  G.mode = 'play';
  const car = makeCar('coupe', 1836, 940, Math.PI / 2, G.rng, { paint: '#c33f2e' });
  car.driver = 'player';
  car.speed = 300;
  G.cars.push(car);
  G.player.car = car;
  G.player.x = car.x; G.player.y = car.y;
  G.law.heat = 340; // four stars
  // Two cruisers start right on the tail, close enough that three
  // seconds of sim reads as contact, not approach; the rest of the
  // response converges from the ring while the sim runs, exactly as
  // it does in play.
  const cop1 = makeCar('interceptor', 1854, 824, Math.PI / 2, G.rng);
  cop1.driver = 'police'; cop1.speed = 336;
  const cop2 = makeCar('interceptor', 1812, 752, Math.PI / 2, G.rng);
  cop2.driver = 'police'; cop2.speed = 326;
  G.cars.push(cop1, cop2);
  // Clear the chase corridor: civilian traffic in the avenue segment
  // ahead would be rear-ended at pursuit speed and wreck the shot's
  // geometry (and the cruisers) before the frame is taken.
  G.cars = G.cars.filter((c) => c === car || c.police
    || !(Math.abs(c.x - 1860) < 190 && c.y > 620 && c.y < 2100));
  // The quarry keeps its foot down (a held throttle, as in play); the
  // Interceptors' pace advantage does the rest.
  runSteps(G, 64, () => { if (car.speed < 292) car.speed = 292; });
}

function stageMission(G) {
  G.mode = 'play';
  const marisol = G.city.fixers.find((f) => f.id === 'marisol');
  const car = makeCar('sedan', marisol.x + 96, marisol.y + 66, -2.2, G.rng, { paint: '#2e6fc3' });
  car.driver = 'player';
  car.speed = 0;
  G.cars.push(car);
  G.player.car = car;
  G.player.x = car.x; G.player.y = car.y;
  G.camera.x = car.x; G.camera.y = car.y;
  // Job one, final stage: the timed delivery, 41 seconds on the clock,
  // and Marisol is talking.
  G.mission.active = JOB_BUILDERS[0](G);
  G.mission.stageIdx = 1;
  G.mission.timeLeft = 41;
  G.say('marisol', 'Two minutes of quiet driving. That is all I ask. The ledger rides in back — keep it boring.');
  runSteps(G, 18);
  G.mission.timeLeft = 41; // the still shows the moment it was staged
}

export function stageShot(G, name) {
  G.clockMin = 17 * 60 + 24; // golden hour, every shot
  if (name === 'cover') stageCover(G);
  else if (name === 'onfoot') stageOnfoot(G);
  else if (name === 'chase') stageChase(G);
  else if (name === 'mission') stageMission(G);
  else stageCover(G);
}
