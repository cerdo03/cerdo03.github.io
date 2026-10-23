// Educational model of the 2007 paper; no production timing claims.
export function compareClocks(left, right) {
  const nodes = new Set([...Object.keys(left), ...Object.keys(right)]);
  let smaller = false;
  let larger = false;
  for (const node of nodes) {
    smaller ||= (left[node] ?? 0) < (right[node] ?? 0);
    larger ||= (left[node] ?? 0) > (right[node] ?? 0);
  }
  if (smaller && larger) return 'concurrent';
  if (smaller) return 'ancestor';
  if (larger) return 'descendant';
  return 'equal';
}

export function joinClocks(...clocks) {
  const result = {};
  for (const clock of clocks) {
    for (const [node, counter] of Object.entries(clock)) {
      result[node] = Math.max(result[node] ?? 0, counter);
    }
  }
  return result;
}

export function preferenceList(tokens, keyPosition) {
  const ordered = [...tokens].sort((a, b) => a.position - b.position);
  const first = ordered.findIndex(token => token.position >= keyPosition);
  const offset = first < 0 ? 0 : first;
  return [...new Set([...ordered.slice(offset), ...ordered.slice(0, offset)]
    .map(token => token.node))];
}
