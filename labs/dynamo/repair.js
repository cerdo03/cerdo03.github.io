import { compareClocks } from './model.js?v=dynamo20261023-final';

export function repairVersions(versions) {
  return versions.filter((version, index) => !versions.some((other, otherIndex) =>
    index !== otherIndex && (compareClocks(version.clock, other.clock) === 'ancestor'
    || (otherIndex < index && compareClocks(version.clock, other.clock) === 'equal'))));
}

export function handoff(hint, confirmed) {
  return confirmed ? { hint: null, delivered: hint.value } : { hint, delivered: null };
}

// Exact canonical strings stand in for cryptographic hashes in this teaching tree.
// Equality is exact; no production hash performance or collision claims follow.
export function merkleDiff(left, right) {
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  const differing = [];
  const log = [];
  let comparisons = 0;
  const nodes = [];
  function visit(range, path = '') {
    comparisons++;
    const encode = data => JSON.stringify(range.map(key => [key, Object.hasOwn(data, key), data[key]]));
    const equal = encode(left) === encode(right);
    nodes.push({ path, keys: [...range], equal });
    log.push(`${range.join(', ') || 'empty range'}: ${equal ? 'equal, stop' : 'different, inspect'}`);
    if (equal) return;
    if (range.length === 1) { differing.push(range[0]); return; }
    const middle = Math.ceil(range.length / 2);
    visit(range.slice(0, middle), `${path}L`);
    visit(range.slice(middle), `${path}R`);
  }
  visit(keys);
  return { keys: differing, comparisons, log, nodes };
}
