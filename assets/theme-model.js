const themeIds = ['paper', 'midnight', 'contrast'];

export function resolveTheme(defaultTheme) {
  return themeIds.includes(defaultTheme) ? defaultTheme : 'paper';
}
