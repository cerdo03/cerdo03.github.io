import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { entries, matchTag, siteTags, sites, projects, tagCounts } from '../assets/learning-catalog.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const home = read('index.html');
const landing = read('labs/llm-systems/index.html');
const css = read('assets/theme.css');
const rel = path => path.replace(/^\//, '');

test('homepage shows every published site as a bento tile or step with catalog title, link and art key', () => {
  for (const [id, site] of Object.entries(sites)) {
    assert.ok(home.includes(`href="${rel(site.path)}"`), `${id}: homepage link`);
  }
  for (const entry of entries()) {
    const tile = home.match(new RegExp(`<(?:div|article) class="tile tile-(\\w+)[^"]*" data-entry="${entry.id}" data-art="(\\w+)" data-tile="(\\w+)"`));
    assert.ok(tile, `${entry.id}: tile`);
    assert.equal(tile[1], entry.tile);
    assert.equal(tile[2], entry.art);
    assert.equal(tile[3], entry.tile);
    if (entry.type === 'site') {
      assert.ok(home.includes(`>${entry.title.replaceAll('&', '&amp;')}</a>`), `${entry.id}: title`);
      const chips = [...home.slice(home.indexOf(`data-entry="${entry.id}"`)).split('</div>')[0].matchAll(/<li class="chip">(.*?)<\/li>/g)].map(match => match[1]);
      assert.deepEqual(chips, entry.tags, `${entry.id}: chips follow the catalog`);
    } else {
      const steps = [...home.matchAll(/<li data-site="([\w-]+)"><a href="([^"]+)"/g)].map(match => [match[1], match[2]]);
      assert.deepEqual(steps, entry.members.map(member => [member.id, rel(member.path)]), 'steps follow catalog order');
    }
  }
  assert.match(home, new RegExp(`Collection · ${entries()[0].members.length} sites`));
});

test('homepage keeps real contact links and no placeholder hrefs', () => {
  for (const href of ['mailto:official.surya3jan@gmail.com', 'https://www.linkedin.com/in/cerdo/', 'https://github.com/cerdo03']) assert.ok(home.includes(`href="${href}"`), href);
  assert.doesNotMatch(home, /href="#(?:email|linkedin|llm-systems|dynamo|kafka|source-control)"/);
});

test('collection landing lists modules in order, then optional companions', () => {
  const order = ['../inference/', '../attention/', '../gpu/', '../efficient-attention/', '../math-fluency/', '../attention/architecture-explorer/'];
  const found = order.map(href => landing.indexOf(`<a class="tile-stretch" href="${href}"`));
  assert.ok(found.every(index => index > 0), 'every module tile links its site');
  assert.deepEqual([...found].sort((a, b) => a - b), found, 'tiles appear in learning order');
  for (const site of Object.values(sites).filter(site => site.project === 'llm-systems')) {
    assert.ok(landing.includes(`href="${rel(site.path).replace(/^labs\//, '../')}"`), site.title);
  }
});

test('tag filter matches entries and narrows collection members', () => {
  assert.ok(matchTag('').every(result => result.matches));
  const gpu = matchTag('GPU');
  assert.deepEqual(gpu.filter(result => result.matches).map(result => result.id), ['llm-systems']);
  assert.deepEqual(gpu[0].memberIds, ['gpu']);
  assert.deepEqual(matchTag('Distributed systems').filter(result => result.matches).map(result => result.id).sort(), ['dynamo', 'scion']);
  assert.equal(tagCounts().find(item => item.tag === 'AI').count, 6);
  for (const { tag } of tagCounts()) assert.ok(matchTag(tag).some(result => result.matches), tag);
});

test('catalog entries describe published work honestly and without private details', () => {
  for (const site of Object.values(sites)) {
    assert.ok(site.summary && site.summary.length < 220, site.title);
    assert.ok(site.kind && site.blurb, site.title);
    assert.deepEqual(siteTags(projects[site.project], site), [...new Set(siteTags(projects[site.project], site))]);
  }
});

function themeBlock(name) {
  const match = name === 'paper' ? css.match(/:root, :root\[data-theme="paper"\] \{([\s\S]*?)\n\}/) : css.match(new RegExp(`:root\\[data-theme="${name}"\\] \\{([\\s\\S]*?)\\n\\}`));
  return Object.fromEntries([...match[1].matchAll(/--([\w-]+): (#[0-9a-f]{6}|[^;]+);/g)].map(item => [item[1], item[2]]));
}
const luminance = hex => {
  const channel = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel[0] + 0.7152 * channel[1] + 0.0722 * channel[2];
};
const ratio = (a, b) => { const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (high + 0.05) / (low + 0.05); };

test('tile colour tokens exist in every theme and keep AA contrast for their ink', () => {
  const colours = [...new Set([...Object.values(sites), ...Object.values(projects)].map(item => item.tile).filter(Boolean)), 'sun', 'pink', 'sky'];
  for (const theme of ['paper', 'midnight', 'contrast']) {
    const tokens = themeBlock(theme);
    for (const colour of colours) {
      assert.ok(tokens[`tile-${colour}`] && tokens[`tile-${colour}-ink`], `${theme}: tile-${colour}`);
      assert.ok(ratio(tokens[`tile-${colour}-ink`], tokens[`tile-${colour}`]) >= 4.5, `${theme}: ${colour} ink contrast`);
    }
    assert.ok(ratio(tokens['tile-indigo-accent'], tokens['tile-indigo']) >= 4.5, `${theme}: accent on indigo`);
    assert.ok(ratio(tokens['tile-indigo-accent-ink'], tokens['tile-indigo-accent']) >= 4.5, `${theme}: button ink`);
    for (let step = 1; step <= 6; step += 1) assert.ok(ratio(tokens['step-ink'], tokens[`step-${step}`]) >= 4.5, `${theme}: step ${step}`);
    for (const [foreground, background] of [['ink', 'paper'], ['muted', 'paper'], ['muted', 'card'], ['accent', 'paper'], ['on-accent', 'accent']]) assert.ok(ratio(tokens[foreground], tokens[background]) >= 4.5, `${theme}: ${foreground} on ${background}`);
  }
});

test('caption, muted and diagram text pairs keep AA contrast in every theme', () => {
  const pairs = [['muted', 'surface-alt'], ['muted', 'accent-soft'], ['ink', 'accent-soft'], ['ink', 'surface-alt'], ['ink', 'success-soft'], ['ink', 'danger-soft'],
    ['diagram-ink', 'diagram-surface'], ['diagram-muted', 'diagram-surface'], ['accent', 'diagram-surface'], ['on-diagram', 'diagram'], ['on-accent', 'accent-hover']];
  for (const theme of ['paper', 'midnight', 'contrast']) {
    const tokens = themeBlock(theme);
    for (const [foreground, background] of pairs) {
      if (!tokens[foreground] || !tokens[background]) continue;
      assert.ok(ratio(tokens[foreground], tokens[background]) >= 4.5, `${theme}: ${foreground} on ${background}`);
    }
  }
});

test('figure panels pair their text tokens with the light diagram surface, not the dark diagram fill', () => {
  const attention = read('labs/attention/styles.css');
  const panel = attention.match(/\n\.diagram \{([^}]*)\}/)[1];
  assert.match(panel, /background: var\(--diagram-surface\)/);
  assert.match(panel, /color: var\(--diagram-ink\)/);
  assert.match(attention.match(/\.t-o \{([^}]*)\}/)[1], /--role-ink: var\(--on-diagram\)/);
});

test('page CSS for the bento pages uses theme tokens, not hardcoded colours', () => {
  for (const file of ['styles.css', 'assets/chrome.css', 'labs/llm-systems/overview.css']) {
    assert.doesNotMatch(read(file).replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-fA-F]{3,8}\b|rgba?\(/, `${file} hardcodes a colour`);
  }
});

test('shared chrome is loaded from shared assets on migrated pages', () => {
  for (const [page, depth] of [[home, ''], [landing, '../../'], [read('journal/starting-this-journal.html'), '../']]) {
    assert.ok(page.includes(`href="${depth}assets/theme.css"`));
    assert.ok(page.includes(`href="${depth}assets/chrome.css"`));
    assert.ok(page.includes(`src="${depth}assets/chrome.js"`));
    assert.equal((page.match(/<header class="chrome-header"/g) || []).length, 1);
  }
  assert.match(read('assets/theme.js'), /journal-appearance/);
});
