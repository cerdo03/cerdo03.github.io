// Shared site chrome: header, primary navigation, footer, theme toggle.
//
// ADOPTING THE CHROME ON A PAGE (journal post, collection, lesson, standalone lab)
//
//   <head>
//     <link rel="stylesheet" href="…/assets/theme.css">   <!-- tokens, always first -->
//     <link rel="stylesheet" href="…/assets/chrome.css">  <!-- header, footer, chips, buttons, cards -->
//     <script type="module" src="…/assets/chrome.js"></script>  <!-- also loads theme.js -->
//   </head>
//   <body>
//     <a class="chrome-skip" href="#main">Skip to content</a>
//     <header class="chrome-header" data-chrome="header" data-current="learn"></header>
//     <main id="main"> … </main>
//     <footer class="chrome-footer" data-chrome="footer"></footer>
//   </body>
//
// An EMPTY header/footer element is filled in by this module with the standard markup, so
// lab pages only need the one-line placeholders above. Any path depth works: links resolve
// from this module's URL. Replace the placeholder with the static markup built by
// headerMarkup()/footerMarkup() when a page must render without JavaScript (the homepage does).
//
//   data-current   learn | writing | books  marks the primary-nav item (aria-current="page").
//                  Optional: inferred from the path (/labs/ → learn, /journal/ → writing).
//   data-spy       on the header: also highlight sections #learn, #writing, #books while
//                  scrolling (homepage only; aria-current="location").
//   Breadcrumb     optional, plain markup inside the page, styled by chrome.css:
//                    <nav class="chrome-breadcrumb chrome-container" aria-label="Breadcrumb">
//                      <ol><li><a href="…/">Learn</a></li><li aria-current="page">Title</li></ol></nav>
//   Theme toggle   <button class="theme-toggle" data-theme-toggle aria-label="Switch to dark mode"></button> anywhere on the
//                  page; theme.js fills icons + the accessible name, persists the choice
//                  under localStorage "journal-appearance" and syncs other tabs.
//   Chips/badges/cards/buttons: classes documented at the top of chrome.css.
import { bindThemeToggles } from './theme.js';

const root = new URL('../', import.meta.url).pathname;

const nav = [
  { key: 'learn', label: 'Learn', href: '#learn' },
  { key: 'writing', label: 'Writing', href: '#writing' },
  { key: 'books', label: 'Books', href: '#books' },
];

export function headerMarkup(base = root, current = '') {
  const links = nav.map(item => `<a href="${base}${item.href}" data-nav="${item.key}"${item.key === current ? ' aria-current="page"' : ''}>${item.label}</a>`).join('');
  return `<div class="chrome-container chrome-header-inner">
  <a class="chrome-brand" href="${base}" aria-label="Surya, home"><span class="chrome-mark" aria-hidden="true">S</span>Surya</a>
  <nav class="chrome-nav" aria-label="Primary">${links}</nav>
  <button type="button" class="theme-toggle" data-theme-toggle aria-label="Switch to dark mode"></button>
</div>`;
}

export function footerMarkup(base = root) {
  return `<div class="chrome-container chrome-footer-inner">
  <span>Surya’s personal journal</span>
  <nav aria-label="Footer"><a href="${base}#learn">Learn</a><a href="${base}#writing">Writing</a><a href="${base}#books">Books</a><a href="https://github.com/cerdo03">GitHub <span aria-hidden="true">↗</span></a></nav>
</div>`;
}

function inferCurrent(path) {
  if (path.startsWith(`${root}labs/`)) return 'learn';
  if (path.startsWith(`${root}journal/`)) return 'writing';
  return '';
}

function spy(header) {
  const links = new Map([...header.querySelectorAll('[data-nav]')].map(link => [link.dataset.nav, link]));
  const sections = nav.map(item => document.getElementById(item.key)).filter(Boolean);
  if (!sections.length || !('IntersectionObserver' in window)) return;
  const visible = new Set();
  const update = () => {
    const first = sections.find(section => visible.has(section));
    for (const [key, link] of links) {
      if (first?.id === key) link.setAttribute('aria-current', 'location');
      else if (link.getAttribute('aria-current') === 'location') link.removeAttribute('aria-current');
    }
  };
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target);
    update();
  }, { rootMargin: '-72px 0px -55% 0px' });
  for (const section of sections) observer.observe(section);
}

export function mountChrome(doc = document) {
  const header = doc.querySelector('[data-chrome="header"]');
  if (header) {
    if (!header.firstElementChild) {
      const current = header.dataset.current || inferCurrent(location.pathname);
      header.innerHTML = headerMarkup(root, current);
    }
    if ('spy' in header.dataset) spy(header);
  }
  const footer = doc.querySelector('[data-chrome="footer"]');
  if (footer && !footer.firstElementChild) footer.innerHTML = footerMarkup(root);
  bindThemeToggles(doc);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mountChrome(), { once: true });
else mountChrome();
