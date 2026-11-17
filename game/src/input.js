// Keyboard and mouse input. Held state is polled each step; one-shot presses
// queue as bit flags so a tap between frames is never lost or doubled.
export const ACT_ENTER = 1; export const ACT_PAUSE = 2; export const ACT_CONFIRM = 4; export const ACT_MELEE = 8;
export function createInput(canvas) {
  const held = new Set(); let actions = 0;
  const mouse = { x: 0, y: 0, down: false };
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    held.add(e.code);
    if (!e.repeat) {
      if (e.code === 'KeyE') actions |= ACT_ENTER;
      if (e.code === 'KeyF') actions |= ACT_MELEE;
      if (e.code === 'KeyP' || e.code === 'Escape') actions |= ACT_PAUSE;
      if (e.code === 'Enter' || e.code === 'Space') actions |= ACT_CONFIRM;
    }
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => { held.clear(); mouse.down = false; });
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 1280; mouse.y = ((e.clientY - r.top) / r.height) * 720;
  });
  canvas.addEventListener('pointerdown', (e) => { if (e.button === 0) { mouse.down = true; actions |= ACT_CONFIRM; } });
  window.addEventListener('pointerup', () => { mouse.down = false; });
  return {
    held, mouse,
    down(...codes) { return codes.some((c) => held.has(c)); },
    moveX() { return (this.down('KeyD', 'ArrowRight') ? 1 : 0) - (this.down('KeyA', 'ArrowLeft') ? 1 : 0); },
    moveY() { return (this.down('KeyS', 'ArrowDown') ? 1 : 0) - (this.down('KeyW', 'ArrowUp') ? 1 : 0); },
    takeActions() { const t = actions; actions = 0; return t; },
  };
}
