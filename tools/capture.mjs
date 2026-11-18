// capture.mjs — batch screenshot tool for HEATLINE: Palm Cay.
//
// The game server is expected to be running already. This script boots a
// standalone headless Chrome, talks to it over the DevTools protocol using
// nothing but Node's built-in fetch and WebSocket, then walks every scene
// listed in shots.json: it loads the scene URL, waits until the page flags
// itself ready, grabs a JPEG frame, and drops it into screenshots/.
//
//   node tools/capture.mjs [game-port]     (default game port: 8091)

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CHROME_PATH = join(
  homedir(),
  '.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome',
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseConfig(argv) {
  return {
    gamePort: argv[2] ?? '8091',
    cdpPort: 9444,
    jpegQuality: 86,
    readyTimeoutMs: 30_000,
    readyPollMs: 200,
    settleMs: 120,
    debuggerDeadlineMs: 15_000,
    debuggerPollMs: 250,
  };
}

function loadScenes() {
  const shotsUrl = new URL('../shots.json', import.meta.url);
  return JSON.parse(readFileSync(shotsUrl, 'utf8'));
}

function launchChrome(config) {
  if (!existsSync(CHROME_PATH)) {
    throw new Error(`chrome not found at ${CHROME_PATH}`);
  }
  const flags = [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    `--remote-debugging-port=${config.cdpPort}`,
    '--window-size=1280,720',
    '--force-device-scale-factor=1',
    '--mute-audio',
    'about:blank',
  ];
  return spawn(CHROME_PATH, flags, { stdio: 'ignore' });
}

async function waitForDebugger(port, deadlineMs, pollMs = 250) {
  const endpoint = `http://127.0.0.1:${port}/json/version`;
  const deadline = Date.now() + deadlineMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(endpoint);
      if (res.ok) return;
      lastError = new Error(`debugger endpoint returned ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    await sleep(pollMs);
  }
  const suffix = lastError ? `: ${lastError.message}` : '';
  throw new Error(`chrome debugger never came up on port ${port}${suffix}`);
}

class CdpSession {
  #socket;
  #nextId = 1;
  #pending = new Map();

  static async open(cdpPort) {
    const newTabUrl = `http://127.0.0.1:${cdpPort}/json/new?about:blank`;
    const res = await fetch(newTabUrl, { method: 'PUT' });
    if (!res.ok) {
      throw new Error(`failed to open tab: HTTP ${res.status}`);
    }
    const tab = await res.json();
    const socket = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    return new CdpSession(socket);
  }

  constructor(socket) {
    this.#socket = socket;
    socket.addEventListener('message', (event) => this.#dispatch(event));
    socket.addEventListener('close', () => this.#failAll(new Error('CDP socket closed')));
  }

  #dispatch(event) {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (!message.id || !this.#pending.has(message.id)) return;
    const entry = this.#pending.get(message.id);
    this.#pending.delete(message.id);
    if (message.error) {
      entry.reject(new Error(JSON.stringify(message.error)));
    } else {
      entry.resolve(message.result);
    }
  }

  #failAll(error) {
    for (const entry of this.#pending.values()) entry.reject(error);
    this.#pending.clear();
  }

  send(method, params = {}) {
    const id = this.#nextId;
    this.#nextId += 1;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#socket.send(payload);
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 800));
    }
    return result.result.value;
  }

  async waitUntilReady(timeoutMs, pollMs) {
    const startedAt = Date.now();
    for (;;) {
      const ready = await this.evaluate('window.__shotReady === true').catch(() => false);
      if (ready) return;
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(`not ready within ${timeoutMs}ms`);
      }
      await sleep(pollMs);
    }
  }

  close() {
    try {
      this.#socket.close();
    } catch {
      // Socket may already be gone; closing is best-effort.
    }
  }
}

async function captureScene(session, scene, config) {
  const url = `http://127.0.0.1:${config.gamePort}/${scene.query}`;
  try {
    await session.send('Page.navigate', { url });

    try {
      await session.waitUntilReady(config.readyTimeoutMs, config.readyPollMs);
    } catch {
      throw new Error(`timeout on ${scene.name}`);
    }

    await sleep(config.settleMs);

    const shot = await session.send('Page.captureScreenshot', {
      format: 'jpeg',
      quality: config.jpegQuality,
    });
    const bytes = Buffer.from(shot.data, 'base64');
    const outPath = new URL(`../screenshots/${scene.name}`, import.meta.url);
    writeFileSync(outPath, bytes);
    return bytes.length;
  } catch (err) {
    if (err.message.includes(scene.name)) throw err;
    throw new Error(`scene ${scene.name}: ${err.message}`, { cause: err });
  }
}

async function main() {
  const config = parseConfig(process.argv);
  const scenes = loadScenes();
  const chrome = launchChrome(config);
  let session;

  try {
    await waitForDebugger(config.cdpPort, config.debuggerDeadlineMs, config.debuggerPollMs);

    session = await CdpSession.open(config.cdpPort);
    await session.send('Page.enable');
    await session.send('Runtime.enable');

    let totalBytes = 0;
    for (const scene of scenes) {
      const byteCount = await captureScene(session, scene, config);
      totalBytes += byteCount;
      const kib = (byteCount / 1024).toFixed(1);
      console.log(`captured ${scene.name} (${kib} KiB)`);
    }

    const totalKib = (totalBytes / 1024).toFixed(1);
    console.log(`done: ${scenes.length} scenes, ${totalBytes} bytes (${totalKib} KiB) total`);
  } finally {
    session?.close();
    chrome.kill();
  }
}

main().catch((err) => {
  console.error(`capture failed: ${err.message}`);
  process.exitCode = 1;
});
