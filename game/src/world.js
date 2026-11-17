// world.js — the game state and the simulation step that ties every
// system together: player, traffic, the law, missions, combat, crowds.
// Rendering and sound read this state; they never change it.

import {
  WORLD_W, WORLD_H, WATER_X, SAVE_KEY, HEAT_CRIMES, WALK_SPEED, SPRINT_SPEED,
} from './config.js';
import { makeRng, clamp, dist } from './rng.js';
import { buildCity, resolveCircle, groundAt, losBlocked } from './city.js';
import { makeCar, stepCarPhysics, driveTraffic, startLeg, spawnParked } from './vehicles.js';
import { createLaw, starsOf, addHeat, updateLaw, driveCop, updateOfficer, focusOf } from './police.js';
import { spawnCrowd, updatePed, scarePeds, knockDown } from './people.js';
import { playerShoot, playerMelee, updateHostileFire, updateCrew, updateTracers } from './combat.js';
import {
  createMissionState, updateMission, offeredFixer, startJob,
  createTaxiState, updateTaxi, updatePackages, JOB_BUILDERS,
} from './missions.js';
import { moveAxes, driveAxes, keyPressed, keyHeld, getMouse } from './input.js';
import { sfx, engineSound, sirenSound, initAudio } from './audio.js';

export function createGame(seed = 7) {
  const cityRng = makeRng(seed);
  const city = buildCity(cityRng);
  const rng = makeRng(seed ^ 0x9e3779b9);

  const G = {
    seed, rng, city,
    mode: 'title',       // title | play | pause | card | busted | wasted | ending
    time: 0,
    clockMin: 9 * 60 + 20,
    player: {
      x: 742, y: 776, heading: -Math.PI / 2, hp: 100, car: null,
      vx: 0, vy: 0, aim: 0, shootCd: 0, meleeCd: 0, firedT: 0, hurtT: 0, stepT: 0,
    },
    cars: [], peds: [], officers: [], hostiles: [],
    tracers: [], effects: [], floaters: [],
    law: createLaw(), stars: 0,
    cash: 120, respect: 0, packagesFound: 0,
    mission: createMissionState(),
    taxi: createTaxiState(),
    dialogue: null, card: null, loudEvent: null,
    camera: { x: 742, y: 776 },
    hasSave: false,
    stats: { shots: 0, carsStolen: 0, busts: 0 },
  };

  G.cars.push(...spawnParked(city, rng, 26));
  G.peds.push(...spawnCrowd(city, rng, 30));
  for (let i = 0; i < 11; i++) spawnTrafficCar(G, true);

  // -- helpers the other modules call back into -------------------------
  G.floatText = (text, x, y) => G.floaters.push({ text, x, y, t: 1.7 });
  G.say = (fixerId, line) => {
    const f = fixerId ? city.fixers.find((v) => v.id === fixerId) : null;
    G.dialogue = { speaker: f ? f.name : 'Palm Cay', lines: [line], idx: 0, t: 0 };
  };
  G.showCard = (card) => { G.card = card; G.mode = 'card'; };
  G.showEnding = () => {
    G.card = {
      title: 'HEATLINE',
      subtitle: 'The Cay knows your name now',
      lines: [
        `Five jobs, three fixers, one legend. Cash banked: $${G.cash}. Respect: ${G.respect}.`,
        'The strongbox sails tonight. Palm Cay is yours — the streets, the beach, and every star the PCPD can throw.',
      ],
      foot: 'Enter — free roam',
    };
    G.mode = 'ending';
  };
  G.saveGame = () => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: G.cash, respect: G.respect, jobIndex: G.mission.jobIndex,
        done: G.mission.done, packages: city.packages.filter((p) => p.taken).map((p) => p.id),
        x: G.player.x, y: G.player.y,
      }));
      G.hasSave = true;
    } catch { /* storage unavailable: play on without saving */ }
  };
  G.loadGame = () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      G.cash = s.cash; G.respect = s.respect;
      G.mission.jobIndex = s.jobIndex; G.mission.done = !!s.done;
      for (const id of s.packages || []) {
        const pack = city.packages[id];
        if (pack && !pack.taken) { pack.taken = true; G.packagesFound++; }
      }
      if (s.x) { G.player.x = s.x; G.player.y = s.y; }
      return true;
    } catch { return false; }
  };
  G.hasSave = (() => { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } })();

  return G;
}

