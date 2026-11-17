// main.js — boot and the frame loop. Builds the game, binds input,
// runs the simulation at a clamped step, draws the world, the HUD and
// whichever screen the mode calls for. In ?shot= mode it stages one of
// the deterministic scenes instead and holds the frame for capture.

import { createGame, stepGame, startRun, dismissCard } from './world.js';
import { drawWorld } from './render.js';
import { drawHUD, drawMenus } from './hud.js';
import { bindInput, endFrameInput, keyPressed } from './input.js';
import { toggleMute } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7);
const shot = params.get('shot');

const G = createGame(seed);
bindInput(canvas);

if (shot) {
  stageShot(G, shot);
  // Hold the staged frame; only the light's small animations move.
  const hold = () => {
    G.time += 1 / 30;
    drawWorld(ctx, G);
    if (G.mode === 'play') drawHUD(ctx, G);
    drawMenus(ctx, G);
    requestAnimationFrame(hold);
  };
  hold();
} else {
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;

    // Menu keys are handled before the step so a press is spent once.
    if (G.mode === 'title') {
      if (keyPressed('Enter')) startRun(G, false);
      else if (keyPressed('KeyC') && G.hasSave) startRun(G, true);
    } else if (G.mode === 'card' || G.mode === 'busted' || G.mode === 'wasted' || G.mode === 'ending') {
      if (keyPressed('Enter')) dismissCard(G);
    } else if (G.mode === 'play' && keyPressed('KeyP', 'Escape')) {
      G.mode = 'pause';
    } else if (G.mode === 'pause' && keyPressed('KeyP', 'Escape', 'Enter')) {
      G.mode = 'play';
    }
    if (keyPressed('KeyM')) toggleMute();

    stepGame(G, dt);
    drawWorld(ctx, G);
    if (G.mode !== 'title') drawHUD(ctx, G);
    drawMenus(ctx, G);
    endFrameInput();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
