import { defaultTheme } from './theme-config.js';
import { resolveTheme, themeIds } from './theme-model.js';

const storageKey = 'surya-journal-theme';
let preference = 'site';
try { preference = localStorage.getItem(storageKey) || 'site'; } catch { /* Theme still works without storage. */ }

function applyTheme(value) {
  preference = themeIds.includes(value) ? value : 'site';
  document.documentElement.dataset.theme = resolveTheme(defaultTheme, preference);
  document.querySelectorAll('[data-theme-picker]').forEach((picker) => { picker.value = preference; });
}

applyTheme(preference);
document.querySelectorAll('[data-theme-picker]').forEach((picker) => {
  picker.addEventListener('change', () => {
    applyTheme(picker.value);
    try { localStorage.setItem(storageKey, preference); } catch { /* Keep this page usable. */ }
  });
});
window.addEventListener('storage', (event) => {
  if (event.key === storageKey || event.key === null) applyTheme(event.newValue || 'site');
});
