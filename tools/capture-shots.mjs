// capture-shots.mjs — recaptures the four screenshots from the
// ?shot= scenes listed in shots.json, through headless Chrome over
// CDP. Each capture is checked against the scorer's cap (256 KiB);
// if one comes in heavy it is retaken at a lower JPEG quality.
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { launchChrome, connectPage, wait } from './cdp.mjs';

const PORT = 8903;
const CDP = PORT + 400;
const shots = JSON.parse(await readFile(new URL('../shots.json', import.meta.url), 'utf8'));

const server = spawn('node', ['tools/serve.mjs', String(PORT)], { stdio: 'ignore' });
const chrome = await launchChrome(CDP);
const errors = [];
try {
  const page = await connectPage(CDP);
  page.on((msg) => {
    if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params.exceptionDetails.exception?.description || 'exception');
    }
  });
  await page.send('Runtime.enable');
  await page.send('Page.enable');
  // Pin the viewport so every capture is exactly 1280x720.
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
  });
  for (const shot of shots) {
    await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html${shot.query}` });
    await wait(1600);
    let quality = 88;
    let data;
    for (;;) {
      const res = await page.send('Page.captureScreenshot', { format: 'jpeg', quality, fromSurface: true });
      data = Buffer.from(res.data, 'base64');
      if (data.length <= 250 * 1024 || quality <= 60) break;
      quality -= 10;
    }
    await writeFile(new URL(`../screenshots/${shot.name}`, import.meta.url), data);
    console.log(`${shot.name}: ${(data.length / 1024).toFixed(1)} KiB (jpeg q${quality})`);
  }
  page.close();
} finally {
  chrome.kill();
  server.kill();
}
if (errors.length) { console.log('CAPTURE ERRORS:', errors); process.exit(1); }
console.log('capture done — zero exceptions');
