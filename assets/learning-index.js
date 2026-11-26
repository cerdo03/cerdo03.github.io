import { matchTag, tagCounts, sites } from './learning-catalog.js';

// Homepage topic filter, driven by the learning catalog. Without JavaScript the full bento stays visible.
// Markup contract: [data-topic-filter] (empty, hidden) and a .bento grid whose learning tiles carry
// data-entry="<catalog id>". A collection tile lists member sites as .stairs > li[data-site].
// Filtering either hides non-matching tiles and reflows the grid, or dims them (the "Hide other topics" switch).
const host = document.querySelector('[data-topic-filter]');
const grid = document.querySelector('.bento');

if (host && grid) {
  const visibleCount = 8;
  const counts = tagCounts();
  const total = Object.keys(sites).length;
  const tiles = [...grid.querySelectorAll('[data-entry]')];
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const params = new URLSearchParams(location.search);
  let selected = counts.some(item => item.tag === params.get('topic')) ? params.get('topic') : '';
  let expanded = counts.slice(visibleCount).some(item => item.tag === selected);
  let hideOthers = true;

  const heading = document.createElement('h2');
  heading.id = 'filter-label';
  heading.textContent = 'Learn by topic';
  const chips = document.createElement('div');
  chips.className = 'filter-chips';
  chips.setAttribute('role', 'group');
  chips.setAttribute('aria-labelledby', 'filter-label');
  const option = document.createElement('label');
  option.className = 'filter-option';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.setAttribute('role', 'switch');
  box.setAttribute('aria-describedby', 'filter-status');
  box.checked = hideOthers;
  const optionText = document.createElement('span');
  optionText.textContent = 'Hide other topics';
  const optionState = document.createElement('span');
  optionState.className = 'filter-state';
  optionState.setAttribute('aria-hidden', 'true');
  option.append(box, optionText, optionState);
  const status = document.createElement('p');
  status.className = 'filter-status';
  status.id = 'filter-status';
  status.setAttribute('role', 'status');
  host.replaceChildren(heading, chips, option, status);

  const makeChip = (text, tag, count) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip-button';
    button.textContent = text;
    if (count) {
      const badge = document.createElement('span');
      badge.className = 'chip-count';
      badge.textContent = `(${count})`;
      button.append(badge);
      button.setAttribute('aria-label', `${text}, ${count} ${count === 1 ? 'site' : 'sites'}`);
    }
    button.dataset.tag = tag;
    button.addEventListener('click', () => { selected = selected === tag ? '' : tag; apply(true); });
    return button;
  };

  function build() {
    const shown = expanded ? counts : counts.slice(0, visibleCount);
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'chip-button';
    more.textContent = expanded ? 'Fewer topics' : `${counts.length - visibleCount} more topics`;
    more.setAttribute('aria-expanded', String(expanded));
    more.addEventListener('click', () => { expanded = !expanded; build(); update(); });
    chips.replaceChildren(makeChip('All', ''), ...shown.map(item => makeChip(item.tag, item.tag, item.count)), more);
  }

  function update() {
    for (const button of chips.querySelectorAll('[data-tag]')) button.setAttribute('aria-pressed', String(button.dataset.tag === selected));
  }

  // FLIP: animate tiles from their old box to the new one (skipped for reduced motion).
  function flip(change) {
    const first = new Map(tiles.map(tile => [tile, tile.hidden ? null : tile.getBoundingClientRect()]));
    change();
    if (reduced?.matches || !tiles[0]?.animate) return;
    for (const tile of tiles) {
      if (tile.hidden) continue;
      const from = first.get(tile);
      const to = tile.getBoundingClientRect();
      if (!from) {
        tile.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'ease-out' });
        continue;
      }
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      const sx = from.width / to.width;
      const sy = from.height / to.height;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) continue;
      tile.animate([{ transformOrigin: 'top left', transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})` }, { transformOrigin: 'top left', transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  }

  function apply(user) {
    const filtering = Boolean(selected);
    const hide = filtering && hideOthers;
    const results = new Map(matchTag(selected).map(result => [result.id, result]));
    let tilesShown = 0;
    let sitesShown = 0;
    (user ? flip : change => change())(() => {
      grid.classList.toggle('reflow', hide);
      for (const tile of tiles) {
        const result = results.get(tile.dataset.entry);
        const matches = Boolean(result?.matches);
        tile.hidden = hide && !matches;
        tile.classList.toggle('dim', filtering && !hide && !matches);
        const state = tile.querySelector('.tile-state');
        if (state) state.textContent = !filtering ? '' : matches ? 'Match' : 'Other topic';
        const steps = tile.querySelectorAll('.stairs [data-site]');
        for (const step of steps) {
          const on = filtering && result.memberIds.includes(step.dataset.site);
          step.classList.toggle('is-match', on);
          step.classList.toggle('is-off', filtering && !on);
        }
        if (matches) {
          tilesShown += 1;
          sitesShown += steps.length ? result.memberIds.length : 1;
        }
      }
    });
    update();
    optionState.textContent = hideOthers ? 'On' : 'Off';
    const others = hideOthers ? 'Other topics are hidden.' : 'Other topics are dimmed, not hidden.';
    status.textContent = filtering
      ? `Topic: ${selected}. ${sitesShown} of ${total} learning sites match. ${others}`
      : `Showing all ${total} learning sites. Pick a topic to filter. ${others.replace('Other topics are', 'Other topics will be').replace(', not hidden', '')}`;
    if (tilesShown === 0) status.textContent += ' Nothing matches.';
    if (user) {
      const url = new URL(location.href);
      if (selected) url.searchParams.set('topic', selected); else url.searchParams.delete('topic');
      try { history.replaceState(null, '', url); } catch { /* Filtering still works. */ }
    }
  }

  box.addEventListener('change', () => { hideOthers = box.checked; apply(false); });
  build();
  apply(false);
  host.hidden = false;
}
