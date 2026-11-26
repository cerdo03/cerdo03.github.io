import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { entries, matchTag, siteTags, sites, projects, tagCounts } from '../assets/learning-catalog.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const home = read('index.html');
const landing = read('labs/llm-systems/index.html');
const rel = path => path.replace(/^\//, '');

test('homepage lists every published site from the catalog with matching titles, links and tags', () => {
  for (const [id, site] of Object.entries(sites)) {
    assert.ok(home.includes(`href="${rel(site.path)}"`), `${id}: homepage link`);
    assert.ok(home.includes(site.title.replaceAll('&', '&amp;')), `${id}: title`);
  }
  for (const entry of entries()) {
    const block = home.match(new RegExp(`data-learning-(?:site|project)="${entry.id}"><ul class="chip-list">(.*?)</ul>`));
    assert.ok(block, `${entry.id}: tag chips`);
    const shown = [...block[1].matchAll(/<li class="chip">(.*?)<\/li>/g)].map(match => match[1]);
    assert.deepEqual(shown, entry.type === 'collection' ? projects[entry.id].tags : entry.tags, `${entry.id}: chips follow the catalog`);
  }
  assert.match(home, new RegExp(`${Object.keys(sites).length} interactive sites`));
  assert.match(home, new RegExp(`Collection · ${entries()[0].members.length} sites`));
});

test('collection landing page links every member site from the path or optional list', () => {
  for (const [id, site] of Object.entries(sites).filter(([, site]) => site.project === 'llm-systems')) {
    const href = rel(site.path).replace(/^labs\//, '../');
    assert.ok(landing.includes(`href="${href}"`), `${id}: ${href}`);
  }
  assert.match(landing, /<ol class="path">/);
});

test('tag filter matches entries and narrows collection members', () => {
  assert.ok(matchTag('').every(result => result.matches));
  const gpu = matchTag('GPU');
  assert.deepEqual(gpu.filter(result => result.matches).map(result => result.id), ['llm-systems']);
  assert.deepEqual(gpu[0].memberIds, ['gpu']);
  const distributed = matchTag('Distributed systems').filter(result => result.matches).map(result => result.id);
  assert.deepEqual(distributed.sort(), ['dynamo', 'scion']);
  const counts = tagCounts();
  assert.equal(counts.find(item => item.tag === 'AI').count, 6);
  for (const { tag } of counts) assert.ok(matchTag(tag).some(result => result.matches), tag);
});

test('catalog entries describe published work honestly and without private details', () => {
  for (const site of Object.values(sites)) {
    assert.ok(site.summary && site.summary.length < 220, site.title);
    assert.ok(site.kind, site.title);
    assert.deepEqual(siteTags(projects[site.project], site), [...new Set(siteTags(projects[site.project], site))]);
  }
});

test('shared chrome is loaded from shared assets on migrated pages', () => {
  for (const [page, depth] of [[home, ''], [landing, '../../'], [read('journal/starting-this-journal.html'), '../']]) {
    assert.ok(page.includes(`href="${depth}assets/theme.css"`));
    assert.ok(page.includes(`href="${depth}assets/chrome.css"`));
    assert.ok(page.includes(`src="${depth}assets/chrome.js"`));
    assert.ok(page.includes('data-theme-toggle') || page.includes('data-chrome="header"'));
    assert.equal((page.match(/<header class="chrome-header"/g) || []).length, 1);
  }
  assert.match(read('assets/theme.js'), /journal-appearance/);
});
