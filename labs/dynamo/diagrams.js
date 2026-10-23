const ns='http://www.w3.org/2000/svg';
function shape(name,attributes,text){const element=document.createElementNS(ns,name);for(const [key,value] of Object.entries(attributes))element.setAttribute(key,value);if(text)element.textContent=text;return element;}
export function placementDiagram(tokens,key,replicas){
 const svg=shape('svg',{viewBox:'0 0 620 420',role:'img','aria-label':`Placement ring. Key ${key}. Replicas ${replicas.join(', ')}.`});
 svg.dataset.placementRing='';
 svg.append(shape('circle',{cx:300,cy:200,r:140,fill:'none',stroke:'currentColor'}));
 for(const token of tokens){
  const angle=token.position/100*Math.PI*2-Math.PI/2;
  const x=300+140*Math.cos(angle),y=200+140*Math.sin(angle);
  const selected=replicas.includes(token.node);
  svg.append(shape('circle',{cx:x,cy:y,r:selected?13:8,fill:'var(--card)',stroke:'currentColor','stroke-width':selected?3:1}));
  svg.append(shape('text',{x:300+180*Math.cos(angle),y:205+180*Math.sin(angle),'text-anchor':'middle',fill:'currentColor'},`${token.position}: ${token.node}`));
 }
 const angle=key/100*Math.PI*2-Math.PI/2;
 svg.append(shape('line',{x1:300+90*Math.cos(angle),y1:200+90*Math.sin(angle),x2:300+135*Math.cos(angle),y2:200+135*Math.sin(angle),stroke:'currentColor','stroke-width':3}));
 svg.append(shape('text',{x:300,y:190,'text-anchor':'middle',fill:'currentColor'},`Key ${key}`));
 svg.append(shape('text',{x:300,y:215,'text-anchor':'middle',fill:'currentColor'},`Copies: ${replicas.join(', ')}`));
 return svg;
}
export function treeDiagram(result){
 const root=document.createElement('div');root.className='diagram-viewport';root.tabIndex=0;root.setAttribute('role','region');root.setAttribute('aria-label','Merkle subranges; scroll to inspect');
 const svg=shape('svg',{viewBox:'0 0 850 400',role:'img','aria-label':'Compared Merkle subranges: differing branches expand; equal branches stop.'});
 const positions=new Map();
 for(const node of result.nodes){
  let x=425;for(let i=0;i<node.path.length;i++)x+=(node.path[i]==='L'?-1:1)*210/(2**i);
  const y=40+node.path.length*100;positions.set(node.path,{x,y});
  if(node.path){const parent=positions.get(node.path.slice(0,-1));svg.append(shape('line',{x1:parent.x,y1:parent.y+25,x2:x,y2:y-25,stroke:'currentColor'}));}
  const group=shape('g',{});group.dataset.treeNode='';
  group.append(shape('rect',{x:x-48,y:y-25,width:96,height:50,rx:4,fill:'var(--card)',stroke:'currentColor'}));
  group.append(shape('text',{x,y:y-3,'text-anchor':'middle',fill:'currentColor','font-size':13},node.keys.length>2?`${node.keys[0]}…${node.keys.at(-1)}`:node.keys.join(',')));
  group.append(shape('text',{x,y:y+15,'text-anchor':'middle',fill:'currentColor','font-size':12},node.equal?'equal: stop':'different'));
  svg.append(group);
 }
 root.append(svg);const caption=document.createElement('p');caption.textContent='Compared tree nodes. Equal subranges stop traversal; differing branches expand. Only visited nodes appear. Leaf values are still needed for repair.';root.append(caption);return root;
}