function spawnTrafficCar(G, anywhere = false) {
  const p = G.player.car || G.player;
  const options = G.city.crossings.filter((c) => {
    const d = dist(c.x, c.y, p.x, p.y);
    return anywhere ? d > 500 : (d > 720 && d < 1700);
  });
  if (!options.length) return;
  const c = G.rng.pick(options);
  const models = ['coupe', 'sedan', 'hatch', 'pickup', 'sedan', 'hatch'];
  const car = makeCar(G.rng.pick(models), c.x, c.y, 0, G.rng);
  startLeg(car, G.rng.pick(['v', 'h']), 0, G.rng.pick([1, -1]), G.rng);
  // Place the car on the chosen crossing's roads.
  if (car.route.axis === 'v') {
    car.route.idx = c.ai;
    car.x = c.x - car.route.dir * 24;
    car.y = c.y;
  } else {
    car.route.idx = c.si;
    car.y = c.y + car.route.dir * 24;
    car.x = c.x;
  }
  car.speed = 60;
  G.cars.push(car);
}

// Is anyone with eyes — a walking witness or the law — watching a point?
export function witnessed(G, x, y, range = 300) {
  for (const p of G.peds) {
    if (p.state === 'down' || p.dead) continue;
    if (dist(p.x, p.y, x, y) < range && !losBlocked(G.city, p.x, p.y, x, y)) return true;
  }
  for (const c of G.cars) {
    if (!c.police || c.dead) continue;
    if (dist(c.x, c.y, x, y) < range + 60 && !losBlocked(G.city, c.x, c.y, x, y)) return true;
  }
  for (const o of G.officers) {
    if (!o.dead && dist(o.x, o.y, x, y) < range) return true;
  }
  return false;
}

function crimeAt(G, x, y, heat) {
  if (witnessed(G, x, y)) addHeat(G.law, heat);
  scarePeds(G, x, y, 190);
}

// ---- player --------------------------------------------------------------

function enterCar(G, car) {
  const pl = G.player;
  if (car.driver === 'traffic') {
    // Pull the driver out: they hit the pavement running.
    const runner = {
      kind: 'ped', x: car.x + 18, y: car.y + 10, heading: 0, speed: 80,
      corner: null, target: null, state: 'flee', fleeT: 3, fleeFrom: { x: car.x, y: car.y },
      downT: 0, shirt: '#888', skin: '#d9a066', leader: null, dead: false, hp: 30, stepT: 0,
    };
    G.peds.push(runner);
  }
  car.parked = false;
  car.driver = 'player';
  pl.car = car;
  pl.x = car.x; pl.y = car.y;
  G.stats.carsStolen++;
  sfx('door');
  crimeAt(G, car.x, car.y, car.police ? HEAT_CRIMES.theft + 60 : HEAT_CRIMES.theft);
}

function exitCar(G) {
  const pl = G.player;
  const car = pl.car;
  if (!car) return;
  car.driver = 'none';
  if (Math.abs(car.speed) < 4) car.parked = true;
  pl.car = null;
  const side = car.heading + Math.PI / 2;
  pl.x = car.x + Math.cos(side) * 26;
  pl.y = car.y + Math.sin(side) * 26;
  resolveCircle(G.city, pl, 11);
  sfx('door');
}

