/**
 * Verifies the production build (vite preview) in a real browser:
 *  - the app mounts and computes correctly
 *  - CSV export produces a downloadable file with the right content
 *  - the print stylesheet hides the app chrome
 *
 * Run with: node scripts/verify-dist.mjs
 */
import { firefox } from 'playwright';
import { readFile } from 'node:fs/promises';

const URL = process.env.PREVIEW_URL ?? 'http://127.0.0.1:4173/';
const failures = [];

function check(name, condition, detail = '') {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!condition) failures.push(name);
}

const browser = await firefox.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(String(e)));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-testid="results"]', { timeout: 15000 });

check('production build mounts', true);
const area = (await page.getByTestId('stat-area').innerText()).replace(/\s+/g, ' ');
check('production build computes the default area', area.includes('6.30297'), area);

// --- CSV export -----------------------------------------------------------
const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
await page.getByTestId('export-csv').click();
const download = await downloadPromise;
const path = await download.path();
const csv = await readFile(path, 'utf-8');

check('CSV downloads with the expected filename', download.suggestedFilename() === 'thermolab-results.csv', download.suggestedFilename());
check('CSV contains the hot-side duty', csv.includes('Hot-side duty Q_hot,250800,W'));
// The CSV exports full floating-point precision so downstream tools lose nothing.
check(
  'CSV contains the required area',
  /Required area A,6\.30296586/.test(csv),
  csv.split(/\r?\n/).find((l) => l.startsWith('Required area A')) ?? '',
);
check(
  'CSV contains the LMTD',
  /LMTD,79\.58158286/.test(csv),
  csv.split(/\r?\n/).find((l) => l.startsWith('LMTD,')) ?? '',
);
check('CSV states the area sizing basis', csv.includes('Area sizing basis,Hot-stream duty Q_hot'));
check('CSV states the assumptions', csv.includes('Negligible heat loss to surroundings'));
check('CSV states that F is user supplied', csv.includes('User supplied (0 < F <= 1)'));

// --- Print stylesheet -----------------------------------------------------
await page.emulateMedia({ media: 'print' });
const chromeHidden = await page.evaluate(() => {
  const header = document.querySelector('.app__header');
  const footer = document.querySelector('.app__footer');
  const isHidden = (el) => el && getComputedStyle(el).display === 'none';
  return { header: isHidden(header), footer: isHidden(footer) };
});
check('print media hides the app header', chromeHidden.header);
check('print media hides the app footer', chromeHidden.footer);

const printVisible = await page.evaluate(() => {
  const card = document.querySelector('.card');
  return card ? getComputedStyle(card).display !== 'none' : false;
});
check('print media keeps the results visible', printVisible);

await page.emulateMedia({ media: 'screen' });

check('no console errors in the production build', consoleErrors.length === 0, consoleErrors.join(' | '));

await browser.close();

console.log('');
if (failures.length > 0) {
  console.error(`VERIFY FAILED: ${failures.length} check(s) failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('VERIFY PASSED: all checks green');
