// Structural dependencies, not measured attention weights or numeric embeddings.
const tokens = ['The', 'sky', 'is'];
export function routeState(layer, head, position) {
  if (![1, 2].includes(layer) || ![1, 2].includes(head) || ![0, 1, 2].includes(position)) throw new RangeError('Invalid layer, head or token position.');
  return {
    inputs: tokens.map((token, i) => ({token, position: i, sourceLayer: layer - 1, context: layer === 1 ? [i] : Array.from({length: i + 1}, (_, j) => j)})),
    rows: tokens.map((token, i) => ({token, position: i, layer, head})),
    allowed: Array.from({length: position + 1}, (_, j) => j),
  };
}
const tag = (role, layer, head, token) => `<var>${role}</var><small>L${layer} · H${head} · ${token}</small>`;
const chips = indices => indices.map(i => `<span class="route-token" data-token="${i}">${tokens[i]}</span>`).join('');
const arrow = label => `<div class="connector">↓ ${label}</div>`;
export function mountVectorRoutes(root, initialPosition = 2) {
  let layer = 1, head = 1, position = initialPosition, step = 0;
  function render(focus) {
    const data = routeState(layer, head, position);
    const current = tokens[position];
    const inputs = `<div class="route-columns">${data.inputs.map(row => `<div class="route-box ${row.position === position ? 'route-selected' : ''}"><strong><var>x</var> · ${row.token}</strong><small>${layer === 1 ? 'Embedding' : 'Layer 1 block output'}</small><div class="route-context">${chips(row.context)}</div></div>`).join('')}</div>`;
    let body = `<div class="route-controls"><label>Layer<select data-route="layer"><option value="1" ${layer === 1 ? 'selected' : ''}>1</option><option value="2" ${layer === 2 ? 'selected' : ''}>2</option></select></label><label>Head<select data-route="head"><option value="1" ${head === 1 ? 'selected' : ''}>1</option><option value="2" ${head === 2 ? 'selected' : ''}>2</option></select></label><label>Token<select data-route="position">${tokens.map((t,i)=>`<option value="${i}" ${position===i?'selected':''}>${t}</option>`).join('')}</select></label></div>`;
    body += '<div class="route-legend"><span>Prefill · 2 layers · 2 heads · MHA schematic · normalization omitted</span><span>Token chips = possible context, not vector components</span></div>';
    body += `<div class="route-stage" role="status">${['Incoming vectors','Create this head’s Q/K/V','Compare Q with allowed K rows','Mix the corresponding V rows','Complete this token’s block'][step]}</div>`;
    body += `<div class="route-boundary"><span>Layer ${layer} input · shared by both heads</span>${inputs}</div>`;
    if (step === 1) {
      body += arrow(`Layer ${layer} · Head ${head} projections`);
      body += `<div class="route-boundary"><span>K/V cache rows · Layer ${layer} · Head ${head}</span><div class="route-columns">${data.rows.map(row=>`<div class="route-box ${row.position>position?'route-blocked':''}"><strong>${row.token}</strong><div class="route-pair"><div><small>↓ <var>x</var>(${row.token}) × <var>W</var><sub>K</sub></small>${tag('K',layer,head,row.token)}</div><div><small>↓ <var>x</var>(${row.token}) × <var>W</var><sub>V</sub></small>${tag('V',layer,head,row.token)}</div></div>${row.position>position?'<small>× Future row: blocked</small>':'<small>✓ Allowed row</small>'}</div>`).join('')}</div></div><div class="connector">${current}’s <var>x</var> → <var>W</var><sub>Q</sub> → ${tag('Q',layer,head,current)}</div>`;
    }
    if (step === 2) {
      body += `<div class="route-fan"><div class="route-box route-selected">${tag('Q',layer,head,current)}</div>${arrow('compare with each allowed K')}<svg class="route-branches" viewBox="0 0 600 45" preserveAspectRatio="none" role="img" aria-label="One current query compares with the allowed key rows">${[0,1,2].map(j=>`<path class="${j>position?'route-blocked':''}" d="M300 0 V15 H${100+j*200} V45"/>`).join('')}</svg><div class="route-columns">${data.rows.map(row=>`<div class="route-box ${row.position>position?'route-blocked':''}">${tag('K',layer,head,row.token)}<div class="connector">${row.position>position?'× masked':'↓ dot product → scaled score'}</div><strong>${row.position>position?'0':'score'}</strong></div>`).join('')}</div>${arrow('softmax across allowed scores → shares')}</div>`;
    }
    if (step === 3) {
      body += arrow('the shares scale the matching V rows');
      body += `<div class="route-columns">${data.rows.map(row=>`<div class="route-box ${row.position>position?'route-blocked':''}">${tag('V',layer,head,row.token)}<div class="connector">× ${row.position>position?'0':'its share'}</div></div>`).join('')}</div>${arrow('add contribution vectors')}<div class="route-box route-selected"><strong>Head ${head} result · ${current}</strong><small>Layer ${layer} · not a cached K/V row</small></div>`;
    }
    if (step === 4) {
      body += `<div class="route-columns route-two">${[1,2].map(h=>`<div class="route-box ${h===head?'route-selected':''}"><strong>Head ${h} result · ${current}</strong><small>Layer ${layer}</small></div>`).join('')}</div>${arrow('concatenate → <var>W</var><sub>O</sub>')}<div class="route-columns route-two"><div class="route-box"><strong>Attention update</strong></div><div class="route-box"><strong>Incoming <var>x</var> · ${current}</strong><small>Residual bypass</small>${chips(data.inputs[position].context)}</div></div>${arrow('residual addition → feed-forward → residual addition')}<div class="route-box route-selected"><strong>Layer ${layer} block output · ${current}</strong><div class="route-context">${chips(data.allowed)}</div></div>${arrow(layer===1?'Layer 2 input for the same token':position===2?'final normalization → vocabulary projection → next-token scores':'final normalization → final representation')}`;
    }
    const actions = `<div class="route-controls route-actions"><button type="button" data-route-back ${step===0?'disabled':''}>← Previous operation</button><span>${step+1} / 5</span><button type="button" data-route-next ${step===4&&layer===2?'disabled':''}>${step===4?(layer===1?'Follow into Layer 2 →':'End of diagram'):'Next operation →'}</button></div>`;
    root.innerHTML = actions + body;
    root.querySelectorAll('select').forEach(select=>select.onchange=()=>{const key=select.dataset.route;if(key==='layer'){layer=Number(select.value);step=0;}if(key==='head')head=Number(select.value);if(key==='position')position=Number(select.value);render(`[data-route="${key}"]`);});
    root.querySelector('[data-route-back]').onclick=()=>{step=Math.max(0,step-1);render('[data-route-back]');};
    root.querySelector('[data-route-next]').onclick=()=>{if(step===4){layer=2;step=0;}else step++;render('[data-route-next]');};
    if(focus) root.querySelector(focus)?.focus({preventScroll:true});
  }
  root.classList.add('vector-routes');root.setAttribute('aria-label','Token vector routes through layers and heads');
  render();
}
