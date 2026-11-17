// cdp.mjs — a minimal Chrome DevTools Protocol client for the local
// puppeteer-cache Chrome, built on Node's own WebSocket and fetch.
// Just enough to navigate, listen for exceptions, press keys, move the
// mouse and take screenshots.
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

export const CHROME_BIN = '/home/hatch/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome';

export async function launchChrome(port) {
  const proc = spawn(CHROME_BIN, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--mute-audio', '--window-size=1280,720',
    `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=/tmp/cdp-profile-${port}`, 'about:blank',
  ], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return proc;
    } catch { /* not up yet */ }
    await wait(200);
  }
  throw new Error('Chrome did not start on port ' + port);
}

export async function connectPage(port) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let nextId = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(msg.error.message));
      else res(msg.result);
    } else {
      for (const f of listeners) f(msg);
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++nextId;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
  return { send, on: (f) => listeners.push(f), close: () => ws.close() };
}

export async function key(page, code, keyName, type = 'keyDown') {
  await page.send('Input.dispatchKeyEvent', {
    type, key: keyName, code, windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0,
  });
}
export async function tapKey(page, code, keyName) {
  await key(page, code, keyName, 'keyDown');
  await key(page, code, keyName, 'keyUp');
}
export async function mouseClick(page, x, y) {
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}
export { wait };
