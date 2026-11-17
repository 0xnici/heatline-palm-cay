// input.js — keyboard and mouse state, polled by the simulation each
// tick. Keys are tracked by code so layout does not matter; presses that
// mean "do it now" (enter a car, pause, confirm) are edge-triggered and
// consumed by whoever reads them first.

const held = new Set();
const pressed = new Set();
const mouse = { x: 0, y: 0, down: false, clicked: false };

export function bindInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => { held.clear(); mouse.down = false; });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { mouse.down = true; mouse.clicked = true; } });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function endFrameInput() {
  pressed.clear();
  mouse.clicked = false;
}

export function keyHeld(...codes) { return codes.some((c) => held.has(c)); }
export function keyPressed(...codes) { return codes.some((c) => pressed.has(c)); }
export function getMouse() { return mouse; }

// Movement axes in screen space: x right, y down.
export function moveAxes() {
  let x = 0, y = 0;
  if (keyHeld('KeyA', 'ArrowLeft')) x -= 1;
  if (keyHeld('KeyD', 'ArrowRight')) x += 1;
  if (keyHeld('KeyW', 'ArrowUp')) y -= 1;
  if (keyHeld('KeyS', 'ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
  return { x, y };
}
export function driveAxes() {
  // For cars W/S are throttle and brake, not a direction to walk.
  return {
    throttle: keyHeld('KeyW', 'ArrowUp') ? 1 : 0,
    brake: keyHeld('KeyS', 'ArrowDown') ? 1 : 0,
    steer: (keyHeld('KeyA', 'ArrowLeft') ? -1 : 0) + (keyHeld('KeyD', 'ArrowRight') ? 1 : 0),
  };
}
