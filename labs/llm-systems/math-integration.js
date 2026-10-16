import { renderMath } from './math-renderer.js';
import { mountEquationExplorers } from './equation-explorer.js';

// These are operation identities, without any future computed numeric results.
export const visualEquations = {
  projections: String.raw`Q=xW_Q,\quad K=xW_K,\quad V=xW_V`,
  scores: String.raw`\begin{aligned}s_j&=\frac{\sum_{c=1}^{2}Q_cK_{jc}}{\sqrt 2}\\a&=\operatorname{softmax}(s+M)\end{aligned}`,
  values: String.raw`o=\sum_j a_jv_j`,
};
export function renderVisualMath(root, type) {
  const tex = visualEquations[type], formula = root.querySelector('.route-formula');
  if (tex && formula) renderMath(formula, tex, { displayMode: true });
}

const conceptEquations = {
  qkv: ['qkv-projection', 'projections', 5],
  scores: ['attention-scores', 'scores', 3],
  mix: ['weighted-values', 'values', 2],
  memory: ['kv-memory', 'kv', 5],
};
export function mountConceptMath(root, concept) {
  const entry = conceptEquations[concept];
  if (!entry || root.querySelector('[data-concept-math]')) return;
  const [equation, origin, lesson] = entry, doc = root.ownerDocument;
  const block = doc.createElement('div');block.dataset.conceptMath = concept;
  const link = doc.createElement('a');link.href = `../math-fluency/lesson-${lesson}.html?from=${origin}`;link.textContent = 'Need help reading the math?';
  const host = doc.createElement('div');host.dataset.equation = equation;
  block.append(link, host);root.querySelector('.depth')?.before(block);
  mountEquationExplorers(block);
}
