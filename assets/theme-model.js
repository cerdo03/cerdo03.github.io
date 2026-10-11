export const themeIds = ['paper', 'midnight', 'contrast'];

export function resolveTheme(defaultTheme, preference) {
  const fallback = themeIds.includes(defaultTheme) ? defaultTheme : 'paper';
  return themeIds.includes(preference) ? preference : fallback;
}
