import puppeteer from 'puppeteer';

const url = process.argv[2] ?? 'http://127.0.0.1:5191/';
const out = process.argv[3] ?? 'screenshots/stage11-tunnel-silent.png';
const browser = await puppeteer.launch();
try {
  const page = await browser.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 2500));

  const canvasInfo = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return { found: false };
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    return { found: true, w: c.width, h: c.height, hasGl: !!gl };
  });

  await page.screenshot({ path: out });
  console.log(JSON.stringify({ pageErrors, consoleErrors, canvasInfo }, null, 2));
} finally {
  await browser.close();
}
