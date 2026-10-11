import { defaultTheme } from './theme-config.js';
import { resolveAppearance } from './theme-model.js';

const storageKey = 'journal-appearance';
let appearance;
try { appearance = localStorage.getItem(storageKey); } catch { /* Use owner default. */ }
const button = document.createElement('button');
button.type = 'button';
button.className = 'theme-toggle';

function apply() {
  const theme = resolveAppearance(defaultTheme, appearance);
  document.documentElement.dataset.theme = theme;
  const dark = theme !== 'paper';
  button.textContent = dark ? 'Light mode' : 'Dark mode';
  button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
}

apply();
button.addEventListener('click', () => {
  appearance = document.documentElement.dataset.theme === 'paper' ? 'dark' : 'light';
  try { localStorage.setItem(storageKey, appearance); } catch { /* Apply for this visit. */ }
  apply();
});
const host = document.querySelector('.site-header nav, .topbar nav, main > header');
if (host) host.append(button);
window.addEventListener('storage', event => {
  if (event.key === storageKey || event.key === null) {
    appearance = event.newValue;
    apply();
  }
});
