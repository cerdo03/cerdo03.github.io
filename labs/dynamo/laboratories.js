import { placementDiagram, treeDiagram } from './diagrams.js?v=dynamo20261023-final';
import { strategyPlacement, efficiency, balancedTokens, requestLoads } from './placement.js?v=dynamo20261023-final';
import { preferenceList } from './model.js?v=dynamo20261023-final';
import { merkleDiff, handoff } from './repair.js?v=dynamo20261023-final';

export function laboratory(index) {
  const section = document.createElement('section');
  const title = document.createElement('h2');
  title.textContent = 'Inspect a worked reconstruction';
  const output = document.createElement('pre');
  output.style.whiteSpace = 'pre-wrap';
  const controls = document.createElement('div');
  controls.className = 'controls';
  const button = (text, action) => {
    const control = document.createElement('button');
    control.type = 'button'; control.textContent = text;
    control.addEventListener('click', action); controls.append(control);
  };
  section.append(title, controls, output);
  if (index === 2) {
    const tokens = [{position:10,node:'A'}, {position:20,node:'A'}, {position:40,node:'B'}, {position:70,node:'C'}, {position:85,node:'D'}];
    const label = document.createElement('label'); label.textContent = 'Key position on a synthetic 0–99 ring ';
    const input = document.createElement('input'); input.type = 'range'; input.min = 0; input.max = 99; input.value = 15;
    label.append(input); controls.append(label);
    const visual = document.createElement('div');section.append(visual);
    const update = () => {
      const list = preferenceList(tokens, Number(input.value));
      visual.replaceChildren(placementDiagram(tokens, Number(input.value), list.slice(0,3)));
      output.textContent = `Tokens clockwise: 10:A → 20:A → 40:B → 70:C → 85:D → wrap to 10:A\nKey ${input.value} → owner ${list[0]}\nThree distinct replicas: ${list.slice(0,3).join(' → ')}\nExtended preference list: ${list.join(' → ')}\nA’s two tokens count as one physical host. This example has no datacenter constraint.`;
    };
    input.addEventListener('input', update); update();
  } else if (index === 5) {
    let hint = {home:'A',value:'cart version D2'};
    let home = 'old version D1';
    const update = message => { output.textContent = `${message}\nHome A: ${home}\nFallback D hint store: ${hint ? hint.value + ', intended for A' : 'empty'}\nHome placement remains A/B/C.`; };
    button('Attempt while A unreachable', () => { const state = handoff(hint, false); hint = state.hint; update('No confirmation: keep hinted copy.'); });
    button('Recover A and confirm transfer', () => { if (hint) { const state = handoff(hint, true); hint = state.hint; home = state.delivered; update('Confirmed delivery: temporary hint may be deleted.'); } else update('No surviving hint to deliver. Home state unchanged; successful recovery does not reconstruct lost data.'); });
    button('Lose fallback before delivery', () => { hint = null; update('Fallback copy lost. Home remains stale; this scenario has no other new copy. Handoff cannot reconstruct missing bytes.'); });
    button('Restart example', () => { hint = {home:'A',value:'cart version D2'}; home = 'old version D1'; update('A is unreachable; D holds a fallback copy.'); });
    update('A is unreachable; D holds a fallback copy.');
  } else if (index === 6) {
    const visual = document.createElement('div');section.append(visual);
    const base = {a:'1',b:'2',c:'3',d:'4',e:'5',f:'6',g:'7',h:'8'};
    const show = right => {
      const result = merkleDiff(base,right);
      visual.replaceChildren(treeDiagram(result));
      output.textContent = `Teaching assumption: canonical strings stand in for hashes; timing/cost is not a benchmark.\n${result.log.join('\n')}\nDiffering keys: ${result.keys.join(', ') || 'none'}\nCompared tree nodes: ${result.comparisons}. Actual differing values still need transfer.`;
    };
    button('Equal replicas', () => show(base));
    button('Change one key', () => show({...base,b:'new'}));
    button('Change two branches', () => show({...base,b:'new',h:'new'}));
    button('Remove a key', () => { const right = {...base}; delete right.f; show(right); });
    show(base);
  } else if (index === 7) {
    let recovered = false;
    const show = () => { output.textContent = `Membership on A and C: A,B,C remain members.\nA’s reachability view: B ${recovered ? 'reachable' : 'suspected unreachable'}.\nC’s reachability view: B reachable.\n${recovered ? 'Retry succeeds; A clears local suspicion.' : 'A uses an alternate target. C can still contact B. No permanent leave occurs.'}`; };
    button('A retries after path recovery', () => { recovered = true; show(); });
    button('Restore asymmetric partition', () => { recovered = false; show(); }); show();
  } else if (index === 8) {
    let strategy = 1; let joined = false; let hot = false;
    const show = () => {
      const nodes = joined ? ['A','B','C','X'] : ['A','B','C'];
      const tokens = strategy === 3 ? balancedTokens(nodes,12) : [
        {position:10,node:'A'},{position:40,node:'B'},{position:80,node:'C'},
        ...(joined ? [{position:30,node:'X'}] : [])];
      const state = strategyPlacement(strategy,15,tokens,12);
      const keys = hot ? Array(100).fill(15) : Array.from({length:100},(_,key)=>key);
      const counts = requestLoads(strategy,keys,tokens,12);
      const loads = Object.values(counts);
      output.textContent = `Strategy ${strategy}. Synthetic key 15. Partition end ${state.boundary.toFixed(2)}.\nPreference list: ${state.replicas.join(' → ')}\n${strategy === 1 ? 'Token positions determine variable partition boundaries.' : 'Twelve equal partitions retain their boundaries while owners change. This small toy does not satisfy the large-Q production tuning recommendation.'}\n${strategy === 3 ? 'Each host has exactly twelve / host-count tokens. Round-robin assignment is a deterministic teaching reconstruction, not Amazon’s unpublished allocator. Join rebuilds this toy assignment rather than simulating minimal movement.' : 'Fixed token sample stands in for randomly assigned tokens; no randomness resampled between comparisons.'}\n${joined ? 'X joined. Inspect changed owners.' : 'Three physical hosts.'}\nActual primary-request counts from the selected placement and same 100-request trace: ${JSON.stringify(counts)}.\nMean / maximum = ${efficiency(loads).toFixed(3)}. ${hot ? 'All requests use key 15: one primary is hot despite token balance.' : 'One request at each integer hash position.'}\nCounts model primary coordination only, not full production replica-serving load. No Figure 8 reproduction claimed.`;
    };
    for (const value of [1,2,3]) button(`Strategy ${value}`, () => { strategy = value; show(); });
    button('Toggle joining X', () => { joined = !joined; show(); });
    button('Toggle hot-key load', () => { hot = !hot; show(); }); show();
  } else if (index === 9) {
    let volatile = ['D2']; let durable = ['D1'];
    const show = message => { output.textContent = `${message}\nVolatile buffer: ${volatile.join(', ') || 'empty'}\nDurable storage: ${durable.join(', ') || 'empty'}\nSingle-replica teaching model; other replicas may survive independently.`; };
    button('Flush buffer', () => { durable = [...durable,...volatile]; volatile = []; show('Writer persists pending versions.'); });
    button('Crash and restart', () => { volatile = []; show('Volatile state lost; durable state survives modeled restart.'); });
    button('Restart scenario', () => { volatile = ['D2']; durable = ['D1']; show('D2 is acknowledged in memory, pending persistence.'); });
    show('D2 is acknowledged in memory, pending persistence.');
  } else return null;
  return section;
}
