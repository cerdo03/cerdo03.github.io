const themeIds = ['paper', 'midnight', 'contrast'];

export function resolveTheme(defaultTheme) {
  return themeIds.includes(defaultTheme) ? defaultTheme : 'paper';
}

export function resolveAppearance(defaultTheme, appearance) {
  if (appearance === 'dark') return 'midnight';
  if (appearance === 'light') return 'paper';
  return resolveTheme(defaultTheme);
}
