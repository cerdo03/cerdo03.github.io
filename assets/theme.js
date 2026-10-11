import { defaultTheme } from './theme-config.js';
import { resolveTheme } from './theme-model.js';

document.documentElement.dataset.theme = resolveTheme(defaultTheme);
