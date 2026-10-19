// Spatial contracts independent of Three.js. All positions are world coordinates.
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const length=v=>Math.hypot(...v);
const unit=v=>{const n=length(v);return v.map(x=>x/n);};
const smooth=t=>t*t*(3-2*t);
export function nestedSpace(parent,child,aspect,fov,direction){
 const scale=.76*Math.min(parent.size[0]/(child.size[0]+2),parent.size[1]/(child.size[1]+2));
 const distance=Math.max(child.size[1]+2.8,(child.size[0]+3.2)/aspect)*scale/(2*Math.tan(fov*Math.PI/360))*1.12;
 // Interior behind the entry plane: the final camera crosses the selected block.
 const depth=Math.max(parent.size[2],distance*1.4),axis=unit(direction);
 return {scale,distance,center:parent.center.map((v,i)=>v-axis[i]*depth)};
}
export function dollyFrame(from,to,progress){
 if(progress<=0)return {position:[...from.position],target:[...from.target]};
 if(progress>=1)return {position:[...to.position],target:[...to.target]};
 const t=smooth(progress),target=mix(from.target,to.target,smooth(Math.min(progress/.5,1)));
 const a=from.position.map((v,i)=>v-from.target[i]),b=to.position.map((v,i)=>v-to.target[i]);
 const distance=Math.exp(Math.log(length(a))+(Math.log(length(b))-Math.log(length(a)))*t);
 const direction=unit(mix(unit(a),unit(b),t));
 return {target,position:target.map((v,i)=>v+direction[i]*distance)};
}
// Keep residual annotations near their projected anchor, clear of node labels.
export function captionPosition(caption,obstacles,bounds){
 const gap=4,maxX=Math.max(gap,bounds.width-caption.width-gap),maxY=Math.max(gap,bounds.height-caption.height-gap);
 const clamp=(x,y)=>({x:Math.max(gap,Math.min(maxX,x)),y:Math.max(gap,Math.min(maxY,y)),width:caption.width,height:caption.height});
 const xs=[caption.x,...obstacles.flatMap(r=>[r.x-caption.width-gap,r.x+r.width+gap])];
 const ys=[caption.y,...obstacles.flatMap(r=>[r.y-caption.height-gap,r.y+r.height+gap])];
 const candidates=xs.flatMap(x=>ys.map(y=>clamp(x,y)));
 candidates.sort((a,b)=>(a.x-caption.x)**2+(a.y-caption.y)**2-(b.x-caption.x)**2-(b.y-caption.y)**2);
 const clear=r=>obstacles.every(o=>r.x+r.width<=o.x-gap||r.x>=o.x+o.width+gap||r.y+r.height<=o.y-gap||r.y>=o.y+o.height+gap);
 return candidates.find(clear)||clamp(caption.x,caption.y);
}
// Reflow geometry using the scene's width, which may be narrower than the page.
export function layoutNodes(source,width){
 const nodes=source.map(n=>({...n}));
 if(nodes.some(n=>n.id==='q')&&nodes.some(n=>n.id==='k')&&nodes.some(n=>n.id==='v')){
  const projections=nodes.filter(n=>['q','k','v'].includes(n.id));
  if(width<520){nodes.find(n=>n.id==='normalized').y=4.5;projections.forEach((n,i)=>{n.x=0;n.y=1.5-i*3;});}
  else projections.forEach((n,i)=>{n.x=(i-1)*6;});
 }
 if(width<900&&nodes.some(n=>n.id.startsWith('head-'))){
  for(const [items,above]of [[nodes.filter(n=>n.id.startsWith('head-')),true],[nodes.filter(n=>n.id.startsWith('kv-')),false]]){
   const columns=Math.min(items.length,4),rows=Math.ceil(items.length/columns);
   items.forEach((n,i)=>{n.x=(i%columns-(columns-1)/2)*2.6;n.y=above?2+(rows-1-Math.floor(i/columns))*2.2:-2-Math.floor(i/columns)*2.2;});
  }
 }
 return nodes;
}
// A side trunk preserves parallel input branches when projections stack vertically.
export function projectionRoute(from,to){
 return [[...from],[-4,from[1],from[2]],[-4,to[1],to[2]],[to[0]-2.5,to[1],to[2]]];
}