function updatePlayer(G, dt) {
  const pl = G.player;
  pl.shootCd -= dt; pl.meleeCd -= dt;
  if (pl.firedT > 0) pl.firedT -= dt;
  if (pl.hurtT > 0) { pl.hurtT -= dt; pl.calmT = 0; }
  else {
    pl.calmT = (pl.calmT || 0) + dt;
    if (pl.calmT > 6 && pl.hp < 100) pl.hp = Math.min(100, pl.hp + 2.4 * dt);
  }

  const mouse = getMouse();
  const cam = G.camera;
  const worldMouseX = cam.x + (mouse.x - 640);
  const worldMouseY = cam.y + (mouse.y - 360);

  if (pl.car) {
    const car = pl.car;
    const ctl = driveAxes();
    const impact = stepCarPhysics(car, ctl, dt, G.city);
    if (impact > 130 && car.crashCooldown <= 0) {
      car.crashCooldown = 0.8;
      sfx('crash');
      crimeAt(G, car.x, car.y, HEAT_CRIMES.ram);
    }
    pl.x = car.x; pl.y = car.y;
    pl.aim = Math.atan2(worldMouseY - pl.y, worldMouseX - pl.x);
    engineSound(true, Math.abs(car.speed) / car.spec.top, dt);
    if (keyPressed('KeyE') && Math.abs(car.speed) < 70) exitCar(G);
    if (car.hp <= 0 && !car.dead) {
      car.dead = true;
      pl.hp -= 26;
      pl.hurtT = 0.5;
      exitCar(G);
      G.floatText('Wrecked!', car.x, car.y - 30);
    }
    return;
  }

  engineSound(false, 0, dt);
  const ax = moveAxes();
  const run = (ax.x !== 0 || ax.y !== 0);
  const speed = keyHeld('ShiftLeft', 'ShiftRight') ? SPRINT_SPEED : WALK_SPEED;
  pl.vx = ax.x * speed; pl.vy = ax.y * speed;
  if (run) {
    pl.heading = Math.atan2(ax.y, ax.x);
    let nx = pl.x + pl.vx * dt;
    let ny = pl.y + pl.vy * dt;
    // The sea is not a road: sand slows you, water stops you (piers don't).
    const g1 = groundAt(G.city, nx, pl.y);
    if (g1 !== 'water') pl.x = nx;
    const g2 = groundAt(G.city, pl.x, ny);
    if (g2 !== 'water') pl.y = ny;
    if (groundAt(G.city, pl.x, pl.y) === 'sand') {
      pl.x -= pl.vx * dt * 0.35;
      pl.y -= pl.vy * dt * 0.35;
    }
    resolveCircle(G.city, pl, 11);
    pl.x = clamp(pl.x, 16, WORLD_W - 16);
    pl.y = clamp(pl.y, 16, WORLD_H - 16);
    pl.stepT -= dt;
    if (pl.stepT <= 0) { pl.stepT = keyHeld('ShiftLeft', 'ShiftRight') ? 0.26 : 0.36; sfx('step'); }
  } else { pl.vx = 0; pl.vy = 0; }

  pl.aim = Math.atan2(worldMouseY - pl.y, worldMouseX - pl.x);
  if (mouse.down) { if (playerShoot(G, G.rng)) G.stats.shots++; }
  if (keyPressed('KeyF')) playerMelee(G);

  if (keyPressed('KeyE')) {
    // Talk to a fixer with a job, or take a car.
    const offer = offeredFixer(G);
    if (offer && dist(pl.x, pl.y, offer.fixer.x, offer.fixer.y) < 54) {
      startJob(G, offer.def);
      return;
    }
    let best = null, bd = 50;
    for (const car of G.cars) {
      if (car.dead || car.driver === 'player') continue;
      const d = dist(pl.x, pl.y, car.x, car.y);
      if (d < bd && (car.parked || Math.abs(car.speed) < 42)) { bd = d; best = car; }
    }
    if (best) enterCar(G, best);
  }
}

// ---- collisions between cars, and cars meeting people ----------------------

