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
