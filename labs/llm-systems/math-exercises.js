// Pure arithmetic and authored checkpoints. Visitor answers never leave this page.
export function stableSoftmax(logits) {
 if(!Array.isArray(logits)||!logits.length||logits.some(x=>typeof x!=='number'||Number.isNaN(x)||x===Infinity)) throw new RangeError('Use a nonempty row of finite scores; −Infinity may mark blocked positions.');
 let maximum=-Infinity;
 for(const value of logits) if(value>maximum) maximum=value;
 if(maximum===-Infinity) throw new RangeError('At least one position must remain unmasked.');
 const exponents=logits.map(value=>value===-Infinity?0:Math.exp(value-maximum));
 const denominator=exponents.reduce((sum,value)=>sum+value,0);
 return exponents.map(value=>value/denominator);
}
const returnLinks=Object.freeze({
 softmax:'../attention/lesson-1.html#s2-1-5',
 scores:'../attention/lesson-1.html#s2-1-3',
 values:'../attention/lesson-1.html#s2-1-7',
 kv:'../attention/lesson-5.html#s2-5-1',
 projections:'../attention/lesson-1.html#s2-1-2',
 masking:'../attention/lesson-1.html#s2-1-6',
});
export function resolveReturnLink(search='') {
 const key=new URLSearchParams(search).get('from');
 return Object.hasOwn(returnLinks,key)?returnLinks[key]:returnLinks.softmax;
}
export const exercises={
 notation:{prompt:'In aⱼ = exp(zⱼ − m) / Σₖ exp(zₖ − m), which index selects the single output being calculated?',choices:['k, because it appears under the sum','j, because it remains free on both sides','m, because it sets the maximum'],answer:1,hints:['Look at the subscript of the output a.','An index bound by Σ runs over many entries; a free index names one output.'],explanation:'j selects one output weight. k is bound by the sum and visits all allowed scores. m is the row maximum, a scalar value rather than an index.'},
};
export function evaluateChoice(id,choice) {
 const exercise=exercises[id];
 if(!exercise||!Number.isInteger(choice)||choice<0||choice>=exercise.choices.length) throw new RangeError('Choose one of the authored options.');
 return {correct:choice===exercise.answer,feedback:`${choice===exercise.answer?'Correct.':'Try tracing the symbols again.'} ${exercise.explanation}`};
}
function node(tag,text,className){const item=document.createElement(tag);if(text)item.textContent=text;if(className)item.className=className;return item;}
export function mountMathExercises(root=document) {
 const hosts=[...(root.matches?.('[data-math-exercise]')?[root]:[]),...root.querySelectorAll('[data-math-exercise]')];
 for(const host of hosts){
  const exercise=exercises[host.dataset.mathExercise];
  if(!exercise||host.dataset.exerciseMounted)continue;
  host.dataset.exerciseMounted='true';host.classList.add('math-practice');
  const fieldset=node('fieldset'),legend=node('legend',exercise.prompt),feedback=node('p');
  feedback.setAttribute('role','status');fieldset.append(legend);
  exercise.choices.forEach((choice,index)=>{
   const label=node('label'),input=document.createElement('input');input.type='radio';input.name=`math-${host.dataset.mathExercise}-${hosts.indexOf(host)}`;input.value=String(index);
   label.append(input,document.createTextNode(choice));fieldset.append(label);
  });
  const check=node('button','Check reasoning');check.type='button';
  check.addEventListener('click',()=>{const selected=fieldset.querySelector('input:checked');feedback.textContent=selected?evaluateChoice(host.dataset.mathExercise,Number(selected.value)).feedback:'Choose an answer first. You can reveal the explanation at any time.';});
  host.append(fieldset,check,feedback);
  for(const [index,hint] of exercise.hints.entries()){const details=node('details'),summary=node('summary',`Hint ${index+1}`);details.append(summary,node('p',hint));host.append(details);}
  const explanation=node('details');explanation.append(node('summary','Reveal explanation'),node('p',exercise.explanation));host.append(explanation);
 }
 for(const link of root.querySelectorAll('[data-math-return]'))link.setAttribute('href',resolveReturnLink(globalThis.location?.search||''));
 return hosts;
}
if(typeof document!=='undefined')mountMathExercises();