function updateCollisions(G, dt) {
  const cars = G.cars.filter((c) => !c.dead);
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 32 * 32 || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = (32 - d) / 2;
      const nx = dx / d, ny = dy / d;
      if (!a.parked) { a.x -= nx * push; a.y -= ny * push; }
      if (!b.parked) { b.x += nx * push; b.y += ny * push; }
      const closing = Math.abs(a.speed - b.speed);
      const relSpeed = Math.abs((a.speed * Math.cos(a.heading) - b.speed * Math.cos(b.heading)) * nx +
        (a.speed * Math.sin(a.heading) - b.speed * Math.sin(b.heading)) * ny);
      if (relSpeed > 55) {
        a.hp -= relSpeed * 0.12; b.hp -= relSpeed * 0.12;
        a.speed *= 0.55; b.speed *= 0.55;
        if ((a === G.player.car || b === G.player.car) && a.crashCooldown <= 0 && b.crashCooldown <= 0) {
          a.crashCooldown = b.crashCooldown = 0.9;
          sfx('crash');
          crimeAt(G, G.player.car.x, G.player.car.y, HEAT_CRIMES.ram);
        }
      }
      void closing;
    }
  }
  // Cars meet pedestrians: the street is unforgiving at speed.
  for (const car of cars) {
    if (Math.abs(car.speed) < 55) continue;
    for (const p of G.peds) {
      if (p.state === 'down' || p.dead) continue;
      if (dist(car.x, car.y, p.x, p.y) < 17) {
        knockDown(p, clamp(Math.abs(car.speed) / 300, 0.3, 1));
        car.hp -= 2;
        if (car === G.player.car) {
          sfx('crash');
          crimeAt(G, car.x, car.y, HEAT_CRIMES.pedHit);
        } else scarePeds(G, p.x, p.y, 220);
      }
    }
  }
}

// ---- the step ----------------------------------------------------------------

export function stepGame(G, dt) {
  G.time += dt;
  G.clockMin = (G.clockMin + dt * 2) % (24 * 60);

  const ambientOnly = G.mode === 'title' || G.mode === 'card' || G.mode === 'busted' || G.mode === 'wasted' || G.mode === 'ending';
  if (G.mode === 'pause') return;

  // Traffic and crowds always move: the city lives behind every menu.
  let trafficCount = 0;
  for (const car of G.cars) {
    if (car.dead) continue;
    if (car.driver === 'traffic') { driveTraffic(car, dt, G.city, G.cars, G.rng); trafficCount++; }
    else if (car.driver === 'hostile') { if (!ambientOnly) driveCop(car, G, dt); }
    else if (car.driver === 'police') {
      // starsOf(law), not G.stars: G.stars is refreshed at the end of
      // the step, and a cruiser already on the street when the heat
      // rises must join the pursuit on the first step, not be
      // recycled into traffic.
      if (!ambientOnly && starsOf(G.law) > 0) driveCop(car, G, dt);
      else if (!car.route) startLeg(car, 'v', 0, 1, G.rng);
      else driveTraffic(car, dt, G.city, G.cars, G.rng);
    }
  }
  for (const p of G.peds) updatePed(p, G, dt, G.rng);
  G.peds = G.peds.filter((p) => !p.dead);
  while (G.peds.length < 40) G.peds.push(...spawnCrowd(G.city, G.rng, 2));

  if (ambientOnly) { updateCamera(G, dt); return; }

  // -- full simulation --
  updatePlayer(G, dt);
  updateCollisions(G, dt);

  if (trafficCount < 11 && G.rng.chance(0.02)) spawnTrafficCar(G);
  G.cars = G.cars.filter((c) => !c.dead || c === G.player.car);
  for (const car of G.cars) {
    if (car.driver === 'traffic' && dist(car.x, car.y, G.player.x, G.player.y) > 1750) car.dead = true;
  }

  for (const o of G.officers) updateOfficer(o, G, dt);
  for (const h of G.hostiles) updateCrew(h, G, dt);
  updateHostileFire(G, dt, G.rng);
  G.officers = G.officers.filter((o) => !o.dead);
  G.hostiles = G.hostiles.filter((h) => !h.dead);
  updateTracers(G, dt);
  for (const f of G.floaters) { f.t -= dt; f.y -= 26 * dt; }
  G.floaters = G.floaters.filter((f) => f.t > 0);

  // Who can see the player right now? That decides whether heat cools.
  const f = focusOf(G);
  let seen = false;
  for (const c of G.cars) {
    if (c.police && !c.dead && dist(c.x, c.y, f.x, f.y) < 340 && !losBlocked(G.city, c.x, c.y, f.x, f.y)) seen = true;
  }
  for (const o of G.officers) {
    if (!o.dead && dist(o.x, o.y, f.x, f.y) < 300 && !losBlocked(G.city, o.x, o.y, f.x, f.y)) seen = true;
  }
  if (G.loudEvent) {
    G.loudEvent.t -= dt;
    if (G.loudEvent.t <= 0) G.loudEvent = null;
    else seen = true;
  }
  G.law.unseenT = seen ? 0 : G.law.unseenT + dt;
  const busted = updateLaw(G, dt, G.rng);
  G.stars = starsOf(G.law);
  G.law.sirenNear = G.cars.some((c) => c.police && !c.dead && dist(c.x, c.y, f.x, f.y) < 700);
  sirenSound(G.stars > 0 && G.law.sirenNear);

  if (busted) return triggerBusted(G);
  if (G.player.hp <= 0) return triggerWasted(G);

  updateMission(G, dt);
  G.stars = starsOf(G.law);
  updateTaxi(G, dt, G.rng);
  updatePackages(G);

  // Dialogue auto-advances; Enter hurries it.
  if (G.dialogue) {
    G.dialogue.t += dt;
    if (G.dialogue.t > 3.8 || keyPressed('Enter')) {
      G.dialogue.idx++;
      G.dialogue.t = 0;
      if (G.dialogue.idx >= G.dialogue.lines.length) G.dialogue = null;
    }
  }

  // Gulls over the beach, now and then.
  if (G.player.x > 2900 && G.rng.chance(0.004)) sfx('gull');

  updateCamera(G, dt);
}

