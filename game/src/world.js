// The simulation: player, traffic, pedestrians, police, thugs, missions,
// wanted heat, taxi fares and packages — every rule of Palm Cay in one step.
// No drawing and no DOM here; main.js feeds input in and render.js paints
// the state out. Events come back as flags so sound and screens stay loose.
import { PLAYER, VIEW, WANTED, WORLD } from './config.js';
import { createCity, collideCircle, districtAt } from './city.js';
import { createCar, spawnParkedCars, spawnTraffic, driveCar, trafficThink, collideCars } from './vehicles.js';
import { spawnPedestrians, stepPedestrian, createPedestrian } from './pedestrians.js';
import { forceForStars, policeThink, spawnPoliceCar, stepOfficer, wantedStars } from './police.js';
import { createCombat, stepCombat, tryPlayerShot, tryMelee, burst } from './combat.js';
import * as M from './missions.js';
import { clamp, distance } from './random.js';

export const EV_CRIME = 1; export const EV_SHOT = 2; export const EV_CRASH = 4; export const EV_CASH = 8;
export const EV_CARD = 16; export const EV_BUSTED = 32; export const EV_WASTED = 64; export const EV_DOOR = 128;

export function createWorld(random, saved) {
  const city = createCity(random);
  if (saved?.packages) city.packages.forEach((p, i) => { p.taken = !!saved.packages[i]; });
  const player = {
    x: 1560, y: 620, angle: 0, health: PLAYER.health, car: null,
    cash: saved?.cash ?? 120, respect: saved?.respect ?? 0,
    heat: 0, unseen: 0, bust: 0, dead: false, aimAngle: 0, walkPhase: 0, punchTimer: 0,
    shirt: '#ff6b35', skin: '#f2c9a0', speed: 0,
  };
  const cars = [...spawnParkedCars(city, random, 26), ...spawnTraffic(random, 13)];
  const peds = spawnPedestrians(random, 34);
  const state = {
    city, player, cars, peds, officers: [], thugs: [],
    combat: createCombat(), missions: M.createMissionState(saved),
    clock: 10 * 60 + 20, elapsed: 0, camera: { x: player.x, y: player.y },
    district: 'Downtown Cay', banner: null, bannerTime: 0, dialogue: null, dialogueTime: 0,
    shake: 0, taxiTimer: 0, muted: false, lastCrime: null,
  };
  // Job 2's stolen truck waits in the Cannery.
  const truck = createCar(random, 700, 1240, 0, 'parked');
  truck.model = { name: 'Freezer Truck', topSpeed: 238, accel: 150, grip: 2.5, len: 56, wid: 27, colors: ['#e0fbfc'] };
  truck.color = '#e0fbfc'; truck.isTruck = true; cars.push(truck); state.truck = truck;

  function witnesses(x, y, range) {
    let n = 0;
    for (const p of peds) if (!p.dead && distance(x, y, p.x, p.y) < range) n += 1;
    for (const c of cars) if (c.kind === 'police' && distance(x, y, c.x, c.y) < range + 120) n += 2;
    return n;
  }
  /** A crime only heats the player when someone plausibly saw it. */
  function crime(x, y, amount, always = 0) {
    const w = witnesses(x, y, 300);
    const gain = always + (w > 0 ? amount : amount * 0.25);
    player.heat = clamp(player.heat + gain, 0, WANTED.max);
    state.lastCrime = { x, y };
    return gain;
  }
  function say(line, seconds = 4) { state.dialogue = line; state.dialogueTime = seconds; }
  function banner(text, sub = '') { state.banner = { text, sub }; state.bannerTime = 3.4; }

  function nearestCar(x, y, maxD) {
    let best = null; let bd = maxD;
    for (const c of cars) { const d = distance(x, y, c.x, c.y); if (d < bd) { bd = d; best = c; } }
    return best;
  }
  function enterExit(audio) {
    if (player.car) {
      const c = player.car; player.car = null;
      player.x = c.x + Math.cos(c.angle + Math.PI / 2) * 30; player.y = c.y + Math.sin(c.angle + Math.PI / 2) * 30;
      audio.door(); return EV_DOOR;
    }
    const c = nearestCar(player.x, player.y, 52);
    if (!c || c.dead) return 0;
    let ev = EV_DOOR;
    if (c.driver === 'ai') { // pull the driver out of a stopped car
      const ped = createPedestrian(random, c.x + 26, c.y + 10);
      ped.panic = 3; peds.push(ped);
      if (Math.abs(c.speed) < 40) { crime(c.x, c.y, 0.9); ev |= EV_CRIME; }
    }
    if (c.kind === 'parked' && !c.everStolen) { c.everStolen = true; crime(c.x, c.y, 0.8); ev |= EV_CRIME; }
    c.driver = 'player'; player.car = c; audio.door();
    if (state.missions.taxi === null && c.model.name !== 'PCPD Interceptor' && random() < 0.3) startTaxiOffer();
    return ev;
  }
  function startTaxiOffer() {
    const from = M.TAXI_SPOTS[Math.floor(random() * M.TAXI_SPOTS.length)];
    const to = M.TAXI_SPOTS[Math.floor(random() * M.TAXI_SPOTS.length)];
    state.missions.taxi = { phase: 'pickup', x: from[0], y: from[1], dx: to[0], dy: to[1], fare: 60 + Math.floor(distance(from[0], from[1], to[0], to[1]) / 22) };
    say('Dispatch: fare waiting at the ◆ — cab work pays clean cash.');
  }
  function spawnThugs(x, y, count) {
    for (let i = 0; i < count; i += 1) {
      const t = createPedestrian(random, x + (random() - 0.5) * 190, y + (random() - 0.5) * 190);
      t.thug = true; t.health = 78; t.shirt = '#22223b'; state.thugs.push(t);
    }
  }
  function missionStep(dt, audio) {
    const ms = state.missions;
    // Taxi runs alongside the story.
    if (ms.taxi) {
      const t = ms.taxi;
      const px = player.car ? player.car.x : player.x; const py = player.car ? player.car.y : player.y;
      if (t.phase === 'pickup' && player.car && distance(px, py, t.x, t.y) < 60 && Math.abs(player.car.speed) < 24) {
        t.phase = 'drop'; say('Passenger: The flag, please — and step on it.');
      } else if (t.phase === 'drop' && player.car && distance(px, py, t.dx, t.dy) < 60 && Math.abs(player.car.speed) < 24) {
        player.cash += t.fare; player.respect += 1; banner('FARE PAID', `+$${t.fare} · +1 respect`);
        audio.cash(); ms.taxi = null; return EV_CASH;
      }
      if (!player.car && t.phase === 'drop') { ms.taxi = null; say('Dispatch: fare lost — they walked.'); }
    }
    const job = M.currentJob(ms);
    if (!ms.active) {
      if (job) {
        const mk = M.jobMarker(ms);
        if (mk && distance(player.x, player.y, mk.x, mk.y) < 46 && !player.car) {
          const card = M.startJob(ms);
          state.pendingCard = { kind: 'intro', title: card.title, lines: card.lines };
          if (ms.stage.kind === 'shootout') spawnThugs(ms.stage.x, ms.stage.y, ms.stage.count);
          if (ms.stage.crime) crime(player.x, player.y, ms.stage.crime, ms.stage.crime);
          return EV_CARD;
        }
      }
      return 0;
    }
    const s = ms.stage; if (!s) return 0;
    ms.stageTime += dt;
    if (ms.timer > 0) {
      ms.timer -= dt;
      if (ms.timer <= 0 && (s.kind === 'deliver' || s.kind === 'getaway')) {
        M.failJob(ms, 'Out of time'); banner('JOB FAILED', 'Out of time — the fixer cools off. Try again at the ◆.');
        audio.jingle(false); return EV_CARD;
      }
    }
    const px = player.car ? player.car.x : player.x; const py = player.car ? player.car.y : player.y;
    let doneStage = false;
    if (s.kind === 'goto' && distance(px, py, s.x, s.y) < 52) doneStage = true;
    else if (s.kind === 'pickup' && !player.car && distance(player.x, player.y, s.x, s.y) < 40 && ms.stageTime > 0.4) {
      if (s.seconds > 3.5 && ms.stageTime < s.seconds) { /* hold to grab */ } else doneStage = true;
      if (s.crime && !s.crimeDone) { s.crimeDone = true; crime(player.x, player.y, s.crime, s.crime); }
    } else if (s.kind === 'deliver' && distance(px, py, s.x, s.y) < 58 && (!s.needCar || player.car) && Math.abs(player.car?.speed ?? 0) < 30) doneStage = true;
    else if (s.kind === 'getaway' && distance(px, py, s.x, s.y) < 70) doneStage = true;
    else if (s.kind === 'escape' && wantedStars(player.heat) === 0) doneStage = true;
    else if (s.kind === 'shootout' && ms.kills >= s.count) doneStage = true;
    if (doneStage) {
      const res = M.advanceStage(ms);
      if (res.completed) {
        player.cash += res.completed.cash; player.respect += res.completed.respect;
        banner('JOB COMPLETE', `${res.completed.title} · +$${res.completed.cash} · +${res.completed.respect} respect`);
        say(res.completed.line, 5); audio.jingle(true);
        state.pendingCard = { kind: 'done', title: res.completed.title, lines: [res.completed.line, `Paid $${res.completed.cash} · Respect +${res.completed.respect}`] };
        if (ms.storyDone) state.pendingCard = { kind: 'ending', title: 'HEATLINE COMPLETE', lines: ['You ran every job in Palm Cay.', `Final take: $${player.cash} · Respect ${player.respect}`, 'Free roam: taxi fares and packages remain.'] };
        return EV_CARD | EV_CASH;
      }
      if (res.next?.kind === 'shootout') spawnThugs(res.next.x, res.next.y, res.next.count);
      banner('OBJECTIVE UPDATED', res.next ? res.next.label : '');
      audio.pickup();
    }
    return 0;
  }

  function step(dt, input, audio) {
    let ev = 0;
    state.elapsed += dt; state.clock += dt * 0.7;
    if (state.bannerTime > 0) state.bannerTime -= dt;
    if (state.dialogueTime > 0) state.dialogueTime -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);
    const actions = input ? input.takeActions() : 0;
    // --- player on foot / in car
    const speedBefore = player.car ? Math.abs(player.car.speed) : 0;
    if (actions & 1) ev |= enterExit(audio);
    if (player.car) {
      const c = player.car;
      const throttle = (input?.down('KeyW', 'ArrowUp') ? 1 : 0) - (input?.down('KeyS', 'ArrowDown') ? 1 : 0);
      const steer = (input?.down('KeyD', 'ArrowRight') ? 1 : 0) - (input?.down('KeyA', 'ArrowLeft') ? 1 : 0);
      driveCar(c, dt, throttle, steer);
      player.x = c.x; player.y = c.y; player.angle = c.angle;
      audio.engine(Math.abs(c.speed) / c.model.topSpeed, dt);
      if (Math.abs(c.speed) > 250) crime(c.x, c.y, 0.004);
    } else {
      audio.engine(0, dt);
      const mx = input ? input.moveX() : 0; const my = input ? input.moveY() : 0;
      const sprint = input?.down('ShiftLeft', 'ShiftRight');
      const sp = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
      if (mx || my) {
        const len = Math.hypot(mx, my); player.angle = Math.atan2(my, mx);
        player.x += (mx / len) * sp * dt; player.y += (my / len) * sp * dt;
        player.walkPhase += dt * (sprint ? 13 : 9);
      }
      const holder = { x: player.x, y: player.y, hitWall: false };
      collideCircle(city, holder, PLAYER.radius); player.x = holder.x; player.y = holder.y;
      // aim + combat
      if (input) {
        const cam = state.camera;
        player.aimAngle = Math.atan2(cam.y + (input.mouse.y - VIEW.height / 2) - player.y, cam.x + (input.mouse.x - VIEW.width / 2) - player.x);
        if (input.mouse.down && tryPlayerShot(state.combat, player, player.aimAngle, audio)) { ev |= EV_SHOT; crime(player.x, player.y, 0.55); }
        if (actions & 8) { player.punchTimer = 0.25; const targets = [...peds, ...state.thugs, ...state.officers]; if (tryMelee(state.combat, player, targets, audio)) { crime(player.x, player.y, 0.5); ev |= EV_CRIME; } }
      }
      if (player.punchTimer > 0) player.punchTimer -= dt;
    }
    void speedBefore;
    // --- traffic & parked cars
    for (const c of cars) {
      if (c === player.car || c.dead) continue;
      if (c.kind === 'traffic') {
        if (distance(c.x, c.y, player.x, player.y) > 1500) continue;
        const t = trafficThink(c, dt, cars, random);
        driveCar(c, dt, t.throttle, t.steer);
      } else if (c.kind === 'police') { /* stepped below */ }
    }
    // --- police force level
    const stars = wantedStars(player.heat);
    const force = forceForStars(stars);
    const copCars = cars.filter((c) => c.kind === 'police' && !c.dead);
    if (stars > 0 && copCars.length < force.cars && random() < dt * 1.4) {
      const nc = spawnPoliceCar(random, player); cars.push(nc);
    }
    for (const c of copCars) {
      const pv = { x: player.x, y: player.y, vx: player.car ? Math.cos(player.car.angle) * player.car.speed : 0, vy: player.car ? Math.sin(player.car.angle) * player.car.speed : 0 };
      const t = policeThink(c, dt, pv, player.car ? Math.abs(player.car.speed) : 0);
      driveCar(c, dt, t.throttle, t.steer);
      c.x = clamp(c.x, 30, WORLD.width - 30); c.y = clamp(c.y, 30, WORLD.height - 30);
    }
    if (stars > 0 && state.officers.length < force.officers && random() < dt) {
      const p = createPedestrian(random, player.x + (random() - 0.5) * 500, player.y + (random() - 0.5) * 500);
      p.officer = true; p.shirt = '#274690'; state.officers.push(p);
    }
    state.officers = state.officers.filter((o) => !o.dead);
    if (stars === 0) state.officers.length = 0;
    for (const o of state.officers) {
      const d = stepOfficer(o, dt, player);
      if (d < 120 && stars >= 4 && random() < dt * 1.6) { // officers shoot at high heat
        const a = Math.atan2(player.y - o.y, player.x - o.x);
        state.combat.bullets.push({ x: o.x, y: o.y, vx: Math.cos(a) * 820, vy: Math.sin(a) * 820, life: 0.5, fromPlayer: false, damage: 7 });
        audio.shot();
      }
    }
    audio.siren(stars > 0 && copCars.length > 0, state.elapsed);
    // collisions
    const impact = collideCars(cars, city, player.car);
    if (impact > 60) {
      ev |= EV_CRASH; state.shake = Math.min(14, impact / 16); audio.crash();
      if (player.car) { player.health -= impact * 0.03; crime(player.x, player.y, 0.5); }
    }
    // cars running over peds / player car damage
    for (const c of cars) {
      if (Math.abs(c.speed) < 30 || c.dead) continue;
      for (const p of [...peds, ...state.thugs]) {
        if (p.dead) continue;
        if (distance(c.x, c.y, p.x, p.y) < 26) {
          p.health -= 60; p.dead = true; burst(state.combat, p.x, p.y, '#ef476f', 10, 150);
          if (c === player.car) { crime(c.x, c.y, 1.1, 0.3); player.respect = Math.max(0, player.respect - 1); ev |= EV_CRIME; }
        }
      }
    }
    // --- pedestrians & thugs
    const danger = (state.combat.muzzle > 0 || impact > 60) ? { x: player.x, y: player.y } : (player.car && Math.abs(player.car.speed) > 240 ? { x: player.x, y: player.y } : null);
    for (const p of peds) stepPedestrian(p, dt, random, danger, city);
    for (const t of state.thugs) {
      if (t.dead) continue;
      const d = distance(t.x, t.y, player.x, player.y);
      t.angle = Math.atan2(player.y - t.y, player.x - t.x);
      if (d > 150) { t.x += Math.cos(t.angle) * 120 * dt; t.y += Math.sin(t.angle) * 120 * dt; }
      t.fireTimer -= dt;
      if (d < 330 && t.fireTimer <= 0) {
        t.fireTimer = 0.7 + random() * 0.6;
        state.combat.bullets.push({ x: t.x, y: t.y, vx: Math.cos(t.angle) * 820, vy: Math.sin(t.angle) * 820, life: 0.5, fromPlayer: false, damage: 8 });
        audio.shot();
      }
    }
    // --- combat resolution
    const targets = [...state.thugs, ...peds, ...state.officers, ...cars.filter((c) => c.kind === 'police')];
    const cev = stepCombat(state.combat, dt, city, targets, { x: player.x, y: player.y, car: player.car });
    if (cev.hitPlayer > 0) player.health -= cev.hitPlayer;
    for (const k of cev.killed) {
      if (k.thug) { state.missions.kills += 1; player.cash += 25; burst(state.combat, k.x, k.y, '#ffd166', 8, 120); }
      if (k.officer) crime(player.x, player.y, 1.2, 0.6);
      if (k.isCar || k.model) { /* police car disabled */ }
      if (!k.thug && !k.officer && k.shirt) { crime(player.x, player.y, 1.0, 0.4); player.respect = Math.max(0, player.respect - 2); }
    }
    state.thugs = state.thugs.filter((t) => !t.dead || t.down < 900);
    // --- packages
    for (const pk of city.packages) {
      if (!pk.taken && !player.car && distance(player.x, player.y, pk.x, pk.y) < 26) {
        pk.taken = true; state.missions.packagesFound += 1; player.cash += 150;
        banner('HIDDEN PACKAGE', `${state.missions.packagesFound}/12 · +$150`); audio.pickup(); ev |= EV_CASH;
      }
    }
    // --- wanted cooling + bust
    let seen = false;
    for (const c of copCars) if (distance(c.x, c.y, player.x, player.y) < WANTED.sightRange) seen = true;
    for (const o of state.officers) if (distance(o.x, o.y, player.x, player.y) < 240) seen = true;
    if (stars > 0 && !seen) { player.unseen += dt; if (player.unseen > 1.2) player.heat = Math.max(0, player.heat - WANTED.coolPerSecond * dt * 3); }
    else player.unseen = 0;
    if (!player.car && stars > 0) {
      let nearCop = false;
      for (const o of state.officers) if (distance(o.x, o.y, player.x, player.y) < WANTED.bustRadius + 8) nearCop = true;
      for (const c of copCars) if (distance(c.x, c.y, player.x, player.y) < 52 && Math.abs(c.speed) < 40) nearCop = true;
      if (nearCop) { player.bust += dt; if (player.bust >= WANTED.bustSeconds) { ev |= EV_BUSTED; } }
      else player.bust = Math.max(0, player.bust - dt * 2);
    } else player.bust = 0;
    if (player.health <= 0) { player.health = 0; ev |= EV_WASTED; }
    ev |= missionStep(dt, audio);
    state.markerPos = M.jobMarker(state.missions);
    // --- camera: follow with speed look-ahead
    const lead = player.car ? clamp(Math.abs(player.car.speed) / 900, 0, 0.3) : 0;
    const tx = player.x + (player.car ? Math.cos(player.car.angle) * Math.abs(player.car.speed) * lead : 0);
    const ty = player.y + (player.car ? Math.sin(player.car.angle) * Math.abs(player.car.speed) * lead : 0);
    state.camera.x += (tx - state.camera.x) * Math.min(1, dt * 4.2);
    state.camera.y += (ty - state.camera.y) * Math.min(1, dt * 4.2);
    state.camera.x = clamp(state.camera.x, VIEW.width / 2 - 200, WORLD.width - VIEW.width / 2 + 200);
    state.camera.y = clamp(state.camera.y, VIEW.height / 2 - 160, WORLD.height - VIEW.height / 2 + 160);
    state.district = districtAt(player.x, player.y);
    audio.music(dt, true);
    return ev;
  }
  function respawn(kind) {
    player.health = PLAYER.health; player.heat = 0; player.bust = 0; player.car = null;
    player.x = 1560; player.y = 620;
    if (kind === 'busted') player.cash = Math.max(0, player.cash - 200);
    else player.cash = Math.max(0, player.cash - 120);
    for (let i = cars.length - 1; i >= 0; i -= 1) if (cars[i].kind === 'police') cars.splice(i, 1);
    state.officers.length = 0; state.thugs.length = 0;
    if (state.missions.active) M.failJob(state.missions, kind);
  }
  return { state, step, respawn, say, banner };
}
