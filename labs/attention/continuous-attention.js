import {mountLearningVisual,disposeVisual} from '../llm-systems/learning-visuals.js';
// One input state for the main self-attention walkthrough; detailed reference examples stay separate.
import { attentionState, representations, promptTokens } from '../inference/guide-model.js';
import { fmtNumber, fmtWeight } from './ui.js';
import {mountVectorRoutes} from './vector-routes.js';
const vector = row => `[${row.map(x => fmtNumber(x, 3)).join(', ')}]`;
const symbol = text => text.replace(/\b(WQ|WK|WV|WO|Q|K|V|M|x)\b/g, name => name.startsWith('W') ? `<var>W</var><sub>${name[1]}</sub>` : `<var>${name}</var>`);
const node = (title, body) => `<div class="mechanism-node"><strong>${symbol(title)}</strong><div>${symbol(body)}</div></div>`;
const arrow = text => `<div class="connector">↓ ${text}</div>`;
const key = 'inference-course-v4';
let state = { rows: representations.map(row => [...row]), position: 2 };
try {
  const saved = JSON.parse(localStorage.getItem(key));
  if (saved && saved.embeddings?.length === 3 && saved.embeddings.every(row => row.length === 2 && row.every(x => Number.isFinite(x) && Math.abs(x) <= 4))) state = { rows: saved.embeddings, position: [0, 1, 2].includes(saved.attention?.position) ? saved.attention.position : 2 };
} catch { /* The lesson works without storage. */ }
const roots = [];
function renderAll() {
  const a = attentionState(state.position, undefined, state.rows), i = state.position;
  const q = a.q;
  const raw = a.keys.map(k => q[0] * k[0] + q[1] * k[1]);
  for (const { root, stage } of roots) {
    disposeVisual(root);root.querySelectorAll('.teaching-visual').forEach(disposeVisual);
    const numericOpen = root.querySelector('.course-detail')?.open;
    let body = `<p class="location">Prefill · first layer · one head · position ${i + 1}: ${promptTokens[i]}</p><label>Inspect token position<select data-position>${promptTokens.map((token, j) => `<option value="${j}" ${i === j ? 'selected' : ''}>${j + 1}: ${token}</option>`).join('')}</select></label>`;
    if (stage === 1) {
      body += `<div class="node-grid">${promptTokens.map((token, j) => node(`${j + 1}: ${token}`, `<small>${j === i ? 'Current position: may read itself' : j < i ? 'Earlier position: may supply information' : 'Later position: blocked by the causal mask'}</small>`)).join('')}</div><p>All three prompt tokens were supplied together. The causal mask still prevents a position from reading tokens to its right. We are updating the vector for “${promptTokens[i]}”, not choosing an answer token. Availability is different from contribution strength: the following concepts show how the strengths are calculated.</p>`;
    } else {
    if (stage === 2) body += node(`Incoming x for “${promptTokens[i]}”`, `${vector(a.x)}<small>One vector for this token. In this first-layer toy it is the embedding; later layers receive the previous layer’s updated vector.</small>`);
    if ([3, 4, 6].includes(stage)) body += node(`Q for “${promptTokens[i]}”`, `${vector(q)}<small>The query calculated in the projection step. Changing the inspected position chooses a different query row.</small>`);
    if (stage === 2) {
    body += arrow('fixed learned matrices create three different roles');
    body += `<div class="node-grid">${node('Q = x × WQ', `${vector(q)}<small>Compare with keys. WQ keeps both components.</small><details><summary>Matrix calculation</summary><p>x × [[1, 0], [0, 1]] = Q</p></details>`)}${node('K = x × WK', `${vector(a.keys[i])}<small>Can be cached. WK swaps components.</small><details><summary>Matrix calculation</summary><p>x × [[0, 1], [1, 0]] = K</p></details>`)}${node('V = x × WV', `${vector(a.values[i])}<small>Can be cached. WV doubles the first component.</small><details><summary>Matrix calculation</summary><p>x × [[2, 0], [0, 1]] = V</p></details>`)}</div>`;
    }
    if (stage === 3 || stage === 4) {
      body += arrow('Q compares with each key; one score per position');
      body += `<div class="node-grid">${a.keys.map((k, j) => node(`${j + 1}: ${promptTokens[j]}`, `Q ${vector(q)} · K ${vector(k)} ≈ ${fmtNumber(raw[j], 3)}<small>${fmtNumber(q[0], 3)} × ${fmtNumber(k[0], 3)} + ${fmtNumber(q[1], 3)} × ${fmtNumber(k[1], 3)}</small>${stage >= 4 ? `<p>Divide by √2 → ≈ ${fmtNumber(raw[j] / Math.sqrt(2), 3)}</p>` : ''}${stage >= 6 && j > i ? '<small>Future position: blocked by the causal mask.</small>' : ''}`)).join('')}</div>`;
    }
    if (stage === 5) body += '<p>No causal mask yet: this step isolates softmax. The next concept blocks future positions.</p>';
    if (stage >= 5 && stage <= 7) {
      const scores = raw.map((x, j) => stage >= 6 && j > i ? -Infinity : x / Math.sqrt(2));
      const max = Math.max(...scores), exp = scores.map(x => Math.exp(x - max)), sum = exp.reduce((x, y) => x + y, 0), weights = exp.map(x => x / sum);
      if (stage === 5) body += `<div class="node-grid">${scores.map((score, j) => node(promptTokens[j], `Scaled score ≈ ${fmtNumber(score, 3)}<br>exp(score − maximum) ≈ ${fmtNumber(exp[j], 3)}`)).join('')}</div><p>Divide each exponential by their sum ≈ ${fmtNumber(sum, 3)}. That gives one share per position.</p>`;
      if (stage === 6) body += `<div class="node-grid">${scores.map((score, j) => node(promptTokens[j], j > i ? 'Future position → masked score −∞ → exactly zero weight' : `Allowed position → scaled score ≈ ${fmtNumber(score, 3)}`)).join('')}</div><p>In causal attention the mask is applied before softmax. Inspect “sky” to see the later token “is” blocked. The last position has no future positions to block.</p>`;
      body += arrow(stage >= 6 ? 'softmax over allowed scores; future weights are exactly zero' : 'softmax makes non-negative weights that sum to 1');
      body += `<div class="node-grid">${weights.map((weight, j) => node(promptTokens[j], `<strong>${fmtWeight(weight)}</strong><small>${weight === 0 ? 'Masked: no contribution' : `≈ ${fmtNumber(weight * 100, 2)}% of the value mixture`}</small>`)).join('')}</div>`;
      if (stage === 7) {
        body += arrow('multiply each V by its weight, then add components');
        body += `<div class="node-grid">${a.values.map((value, j) => node(`V at “${promptTokens[j]}”`, `${vector(value)} × ${fmtWeight(weights[j])} ≈ ${vector(value.map(x => x * weights[j]))}`)).join('')}</div>`;
        body += node('Attention result', `${vector(a.output)}<small>One vector, not three vectors and not a predicted word. These are full-precision calculations displayed with rounding.</small>`);
      }
    }
    if (stage >= 8) {
      body += node('Attention result from the preceding concept', vector(a.output));
      body += node('Full attention operation', 'softmax(QKᵀ / √2 + M)V produces the attention result above. Q/K determine weights; V supplies the information to combine.');
      body += arrow('output projection; assume WO is identity only for this toy arithmetic');
      body += `<div class="node-grid">${node('Incoming x takes a direct path', vector(a.x))}${node('Attention branch supplies an update', vector(a.output))}</div>`;
      body += arrow('residual addition: add matching components');
      body += node('After this residual addition', vector(a.x.map((x, d) => x + a.output[d])));
      body += arrow('feed-forward processing → another residual addition → next layer');
      body += node('Updated vector for the same token', 'The next layer receives one vector of the same width, not Q/K/V. Its own matrices create new Q/K/V. Normalization is omitted in this illustration. Only the final layer’s last-position representation goes to vocabulary scores to choose a new token.');

    }
    }
    if (stage === 2) body += `<details class="course-detail"><summary>Experiment: shared starting embeddings</summary><p>Edit the starting vectors here. The inference module and every main diagram in this lesson use these same values. This is a tiny invented head; it does not simulate a trained model or predict answers.</p><div class="embedding-controls">${state.rows.map((row, j) => `<fieldset><legend>${promptTokens[j]}</legend>${row.map((x, d) => `<label>Component ${d + 1}<input type="number" min="-4" max="4" step="any" required data-row="${j}" data-dim="${d}" value="${x}"></label>`).join('')}</fieldset>`).join('')}</div><button type="button" data-apply>Apply shared embeddings</button><button type="button" data-reset>Use default embeddings</button></details>`;
    if (stage >= 2) body += '<p class="small">Invented toy values; displayed numbers are rounded, calculations use full precision.</p>';
    root.innerHTML = body;
    root.querySelector('[data-position]').onchange = event => { state.position = Number(event.target.value);save();renderAll();root.querySelector('[data-position]').focus({preventScroll:true}); };
    root.querySelector('[data-apply]')?.addEventListener('click', () => {
      const inputs = [...root.querySelectorAll('input')];
      const invalid = inputs.find(input => !input.checkValidity() || !Number.isFinite(input.valueAsNumber));
      if (invalid) { invalid.reportValidity();return; }
      inputs.forEach(input => { state.rows[Number(input.dataset.row)][Number(input.dataset.dim)] = input.valueAsNumber; });save();renderAll();root.querySelector('[data-apply]').closest('details').open = true;root.querySelector('[data-apply]').focus({preventScroll:true});
    });
    root.querySelector('[data-reset]')?.addEventListener('click', () => { state.rows = representations.map(row => [...row]);save();renderAll(); });
    if (stage === 2) {
      const experiment=root.querySelector('.course-detail');
      if(experiment)experiment.open=!!numericOpen;
      const diagram=document.createElement('div');root.replaceChildren(diagram);
      if(experiment)root.append(experiment);
      mountVectorRoutes(diagram, i);
    } else if(stage>=3&&stage<=7){
      mountLearningVisual(root,stage===7?'values':'scores',{stage:stage===5?4:[4,6].includes(stage)?3:0,rows:state.rows,onPosition:position=>{state.position=position;save();}});
    }
  }
}
function save() { try { const saved = JSON.parse(localStorage.getItem(key)) || {};saved.scenes ||= {};saved.checks ||= {};saved.concept ||= 'tokens';saved.embeddings = state.rows;saved.attention = {position: state.position};localStorage.setItem(key, JSON.stringify(saved)); } catch { /* Optional. */ } }
window.addEventListener('storage', event => { if (event.key !== key) return;try { const saved = JSON.parse(event.newValue);if (saved?.embeddings?.length === 3) { state.rows = saved.embeddings;renderAll(); } } catch { /* Optional. */ } });
for (let stage = 1; stage <= 8; stage++) {
  const section = document.getElementById(`s2-1-${stage}`);
  if (!section) continue;
  const root = document.createElement('div');root.className = 'lab shared-attention';root.setAttribute('aria-label', 'Continuous attention example');
  const heading = document.createElement('h3');heading.className = 'shared-example-title';heading.textContent = 'The sky is';
  (section.querySelector(':scope > p') || section.querySelector('h2')).after(heading, root);roots.push({root, stage});
}
renderAll();