function updateCamera(G, dt) {
  const focus = G.player.car || G.player;
  const vx = focus === G.player.car ? Math.cos(focus.heading) * focus.speed : (G.player.vx || 0);
  const vy = focus === G.player.car ? Math.sin(focus.heading) * focus.speed : (G.player.vy || 0);
  const tx = clamp(focus.x + vx * 0.42, 640, WORLD_W - 640);
  const ty = clamp(focus.y + vy * 0.42, 360, WORLD_H - 360);
  const k = G.mode === 'title' ? 1 : 1 - Math.pow(0.0015, dt);
  G.camera.x += (tx - G.camera.x) * (G.mode === 'title' ? 1 : k);
  G.camera.y += (ty - G.camera.y) * (G.mode === 'title' ? 1 : k);
}

function clearLaw(G) {
  for (const c of G.cars) if (c.police) c.dead = true;
  G.officers = [];
  G.law.heat = 0;
  G.law.arrestT = 0;
  G.stars = 0;
  sirenSound(false);
  engineSound(false, 0, 0);
}

function triggerBusted(G) {
  const fine = Math.max(40, Math.round(G.cash * 0.12));
  G.cash = Math.max(0, G.cash - fine);
  G.stats.busts++;
  sfx('busted');
  G.card = {
    title: 'BUSTED', subtitle: 'Palm Cay PD',
    lines: [`The cuffs cost you $${fine} in "processing". Your car stays where it stopped.`],
    foot: 'Enter',
  };
  G.mode = 'busted';
}

function triggerWasted(G) {
  const fine = Math.max(30, Math.round(G.cash * 0.10));
  G.cash = Math.max(0, G.cash - fine);
  sfx('wasted');
  G.card = {
    title: 'WASTED', subtitle: 'Hospital San Cay',
    lines: [`You wake up smelling of antiseptic. The bill is $${fine}. The Cay keeps spinning.`],
    foot: 'Enter',
  };
  G.mode = 'wasted';
}

// Enter pressed on a busted/wasted/card screen: back into the world.
export function dismissCard(G) {
  if (G.mode === 'busted') {
    exitCarSilent(G);
    G.player.x = G.city.policeHQ.x; G.player.y = G.city.policeHQ.y;
    G.player.hp = 100;
    clearLaw(G);
  } else if (G.mode === 'wasted') {
    exitCarSilent(G);
    G.player.x = G.city.hospital.x; G.player.y = G.city.hospital.y;
    G.player.hp = 100;
    clearLaw(G);
  }
  G.card = null;
  G.mode = 'play';
}

function exitCarSilent(G) {
  if (G.player.car) {
    G.player.car.driver = 'none';
    G.player.car = null;
  }
}

// Called by main when a run starts (title Enter / Continue).
export function startRun(G, useSave) {
  initAudio();
  if (useSave) G.loadGame();
  G.mode = 'play';
}
