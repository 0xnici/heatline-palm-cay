// Screenshot capture for HEATLINE: Palm Cay. Drives the standalone Chrome
// over CDP (Node stdlib fetch + WebSocket only), loads each ?shot= scene
// from shots.json at 1280x720, waits for window.__shotReady, and saves the
// JPEG into screenshots/. Usage: node tools/capture.mjs [port]
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CHROME = join(homedir(), '.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome');
const GAME_PORT = process.argv[2] ?? '8091';
const CDP = 9444;
const scenes = JSON.parse(readFileSync(new URL('../shots.json', import.meta.url), 'utf8'));
if (!existsSync(CHROME)) throw new Error(`chrome not found at ${CHROME}`);
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${CDP}`, '--window-size=1280,720', '--force-device-scale-factor=1', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitDebugger() {
  for (let i = 0; i < 60; i += 1) {
    try { const r = await fetch(`http://127.0.0.1:${CDP}/json/version`); if (r.ok) return; } catch { /* up yet */ }
    await sleep(250);
  }
  throw new Error('chrome debugger never came up');
}
let nextId = 1; const pending = new Map(); let ws;
function send(method, params = {}) {
  const id = nextId++;
  return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
}
await waitDebugger();
const tabRes = await fetch(`http://127.0.0.1:${CDP}/json/new?about:blank`, { method: 'PUT' });
const tab = await tabRes.json();
ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
});
await send('Page.enable'); await send('Runtime.enable');
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 800));
  return r.result.value;
}
for (const scene of scenes) {
  await send('Page.navigate', { url: `http://127.0.0.1:${GAME_PORT}/${scene.query}` });
  const start = Date.now();
  for (;;) {
    const ready = await evaluate('window.__shotReady === true').catch(() => false);
    if (ready) break;
    if (Date.now() - start > 30000) throw new Error(`timeout on ${scene.name}`);
    await sleep(200);
  }
  await sleep(120);
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 86 });
  const path = new URL(`../screenshots/${scene.name}`, import.meta.url);
  writeFileSync(path, Buffer.from(shot.data, 'base64'));
  console.log('captured', scene.name);
}
chrome.kill();
process.exit(0);
