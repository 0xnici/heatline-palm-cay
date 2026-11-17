// smoke.mjs — boots the game in headless Chrome over CDP and plays it
// blind: title → Enter → walk → shoot → melee → pause/resume → the
// chase and mission shot scenes. Any runtime exception or console
// error fails the run. Usage: node tools/smoke.mjs [port]
import { spawn } from 'node:child_process';
import { launchChrome, connectPage, tapKey, key, mouseClick, wait } from './cdp.mjs';

const PORT = Number(process.argv[2] || 8901);
const CDP = PORT + 400;
const BASE = `http://127.0.0.1:${PORT}/index.html`;

const server = spawn('node', ['tools/serve.mjs', String(PORT)], { stdio: 'ignore' });
const chrome = await launchChrome(CDP);
const errors = [];
try {
  const page = await connectPage(CDP);
  page.on((msg) => {
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      errors.push('exception: ' + (d.exception?.description || d.text));
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push('console: ' + msg.params.args.map((a) => a.value || a.description || '').join(' '));
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      errors.push('log: ' + msg.params.entry.text);
    }
  });
  await page.send('Runtime.enable');
  await page.send('Page.enable');
  await page.send('Log.enable');

  await page.send('Page.navigate', { url: BASE });
  await wait(2600);
  const hasCanvas = await page.send('Runtime.evaluate', { expression: '!!document.getElementById("game")', returnByValue: true });
  console.log('canvas present:', hasCanvas.result.value);
  const shotA = await page.send('Page.captureScreenshot', { format: 'png' });

  await tapKey(page, 'Enter', 'Enter');
  await wait(700);
  // Walk north for a moment, then shoot and swing.
  await key(page, 'KeyW', 'w', 'keyDown');
  await wait(1500);
  await key(page, 'KeyW', 'w', 'keyUp');
  await mouseClick(page, 760, 300);
  await wait(250);
  await mouseClick(page, 760, 300);
  await tapKey(page, 'KeyF', 'f');
  await wait(300);
  await tapKey(page, 'KeyP', 'p');
  await wait(250);
  await tapKey(page, 'KeyP', 'p');
  await wait(250);
  const shotB = await page.send('Page.captureScreenshot', { format: 'png' });
  console.log('frame changed after Enter+walk:', shotA.data !== shotB.data);

  for (const scene of ['chase', 'mission', 'onfoot', 'cover']) {
    await page.send('Page.navigate', { url: `${BASE}?shot=${scene}&seed=7` });
    await wait(1800);
    console.log('scene loaded:', scene);
  }
  page.close();
} finally {
  chrome.kill();
  server.kill();
}

if (errors.length) {
  console.log('SMOKE FAILED — ' + errors.length + ' error(s):');
  for (const e of errors) console.log('  ' + e.split('\n')[0]);
  process.exit(1);
}
console.log('SMOKE PASS — zero runtime exceptions, zero console errors');
