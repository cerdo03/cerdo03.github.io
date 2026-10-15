// Keep numeric labels stationary; reveal only new nodes and newly active connections.
const nodeKey=node=>`${node.querySelector('rect')?.getAttribute('x')}:${node.querySelector('rect')?.getAttribute('y')}:${node.textContent}`;
export function flowSnapshot(root){
 return {paths:new Set([...root.querySelectorAll('.route-edge.is-active')].map(p=>p.getAttribute('d'))),nodes:new Set([...root.querySelectorAll('.route-node')].map(nodeKey)),arrows:new Set([...root.querySelectorAll('.visual-arrow.is-active')].map(a=>a.getAttribute('transform')))};
}
export function animateFlow(root,previous={paths:new Set(),nodes:new Set()}){
 if(root.ownerDocument.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const easing='cubic-bezier(.4,0,.2,1)';
 root.querySelectorAll('.route-edge.is-active').forEach(path=>{
  if(previous.paths.has(path.getAttribute('d')))return;
  const length=path.getTotalLength();path.style.strokeDasharray=String(length);
  path.animate([{strokeDashoffset:length},{strokeDashoffset:0}],{duration:650,easing,fill:'both'});
 });
 root.querySelectorAll('.route-node').forEach(node=>{
  if(previous.nodes.has(nodeKey(node)))return;
  node.animate([{opacity:0},{opacity:1}],{duration:220,delay:previous.nodes.size?650:0,easing:'ease-out',fill:'both'});
 });
 root.querySelectorAll('.visual-arrow.is-active').forEach(arrow=>{if(!previous.arrows?.has(arrow.getAttribute('transform')))arrow.animate([{opacity:0},{opacity:1}],{duration:180,delay:650,fill:'both'});});
}
