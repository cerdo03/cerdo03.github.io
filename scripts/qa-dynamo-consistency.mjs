import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, extname } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(process.env.QA_SITE_ROOT || '.');
const out = resolve(process.env.QA_OUTPUT || '/tmp/dynamo-consistency');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    const target = resolve(root, '.' + path + (path.endsWith('/') ? 'index.html' : ''));
    if (!target.startsWith(root + '/')) throw Error('Invalid path');
    const data = await readFile(target);
    res.writeHead(200, { 'Content-Type': mime[extname(target)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.QA_CHANNEL ? { channel: process.env.QA_CHANNEL } : {}) });
const errors = [];
let states = 0;
try {
  for (const width of [360, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/labs/dynamo/`);
    await page.locator('#lesson h1').waitFor();
    assert.equal(await page.locator('#contents').evaluate(el => el.open), width > 640, 'Initial mobile path stays closed so lesson appears first');
    await page.screenshot({ path: resolve(out, `initial-${width}.png`) });
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.skip').evaluate(el => el === document.activeElement), true, 'Skip link must be first keyboard stop');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#lesson').evaluate(el => el === document.activeElement), true);
    for (const theme of ['paper', 'midnight', 'contrast']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      for (let index = 0; index < 12; index++) {
        if (!await page.locator('#contents').evaluate(el => el.open)) await page.locator('#contents summary').click();
        await page.locator('#lessons-nav button').nth(index).click();
        assert.match(await page.locator('#lesson h1').textContent(), new RegExp(`^${index + 1}\\.`));
        assert.equal(await page.locator('#lesson').evaluate(el => el === document.activeElement), true, 'Lesson selection must move keyboard focus to new content');
        assert.equal(await page.locator('#lessons-nav [aria-current="step"]').count(), 1);
        if (width <= 640) assert.equal(await page.locator('#contents').evaluate(el => el.open), false, 'Mobile selection closes long path');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}/${theme}/${index}: page overflow`);
        const header = await page.locator('.topbar').boundingBox();
        assert.ok(header.height <= 90, 'Shared compact header');
        for (const selector of ['#version-graph', '.diagram-viewport']) {
          const region = page.locator(selector);
          if (await region.isVisible() && await region.evaluate(el => el.scrollWidth > el.clientWidth)) {
            await region.focus();
            assert.equal(await region.evaluate(el => el === document.activeElement), true, 'Wide diagrams must accept keyboard focus');
          }
        }
        states++;
      }
      if (!await page.locator('#contents').evaluate(el => el.open)) await page.locator('#contents summary').click();
      await page.locator('#lessons-nav button').nth(3).click();
      const symbol = page.locator('[data-dynamo-symbol]').first();
      await symbol.focus();
      await page.evaluate(() => window.scrollBy(0, 20));
      await page.waitForFunction(() => !document.querySelector('.symbol-help').hidden);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.symbol-help').isVisible(), false);
      if (!await page.locator('#contents').evaluate(el => el.open)) await page.locator('#contents summary').click();
      await page.locator('#lessons-nav button').nth(11).click();
      await page.locator('.lesson-controls button').first().click();
      assert.match(await page.locator('#lesson h1').textContent(), /^11\./);
      assert.equal(await page.locator('#lesson').evaluate(el => el === document.activeElement), true);
      await page.screenshot({ path: resolve(out, `${theme}-${width}.png`) });
    }
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ states, errors }));
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
}
