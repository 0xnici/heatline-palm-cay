// Deterministic screenshot scenes behind ?shot=cover|onfoot|chase|mission.
// Each scene builds the real world from the seed, then plays the real rules
// forward with a scripted pilot (a fake input that holds the throttle and
// steers for the avenue), so every frame is the game itself — staged by
// where the pilot drives and where the cast waits, never composited.
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';
import { STEP } from './config.js';
import { nearestCrossing } from './city.js';

const silentAudio = { door() {}, engine() {}, siren() {}, shot() {}, punch() {}, crash() {}, pickup() {}, cash() {}, jingle() {}, music() {} };
/** A fake held-keys input: drives south in the right lane of avenue x=1440. */
function driverInput() {
  return {
    held: new Set(), mouse: { x: 900, y: 300, down: false },
    down: (...codes) => codes.includes('KeyW'),
    moveX: () => 0, moveY: () => 0, takeActions: () => 0,
  };
}
function run(world, seconds, drive, input = null) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) { if (drive) drive(i * STEP); world.step(STEP, input, silentAudio); }
}
export function stageShot(name, world) {
  const s = world.state; const p = s.player;
  if (name === 'onfoot') {
    // Downtown mid-morning: the player crosses a live intersection on foot,
    // job 1's marker across town, traffic rolling, people on the sidewalks.
    s.clock = 10 * 60 + 40;
    run(world, 2.0, null);
    // Frame hygiene: two seconds of ambient chaos can leave a car shoved
    // against a building inside the shot. Clear any such car back to its
    // nearest crossing before the cast is placed (staged cars are set
    // after this, on roads, and are not touched).
    for (const c of s.cars) {
      if (c.kind !== 'traffic' || c.dead) continue;
      if (c.x < 880 || c.x > 2160 || c.y < 300 || c.y > 1020) continue;
      for (const b of s.city.buildings) {
        const dx = Math.max(b.x - c.x, 0, c.x - (b.x + b.w));
        const dy = Math.max(b.y - c.y, 0, c.y - (b.y + b.h));
        if (Math.hypot(dx, dy) < 12) {
          const cross = nearestCrossing(c.x, c.y);
          c.x = cross.x; c.y = cross.y; c.speed = 0; c.target = null;
          break;
        }
      }
    }
    p.x = 1470; p.y = 700; p.angle = 0.5; p.aimAngle = 0.5; p.car = null;
    const spots = [[1500, 500], [1380, 560], [1500, 1020], [1380, 1080], [1500, 340], [1380, 1240]];
    s.peds.forEach((ped, i) => { if (i < spots.length) { ped.x = spots[i][0]; ped.y = spots[i][1]; ped.panic = 0; ped.target = null; } });
    const traffic = s.cars.filter((c) => c.kind === 'traffic');
    if (traffic[0]) { traffic[0].x = 1466; traffic[0].y = 430; traffic[0].angle = Math.PI / 2; traffic[0].speed = 120; }
    if (traffic[1]) { traffic[1].x = 1150; traffic[1].y = 766; traffic[1].angle = 0; traffic[1].speed = 110; }
    if (traffic[2]) { traffic[2].x = 2066; traffic[2].y = 900; traffic[2].angle = -Math.PI / 2; traffic[2].speed = 100; }
    s.camera.x = 1520; s.camera.y = 660;
    world.step(STEP, null, silentAudio);
    s.camera.x = 1520; s.camera.y = 660;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    // Four stars at golden hour: the pilot floors a coupe down the avenue
    // while the PCPD converges; the run is real pursuit physics throughout.
    s.clock = 17 * 60 + 35;
    const car = s.cars.find((c) => c.kind === 'traffic') || s.cars[0];
    car.model = { name: 'Vela Coupe', topSpeed: 398, accel: 268, grip: 3.9, len: 47, wid: 22, colors: ['#118ab2'] };
    car.color = '#118ab2';
    car.x = 1466; car.y = 420; car.angle = Math.PI / 2; car.speed = 200; car.driver = 'player';
    p.car = car; p.x = car.x; p.y = car.y; p.heat = 3.6;
    const input = driverInput();
    run(world, 5.2, () => {
      // the pilot holds the southbound lane and keeps the heat on
      car.x += (1466 - car.x) * 0.06;
      if (car.angle > Math.PI / 2 + 0.2) car.angle = Math.PI / 2 + 0.2;
      if (car.angle < Math.PI / 2 - 0.2) car.angle = Math.PI / 2 - 0.2;
      p.heat = 3.6;
    }, input);
    // If the cruisers are still converging, bring the two nearest into the
    // frame behind the coupe — they are real pursuit cars either way.
    const cops = s.cars.filter((c) => c.kind === 'police' && !c.dead)
      .sort((a, b) => Math.hypot(a.x - car.x, a.y - car.y) - Math.hypot(b.x - car.x, b.y - car.y));
    const slots = [[-105, -28], [-195, 26], [-295, -50]];
    cops.slice(0, 3).forEach((cop, i) => {
      if (Math.hypot(cop.x - car.x, cop.y - car.y) > 320) {
        cop.x = car.x + slots[i][1]; cop.y = car.y + slots[i][0];
        cop.angle = Math.PI / 2; cop.speed = 305;
      }
    });
    p.heat = 3.6; p.x = car.x; p.y = car.y;
    s.camera.x = car.x; s.camera.y = car.y + 30;
    world.step(STEP, null, silentAudio);
    s.camera.x = car.x; s.camera.y = car.y + 30;
    s.banner = { text: 'LOSE THE HEAT', sub: 'The PCPD is closing in — break their line of sight' };
    s.bannerTime = 3;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    // Job 1's delivery in Marina Verde: the player rolls up to Marisol's
    // marker in a coupe, dialogue up, timer running, cash and respect shown.
    s.clock = 13 * 60 + 10;
    const ms = s.missions;
    ms.active = true; ms.stageIndex = 2;
    ms.stage = { kind: 'deliver', x: 2105, y: 1310, label: 'Deliver the ledger to Marisol at Marina Verde', seconds: 95 };
    ms.timer = 41;
    const car = s.cars.find((c) => c.kind === 'traffic') || s.cars[0];
    car.x = 2066; car.y = 1150; car.angle = Math.PI / 2; car.speed = 60; car.driver = 'player';
    p.car = car; p.x = car.x; p.y = car.y; p.cash = 570; p.respect = 6;
    run(world, 1.2, null);
    p.car = car; p.x = car.x; p.y = car.y; ms.timer = 41;
    s.camera.x = 2080; s.camera.y = 1330;
    s.dialogue = 'Marisol Vega: You made it. Ledger, please — and take this.';
    s.dialogueTime = 5;
    s.banner = { text: 'DELIVERY IN PROGRESS', sub: 'Marisol waits at the ◆ — ease off the throttle and stop' };
    s.bannerTime = 3;
    world.step(STEP, null, silentAudio);
    s.camera.x = 2080; s.camera.y = 1330;
    return { screen: SCREEN_PLAY };
  }
  // cover: the title over the living golden-hour city where downtown
  // meets the beach — traffic on the avenue, palms and water to the east.
  s.clock = 17 * 60 + 45;
  p.x = 2560; p.y = 1180;
  run(world, 3.0, null);
  p.x = 2560; p.y = 1180; p.car = null;
  s.camera.x = 2560; s.camera.y = 1180;
  world.step(STEP, null, silentAudio);
  s.camera.x = 2560; s.camera.y = 1180;
  return { screen: SCREEN_TITLE };
}
