import { chapters, clockHistory } from './motion-content.js';
import { writeTrace } from './events.js';
import { compareClocks, joinClocks } from './model.js';

export function buildSteps(level = 1) {
 return chapters.flatMap((chapter,index)=>chapter.beats.filter(beat=>beat.level<=level).map(beat=>({...beat,chapter:index,source:chapter.source})));
}
export function clampStep(steps, index) {
 return Math.max(0,Math.min(steps.length-1,Number.isNaN(index)?0:Math.floor(index)));
}
export function chapterStart(steps, chapter) {
 return Math.max(0,steps.findIndex(step=>step.chapter===chapter));
}
export function replicaExperiment({failed='none',required=2,fallback=false}={}) {
 if(!['none','A','B','C'].includes(failed)||![1,2,3].includes(Number(required)))throw new RangeError('Unsupported teaching scenario');
 const hosts=[{id:'A',time:1},{id:'B',time:3},{id:'C',time:8}];let hint=null;
 const unavailable=hosts.find(host=>host.id===failed);
 if(unavailable){unavailable.time=null;if(fallback){hosts.push({id:'D',time:4});hint=failed;}}
 const targets=hosts.filter(host=>host.id!==failed||!fallback);
 const events=writeTrace({replicas:targets.map(host=>host.id),delays:targets.map(host=>host.time),required:Number(required),deadline:6});
 const response=events.find(event=>event.kind==='response');
 return {hosts,hint,events,deadline:6,responseTime:response?.time??null,status:response?'success':'timeout',copiesAtDeadline:hosts.filter(host=>host.time!==null&&host.time<=6).map(host=>host.id)};
}
export function reconcileCart(policy='union') {
 if(!['union','edits'].includes(policy))throw new RangeError('Choose an explicit application policy');
 const left=clockHistory[2].clock,right=clockHistory[3].clock;
 const clock=joinClocks(left,right);clock.Sx=(clock.Sx??0)+1;
 return {cart:policy==='union'?['book','pen']:['pen'],clock,relation:compareClocks(left,right),base:['book'],left:['book','pen'],right:[]};
}
