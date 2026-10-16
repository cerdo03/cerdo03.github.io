import { renderMath } from './math-renderer.js';
import { glossary } from '../attention/glossary.js';
import { stableSoftmax, mountMathExercises } from './math-exercises.js';
export const equationDefinitions={
 'softmax-stable':{
  tex:String.raw`a_j=\frac{e^{z_j-m}}{\sum_k e^{z_k-m}},\qquad m=\max_k z_k`,
  label:'Stable softmax: each shifted exponential divided by their sum',
  purpose:'Turn a row of scores into nonnegative weights that sum to one, while avoiding exponential overflow.',
  symbols:{'aⱼ':'One output weight, selected by free index j','zⱼ':'The score at position j','k':'Reduction index: visits every allowed position in the denominator','m':'Maximum score in this row'},
  steps:['Read one output first: j selects one numerator and one resulting weight.','The denominator sums the shifted exponentials over k. It is shared by every output in the row.','Subtracting m multiplies the numerator and denominator by the same factor exp(−m), so the ideal real-number ratio is unchanged. Floating-point implementations differ: shifting prevents overflow.'],
  practice:'softmax',origin:'softmax',
 },
};
function node(tag,text){const item=document.createElement(tag);if(text)item.textContent=text;return item;}
function disclosure(title){const details=node('details');details.append(node('summary',title));return details;}
export function mountEquationExplorers(root=document){
 const hosts=[...(root.matches?.('[data-equation]')?[root]:[]),...root.querySelectorAll('[data-equation]')];
 for(const host of hosts){
  const definition=equationDefinitions[host.dataset.equation];if(!definition||host.dataset.equationMounted)continue;
  host.dataset.equationMounted='true';host.classList.add('equation-explorer');
  const equation=node('div');equation.className='explorer-equation';host.append(equation,node('p',definition.purpose));
  renderMath(equation,definition.tex,{displayMode:true,label:definition.label});
  const key=node('dl');key.className='explorer-key';
  for(const [symbol,meaning] of Object.entries(definition.symbols)){key.append(node('dt',symbol),node('dd',glossary[symbol]||meaning));}host.append(key);
  const decode=disclosure('Decode');for(const step of definition.steps)decode.append(node('p',step));
  const compute=disclosure('Compute'),prediction=node('p','Before revealing: which score receives the largest weight? Does shifting every score change the weights?'),reveal=disclosure('Reveal numerical example');
  const logits=[4,8,2,6],weights=stableSoftmax(logits);reveal.append(node('p',`Illustrative scores: [${logits.join(', ')}]. Maximum = 8. Shifted scores = [−4, 0, −6, −2].`),node('p',`Computed weights ≈ [${weights.map(x=>x.toFixed(6)).join(', ')}]. The score 8 gets the largest weight. The weights sum to approximately 1.`));compute.append(prediction,reveal);
  const practice=disclosure('Practice'),exercise=node('div');exercise.dataset.mathExercise=definition.practice;practice.append(exercise);
  const learn=node('a','Read the optional math toolkit');learn.href=`../math-fluency/lesson-1.html?from=${definition.origin}`;
  const understand=disclosure('Understand this equation');understand.append(decode,compute,practice,learn);host.append(understand);mountMathExercises(host);
 }
 return hosts;
}
if(typeof document!=='undefined')mountEquationExplorers();
