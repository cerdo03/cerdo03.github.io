import { defaultTheme } from './theme-config.js';
import { resolveAppearance } from './theme-model.js';

// Applies the shared theme and wires every Light/Dark toggle on the page.
// Toggle markup: <button type="button" class="theme-toggle" data-theme-toggle></button>
// Include aria-label="Switch to dark mode" in static markup (html-validate requires a name); icons and
// the current label are filled in here.
// Pages that still use a legacy header get one toggle appended to their nav.
const storageKey = 'journal-appearance';
let appearance;
try { appearance = localStorage.getItem(storageKey); } catch { /* Use owner default. */ }

const icons = '<svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>'
  + '<svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

const toggles = new Set();

function apply() {
  const theme = resolveAppearance(defaultTheme, appearance);
  document.documentElement.dataset.theme = theme;
  const label = theme === 'paper' ? 'Switch to dark mode' : 'Switch to light mode';
  for (const toggle of toggles) {
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    toggle.dataset.ready = '';
  }
}

function flip() {
  appearance = document.documentElement.dataset.theme === 'paper' ? 'dark' : 'light';
  try { localStorage.setItem(storageKey, appearance); } catch { /* Apply for this visit. */ }
  apply();
}

export function bindThemeToggles(root = document) {
  for (const toggle of root.querySelectorAll('[data-theme-toggle]')) {
    if (toggles.has(toggle)) continue;
    toggles.add(toggle);
    toggle.type = 'button';
    if (!toggle.querySelector('svg')) toggle.innerHTML = icons;
    toggle.addEventListener('click', flip);
  }
  apply();
}

apply();
function bindDocument() {
  if (!document.querySelector('[data-theme-toggle], [data-chrome="header"]')) {
    const host = document.querySelector('.site-header nav, .topbar nav, main > header');
    if (host) {
      const legacy = document.createElement('button');
      legacy.className = 'theme-toggle';
      legacy.dataset.themeToggle = '';
      host.append(legacy);
    }
  }
  bindThemeToggles();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindDocument, { once: true });
else bindDocument();

window.addEventListener('storage', event => {
  if (event.key === storageKey || event.key === null) {
    appearance = event.newValue;
    apply();
  }
});
