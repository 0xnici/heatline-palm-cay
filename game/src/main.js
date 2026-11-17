// Boot and the one loop for HEATLINE: Palm Cay. Fixed-step simulation,
// screens (title, play, pause, mission cards, busted, wasted), localStorage
// saves with Continue, and the ?shot= staging used for the screenshots.
import { STEP, SAVE_KEY } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EV_BUSTED, EV_WASTED, EV_CARD } from './world.js';
import { createInput, ACT_PAUSE, ACT_CONFIRM } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_CARD, SCREEN_BUSTED, SCREEN_WASTED } from './render.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261117;
const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();

function readSave() {
  try { const raw = window.localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
function writeSave(world) {
  try {
    const s = world.state;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: s.player.cash, respect: s.player.respect,
      jobIndex: s.missions.jobIndex, storyDone: s.missions.storyDone,
      packagesFound: s.missions.packagesFound, packages: s.city.packages.map((p) => p.taken),
    }));
  } catch { /* private window: progress lasts the visit */ }
}

if (shot) {
  const world = createWorld(createRandom(seed), null);
  const renderer = createRenderer(canvas);
  const scene = stageShot(shot, world);
  let painted = 0;
  const paint = () => {
    renderer.draw(world.state, scene.screen, { hasSave: false });
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint); else window.__shotReady = true;
  };
  requestAnimationFrame(paint);
} else {
  let saved = readSave();
  let world = createWorld(createRandom(seed), saved);
  const renderer = createRenderer(canvas);
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let card = null;
  let accumulator = 0; let last = performance.now();
  const announce = (m) => { status.textContent = m; };

  function newGame() {
    saved = null;
    try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    world = createWorld(createRandom(seed), null);
    screen = SCREEN_PLAY; announce('New game in Palm Cay.');
  }
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, 0.25); last = now;
    // world.step consumes the queued one-shot actions itself via input.
    if (screen === SCREEN_TITLE) {
      if (input.held.has('Enter')) { audio.unlock(); screen = SCREEN_PLAY; announce('Playing.'); }
      else if (input.held.has('KeyN')) { audio.unlock(); newGame(); }
      world.step(STEP, null, audio);
    } else if (screen === SCREEN_PLAY) {
      if (input.held.has('KeyM')) { input.held.delete('KeyM'); const m = audio.toggleMute(); announce(m ? 'Muted.' : 'Sound on.'); }
      let steps = 0;
      while (accumulator >= STEP && steps < 5) {
        const ev = world.step(STEP, input, audio);
        accumulator -= STEP; steps += 1;
        if (ev & EV_CARD && world.state.pendingCard) { card = world.state.pendingCard; world.state.pendingCard = null; screen = SCREEN_CARD; break; }
        if (ev & EV_BUSTED) { world.respawn('busted'); screen = SCREEN_BUSTED; writeSave(world); break; }
        if (ev & EV_WASTED) { world.respawn('wasted'); screen = SCREEN_WASTED; writeSave(world); break; }
      }
      if (steps > 0 && Math.random() < 0.01) writeSave(world);
    } else if (screen === SCREEN_PAUSED) {
      if (input.held.has('KeyP') || input.held.has('Escape')) screen = SCREEN_PLAY;
    } else if (screen === SCREEN_CARD || screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      if (input.held.has('Enter')) { screen = SCREEN_PLAY; card = null; writeSave(world); }
    }
    // pause toggle from held keys (edge-ish: clear after use)
    if (screen === SCREEN_PLAY && input.held.has('KeyP')) { input.held.delete('KeyP'); screen = SCREEN_PAUSED; }
    renderer.draw(world.state, screen, { hasSave: !!saved, card });
    if (screen !== SCREEN_PLAY) accumulator = 0;
  }
  announce('HEATLINE: Palm Cay. Press Enter to start.');
  requestAnimationFrame(frame);
}
