// Carry only known equation origins between optional toolkit pages.
const equationOrigins = new Set(['softmax', 'scores', 'values', 'kv', 'projections', 'masking']);
export function equationContext(search) {
  const from = new URLSearchParams(search).get('from');
  return equationOrigins.has(from) ? `?from=${encodeURIComponent(from)}` : '';
}
