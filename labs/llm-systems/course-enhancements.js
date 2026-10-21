import {mountLearningVisual} from './learning-visuals.js';
export function enhanceCourse(doc){
 const number=Number(doc.body.dataset.lesson);
 const replace=(id,type,options={})=>{
  const section=doc.getElementById(id);if(!section)return;
  const root=section.querySelector(':scope > .lab')||doc.createElement('div');
  root.classList.add('lab');if(!root.isConnected)section.querySelector(':scope > p').after(root);
  root.replaceChildren();mountLearningVisual(root,type,options);
 };
 if(number===2){
  replace('s2-2-1','heads');replace('s2-2-2','heads',{minStage:1,maxStage:2});replace('s2-2-4','heads',{minStage:3,maxStage:5});
 }
 if(number===3)replace('s2-3-2','sharing');
 if(number===4){
  const prefill=doc.getElementById('s2-4-3');
  const depth=prefill?.querySelector(':scope > .course-detail > div');
  if(depth)depth.prepend(...prefill.querySelectorAll(':scope > .course-core'));
  replace('s2-4-3','request',{prompt:['The','sky','is','blue'],answer:['and','the','sun','shines','.']});
  const section=doc.getElementById('s2-4-4'),existing=section?.querySelector('.lab');
  if(existing){
   // Retain the detailed simulator and its links to projection counters in place.
   const detail=doc.createElement('details');detail.className='course-detail';
   const summary=doc.createElement('summary');summary.textContent='Detailed numeric trace and counters';
   existing.before(detail);detail.append(summary,existing);
   existing.querySelector('.lab-controls').hidden=true;
   existing.querySelector('.lab-guide').hidden=true;
   existing.querySelector('.lab-header h3').textContent='Expanded numeric state';
   const root=doc.createElement('div');root.className='lab';detail.before(root);
   mountLearningVisual(root,'request',{pass:1,minPass:1,prompt:['The','sky','is','blue'],answer:['and','the','sun','shines','.'],onFrame:frame=>doc.dispatchEvent(new CustomEvent('course:decode-frame',{detail:frame}))});
  }
 }
}
