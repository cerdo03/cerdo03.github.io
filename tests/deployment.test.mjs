import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('deployment versions page assets and module dependencies together', () => {
  const directory = mkdtempSync(join(tmpdir(), 'journal-deploy-'));
  try {
    const result = spawnSync(process.execPath, ['scripts/prepare-site.mjs', directory, 'test-revision'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(readFileSync(join(directory, 'index.html'), 'utf8'), /assets\/theme.css\?v=test-revision/);
    assert.match(readFileSync(join(directory, 'labs/kafka/index.html'), 'utf8'), /app.js\?v=test-revision/);
    assert.match(readFileSync(join(directory, 'labs/inference/app.js'), 'utf8'), /course-visuals.js\?v=test-revision/);
    assert.match(readFileSync(join(directory, 'assets/theme.js'), 'utf8'), /theme-config.js\?v=test-revision/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});


test('deployment adds one basic analytics beacon to every public page', () => {
  const directory = mkdtempSync(join(tmpdir(), 'journal-analytics-'));
  try {
    const result = spawnSync(process.execPath, ['scripts/prepare-site.mjs', directory, 'test-revision'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    for (const page of ['index.html', 'journal/starting-this-journal.html', 'labs/kafka/index.html', 'labs/inference/index.html']) {
      const html = readFileSync(join(directory, page), 'utf8');
      assert.equal((html.match(/data-goatcounter=/g) || []).length, 1);
      assert.match(html, /https:\/\/cerdo.goatcounter.com\/count/);
      assert.match(html, /https:\/\/gc.zgo.at\/count.js/);
      assert.ok(html.indexOf('data-goatcounter=') < html.indexOf('</body>'));
      assert.doesNotMatch(readFileSync(page, 'utf8'), /data-goatcounter=/);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
