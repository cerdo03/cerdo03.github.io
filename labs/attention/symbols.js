// Inline symbol explanations: hovering, focusing or tapping a known symbol shows its meaning
// from glossary.js. Screen readers get the same text through aria-describedby. Symbols that
// lesson scripts render later are annotated as they appear.
import { glossary, symbolKey, tensorKey } from './glossary.js';

const descriptions = document.createElement('div');
descriptions.hidden = true;
for (const [key, text] of Object.entries(glossary)) {
  descriptions.append(Object.assign(document.createElement('span'), { id: `sym-${key}`, textContent: text }));
}

const tip = document.createElement('div');
tip.className = 'symbol-tip';
tip.setAttribute('aria-hidden', 'true');
tip.hidden = true;
document.body.append(descriptions, tip);

let active = null;

function label(key) {
  const [base, sub] = key.split('_');
  const symbol = Object.assign(document.createElement('var'), { textContent: base });
  const parts = [symbol];
  if (sub) parts.push(Object.assign(document.createElement('sub'), { textContent: sub }));
  return [...parts, ` — ${glossary[key]}`];
}

function show(node) {
  active = node;
  tip.replaceChildren(...label(node.dataset.symbol));
  tip.hidden = false;
  const box = node.getBoundingClientRect();
  const margin = 8;
  const width = tip.offsetWidth;
  const left = Math.min(Math.max(margin, box.left + box.width / 2 - width / 2), window.innerWidth - width - margin);
  const below = box.bottom + margin + tip.offsetHeight <= window.innerHeight;
  tip.style.left = `${left}px`;
  tip.style.top = `${below ? box.bottom + margin : box.top - margin - tip.offsetHeight}px`;
}

function hide() {
  active = null;
  tip.hidden = true;
}

function annotate(root) {
  const nodes = root.querySelectorAll ? root.querySelectorAll('var:not([data-symbol]), .tensor-tag:not([data-symbol])') : [];
  for (const node of nodes) {
    const key = node.tagName === 'VAR' ? symbolKey(node) : tensorKey(node);
    if (!key) continue;
    node.dataset.symbol = key;
    node.classList.add('sym');
    node.tabIndex = 0;
    node.removeAttribute('title');
    node.setAttribute('aria-describedby', `sym-${key}`);
  }
}

annotate(document.body);
new MutationObserver((records) => {
  for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1) annotate(node.parentNode || node);
}).observe(document.querySelector('main') || document.body, { childList: true, subtree: true });

const symbolAt = (target) => target.closest?.('[data-symbol]');

document.addEventListener('pointerover', (event) => {
  if (event.pointerType !== 'mouse') return;
  const node = symbolAt(event.target);
  if (node && node !== active) show(node);
});
document.addEventListener('pointerout', (event) => {
  if (event.pointerType !== 'mouse') return;
  const node = symbolAt(event.target);
  if (node && !node.contains(event.relatedTarget) && document.activeElement !== node) hide();
});
document.addEventListener('focusin', (event) => {
  const node = symbolAt(event.target);
  if (node) show(node); else hide();
});
document.addEventListener('focusout', (event) => {
  if (symbolAt(event.target) === active) hide();
});
// Tap: show on the symbol, dismiss anywhere else.
document.addEventListener('click', (event) => {
  const node = symbolAt(event.target);
  if (node) show(node); else hide();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && active) hide();
});
window.addEventListener('scroll', () => { if (active) show(active); }, { passive: true });
window.addEventListener('resize', hide);
