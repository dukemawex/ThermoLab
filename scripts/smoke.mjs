/**
 * Headless browser smoke check against the running dev server.
 * Verifies the app mounts, computes the documented default example, renders
 * the charts, and has no horizontal overflow on a mobile viewport.
 *
 * Run with: node scripts/smoke.mjs
 *
 * Note: this environment runs Chromium inside PRoot, where the GPU/renderer
 * processes crash on startup. Firefox is used instead, which works reliably.
 */
import { firefox } from 'playwright';

const URL = process.env.SMOKE_URL ?? 'http://127.0.0.1:5173/';
const failures = [];

function check(name, condition, detail = '') {
  const status = condition ? 'PASS' : 'FAIL';
  console.log(`${status}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!condition) failures.push(name);
}

const browser = await firefox.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const consoleErrors = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push(String(error)));

await page.goto(URL, { waitUntil: 'networkidle' });

// 1. The app mounted.
await page.waitForSelector('[data-testid="results"]', { timeout: 15000 });
check('app mounts and results render', true);

// 2. Default example values.
const area = (await page.getByTestId('stat-area').innerText()).replace(/\s+/g, ' ');
check('area shows 6.30297 m2', area.includes('6.30297'), area);

const qHot = (await page.getByTestId('stat-qhot').innerText()).replace(/\s+/g, ' ');
check('Q_hot shows 250,800 W', qHot.includes('250,800'), qHot);

const lmtd = (await page.getByTestId('stat-lmtd').innerText()).replace(/\s+/g, ' ');
check('LMTD shows 79.58158 K', lmtd.includes('79.58158'), lmtd);

// 3. The three charts rendered SVG surfaces.
const chartCount = await page.locator('.recharts-surface').count();
check('three charts rendered', chartCount >= 3, `found ${chartCount}`);

// 4. The temperature diagram carries the required axis label.
//    Note: innerText is empty for SVG nodes in Firefox, so use textContent.
const axisLabels = await page.$$eval('.recharts-label', (nodes) =>
  nodes.map((node) => node.textContent ?? ''),
);
check(
  'temperature diagram axis is labelled "Position along hot-flow direction"',
  axisLabels.some((t) => t.includes('Position along hot-flow direction')),
  `${axisLabels.length} label(s)`,
);

// 5. No horizontal overflow at mobile width.
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
check('no horizontal overflow at 390px', overflow <= 0, `overflow ${overflow}px`);

// 6. No horizontal overflow at desktop width.
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(400);
const desktopOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
check('no horizontal overflow at 1440px', desktopOverflow <= 0, `overflow ${desktopOverflow}px`);

// 7. Invalid input suppresses the results.
await page.setViewportSize({ width: 390, height: 844 });
await page.getByTestId('u-value').fill('-10');
await page.waitForTimeout(200);
check(
  'invalid U suppresses results',
  (await page.getByTestId('results-empty').count()) === 1,
);
const uError = await page.getByText('U must be greater than 0 W/(m²·K).').count();
check('inline U error is shown', uError > 0, `${uError} node(s)`);

// 8. Reset restores the default example.
await page.getByTestId('reset').click();
await page.waitForTimeout(200);
const restored = (await page.getByTestId('stat-area').innerText()).replace(/\s+/g, ' ');
check('reset restores the default area', restored.includes('6.30297'), restored);

// 9. Counterflow crossing is accepted; parallel-flow crossing is not.
await page.getByTestId('cold-outlet').fill('100');
await page.waitForTimeout(200);
check(
  'counterflow crossing is accepted',
  (await page.getByTestId('results').count()) === 1,
);
await page.getByTestId('arrangement-parallel').click();
await page.waitForTimeout(200);
check(
  'parallel-flow crossing is rejected',
  (await page.getByTestId('results-empty').count()) === 1,
);

// 10. Cold-side energy balance.
//     Reset first so the cold outlet is back at the default 60 degC:
//     Q_cold = 1 * 4180 * (60 - 20) = 167200 W vs Q_hot = 250800 W -> 33.33%.
await page.getByTestId('reset').click();
await page.waitForTimeout(200);
await page.getByTestId('cold-mass-flow').fill('1');
await page.getByTestId('cold-cp').fill('4180');
await page.waitForTimeout(200);
const mismatch = (await page.getByTestId('mismatch').innerText()).replace(/\s+/g, ' ');
check('mismatch reported as 33.33%', mismatch.includes('33.33'), mismatch);

const qCold = (await page.getByTestId('stat-qcold').innerText()).replace(/\s+/g, ' ');
check('Q_cold shows 167,200 W', qCold.includes('167,200'), qCold);

// 11. Required fields can be cleared and the empty state is reported.
await page.getByTestId('reset').click();
await page.waitForTimeout(200);
await page.getByTestId('hot-inlet').fill('');
await page.waitForTimeout(200);
check(
  'a cleared required field is reported as invalid',
  (await page.getByTestId('results-empty').count()) === 1,
);
const clearedValue = await page.getByTestId('hot-inlet').inputValue();
check('the cleared field stays empty', clearedValue === '', `"${clearedValue}"`);

// 12. A cleared optional field does not raise an error.
await page.getByTestId('reset').click();
await page.waitForTimeout(200);
await page.getByTestId('cold-mass-flow').fill('');
await page.waitForTimeout(200);
check(
  'a cleared optional field is not an error',
  (await page.getByTestId('results-empty').count()) === 0,
);
check(
  'the cold-side duty falls back to "not available"',
  (await page.getByTestId('stat-qcold').innerText()).includes('—'),
);

// 13. No console errors.
check('no console errors', consoleErrors.length === 0, consoleErrors.join(' | '));

await page.screenshot({ path: '/tmp/opencode/logs/thermolab-mobile.png', fullPage: true });
await page.setViewportSize({ width: 1440, height: 1000 });
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/opencode/logs/thermolab-desktop.png', fullPage: true });

await browser.close();

console.log('');
if (failures.length > 0) {
  console.error(`SMOKE FAILED: ${failures.length} check(s) failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('SMOKE PASSED: all checks green');
