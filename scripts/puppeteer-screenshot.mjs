import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer';

const args = new Map();

for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];

  if (!arg.startsWith('--')) {
    continue;
  }

  const [key, inlineValue] = arg.slice(2).split('=');
  const nextValue = process.argv[i + 1];
  const value = inlineValue ?? (nextValue && !nextValue.startsWith('--') ? nextValue : 'true');

  if (inlineValue === undefined && value === nextValue) {
    i += 1;
  }

  args.set(key, value);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const url = args.get('url') ?? 'http://127.0.0.1:5173/';
const out = args.get('out') ?? `screenshots/puppeteer-${timestamp}.png`;
const width = Number.parseInt(args.get('width') ?? '1440', 10);
const height = Number.parseInt(args.get('height') ?? '900', 10);
const wait = Number.parseInt(args.get('wait') ?? '1200', 10);
const fullPage = args.get('fullPage') === 'true';

await fs.mkdir(path.dirname(out), { recursive: true });

const browser = await puppeteer.launch();

try {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle0' });

  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }

  await page.screenshot({ path: out, fullPage });

  const title = await page.title();
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
    bodyTextLength: document.body?.innerText?.length ?? 0,
    canvasCount: document.querySelectorAll('canvas').length,
  }));

  console.log(JSON.stringify({ url, out, title, viewport: { width, height }, dimensions }, null, 2));
} finally {
  await browser.close();
}
