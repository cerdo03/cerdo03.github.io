export const glossary={N:'Number of distinct replica hosts targeted for a key.',R:'Minimum participating replicas required for a successful read.',W:'Minimum acknowledgements required for a successful write.',S:'Number of physical storage hosts in the partition strategy.',T:'Placement tokens assigned per physical host in strategies 1 and 2.',Q:'Number of equal fixed hash-space partitions.',U:'Set of replicas participating in a read in the fixed-set overlap derivation.',V:'Set of replicas acknowledging a write in the fixed-set overlap derivation.'};
const description=document.createElement('div');description.hidden=true;
for(const [symbol,meaning] of Object.entries(glossary)){const span=document.createElement('span');span.id=`dynamo-symbol-${symbol}`;span.textContent=meaning;description.append(span);}
const tip=document.createElement('div');tip.className='symbol-help';tip.hidden=true;tip.setAttribute('role','tooltip');document.body.append(description,tip);
function hide(){tip.hidden=true;}
function show(node){if(!node?.dataset.dynamoSymbol)return;tip.textContent=`${node.textContent} — ${glossary[node.dataset.dynamoSymbol]}`;tip.hidden=false;const box=node.getBoundingClientRect();tip.style.left=`${Math.max(8,Math.min(box.left,innerWidth-tip.offsetWidth-8))}px`;tip.style.top=`${Math.max(8,Math.min(box.bottom+8,innerHeight-tip.offsetHeight-8))}px`;}
document.addEventListener('pointerover',event=>show(event.target.closest('[data-dynamo-symbol]')));
document.addEventListener('pointerout',event=>{if(event.target.closest('[data-dynamo-symbol]'))hide();});
document.addEventListener('focusin',event=>{const node=event.target.closest('[data-dynamo-symbol]');if(node)show(node);else hide();});
document.addEventListener('click',event=>{const node=event.target.closest('[data-dynamo-symbol]');if(node)show(node);else hide();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
window.addEventListener('scroll',()=>{
 const node=document.activeElement;
 if(node?.matches('[data-dynamo-symbol]')){
  const box=node.getBoundingClientRect();
  if(box.bottom>=0&&box.top<=innerHeight){show(node);return;}
 }
 hide();
},true);
export function annotateSymbols(root){
 hide();const seen=new Set();
 for(const paragraph of root.querySelectorAll('p')){
  const nodes=[...paragraph.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE);
  for(const node of nodes){
   const pieces=node.textContent.split(/\b([NRWSTQUV])\b/g);if(pieces.length===1)continue;
   const fragment=document.createDocumentFragment();
   pieces.forEach((text,index)=>{
    if(index%2===0){fragment.append(document.createTextNode(text));return;}
    const span=document.createElement('span');span.textContent=text;span.dataset.dynamoSymbol=text;span.className='notation';span.tabIndex=seen.has(text)?-1:0;seen.add(text);span.setAttribute('aria-describedby',`dynamo-symbol-${text}`);fragment.append(span);
   });node.replaceWith(fragment);
  }
 }
}
