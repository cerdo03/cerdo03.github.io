import { matchTag, tagCounts, sites } from './learning-catalog.js';

// Homepage topic filter, driven by the learning catalog. Without JavaScript the full list stays visible.
// Markup contract: [data-topic-filter] (empty, hidden) and [data-site-grid] with <li data-entry> cards;
// collection cards list members as <li data-site>.
const host = document.querySelector('[data-topic-filter]');
const grid = document.querySelector('[data-site-grid]');

if (host && grid) {
  const visibleCount = 8;
  const counts = tagCounts();
  const total = Object.keys(sites).length;
  const params = new URLSearchParams(location.search);
  let selected = counts.some(item => item.tag === params.get('topic')) ? params.get('topic') : '';
  let expanded = counts.slice(visibleCount).some(item => item.tag === selected);

  const label = document.createElement('p');
  label.className = 'filter-label';
  label.id = 'filter-label';
  label.textContent = 'Filter by topic';
  const chips = document.createElement('div');
  chips.className = 'filter-chips';
  chips.setAttribute('role', 'group');
  chips.setAttribute('aria-labelledby', 'filter-label');
  const status = document.createElement('p');
  status.className = 'filter-status';
  status.setAttribute('role', 'status');
  host.replaceChildren(label, chips, status);

  const makeChip = (text, tag, count) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip-button';
    button.textContent = text;
    if (count) {
      const badge = document.createElement('span');
      badge.className = 'chip-count';
      badge.textContent = count;
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

  function apply(user) {
    const results = matchTag(selected);
    let entriesShown = 0;
    let sitesShown = 0;
    for (const result of results) {
      const card = grid.querySelector(`[data-entry="${result.id}"]`);
      if (!card) continue;
      card.hidden = !result.matches;
      if (result.matches) entriesShown += 1;
      const members = card.querySelectorAll('[data-site]');
      if (members.length > 1 || card.classList.contains('is-collection')) {
        for (const member of card.querySelectorAll('.member-list [data-site]')) {
          member.hidden = !!selected && !result.memberIds.includes(member.dataset.site);
          if (!member.hidden) sitesShown += 1;
        }
      } else if (result.matches) sitesShown += 1;
    }
    update();
    status.textContent = selected ? `${sitesShown} of ${total} sites tagged “${selected}”.` : '';
    if (user) {
      const url = new URL(location.href);
      if (selected) url.searchParams.set('topic', selected); else url.searchParams.delete('topic');
      try { history.replaceState(null, '', url); } catch { /* Filtering still works. */ }
    }
  }

  build();
  apply(false);
  host.hidden = false;
}
