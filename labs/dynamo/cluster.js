import { joinClocks } from './model.js?v=dynamo20261023-final';
import { repairVersions } from './repair.js?v=dynamo20261023-final';
export function createCluster() {
  return { stores: Object.fromEntries('ABCDEFG'.split('').map(node=>[node,[]])), hints: Object.fromEntries('ABCDEFG'.split('').map(node=>[node,[]])), homes: ['A','B','C'], sequence: 0, counters: {}, log: [] };
}
export function put(cluster, targets, context, value, coordinator) {
  const next = Math.max(cluster.counters[coordinator] || 0, context[coordinator] || 0)+1;
  cluster.counters[coordinator] = next;
  const clock = { ...context, [coordinator]: next };
  const version = { id: `v${++cluster.sequence}`, clock, value: [...value] };
  const missingHomes=cluster.homes.filter(node=>!targets.includes(node));
  let fallback=0;
  for (const node of targets) {
    if(cluster.homes.includes(node))cluster.stores[node] = repairVersions([...cluster.stores[node],version]);
    else cluster.hints[node].push({home:missingHomes[fallback++],version});
  }
  cluster.log.push(`Write ${version.id} through ${coordinator} to ${targets.join(', ')}.`);
  return version;
}
export function get(cluster, targets) {
  const versions = repairVersions(targets.flatMap(node=>[...cluster.stores[node],...cluster.hints[node].map(hint=>hint.version)]));
  return { versions, context: joinClocks(...versions.map(version=>version.clock)) };
}
export function heal(cluster) {
  for(const [holder,hints] of Object.entries(cluster.hints)) {
    for(const hint of hints) {
      cluster.stores[hint.home]=repairVersions([...cluster.stores[hint.home],hint.version]);
      cluster.log.push(`Confirmed hinted ${hint.version.id}: ${holder} → home ${hint.home}; remove temporary hint.`);
    }
    cluster.hints[holder]=[];
  }
  const versions=get(cluster,cluster.homes).versions;
  for(const node of cluster.homes)cluster.stores[node]=[...versions];
  cluster.log.push('Teaching repair event: home replicas exchange versions; retain concurrent siblings. Other candidate hosts receive no permanent copy.');
}
export function mergeCart(versions) {
  return [...new Set(versions.flatMap(version=>version.value))].sort();
}

// Single-key confirmed transfer abstraction; not a production join/race protocol.
export function changeHomes(cluster, newHomes, confirmed) {
  cluster.proposedHomes=[...newHomes];
  for(const node of newHomes){cluster.stores[node]??=[];cluster.hints[node]??=[];}
  if(!confirmed){cluster.log.push(`Placement change proposed: ${newHomes.join(', ')}. Source retains bytes until transfer confirmation.`);return;}
  const values=get(cluster,cluster.homes).versions;
  for(const node of newHomes)cluster.stores[node]=[...values];
  for(const node of cluster.homes)if(!newHomes.includes(node))cluster.stores[node]=[];
  cluster.homes=[...newHomes];
  cluster.log.push(`Confirmed key transfer to ${newHomes.join(', ')}; obsolete source copy removed.`);
}
