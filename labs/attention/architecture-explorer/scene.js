import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { nestedSpace, dollyFrame, captionPosition, layoutNodes, projectionRoute } from './spatial.js';

// Nested diagrams share world coordinates with the block that contains them.
// Render only on input or during a camera move; no idle animation.
export function mountScene(host,labels,onSelect) {
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.7));
  const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','3D architecture. Arrows orbit, plus and minus zoom, Home resets. Equivalent component buttons follow.');host.append(canvas);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.001,200),controls=new OrbitControls(camera,canvas);
  controls.enableDamping=false;controls.enablePan=false;controls.maxPolarAngle=Math.PI*.85;
  scene.add(new THREE.AmbientLight(0xffffff,2));
  const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(5,10,12);scene.add(light);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const spaces=new Map([['overview',{center:[0,0,0],scale:1}]]);
  let group=new THREE.Group(),meshes=[],edges=[],labelNodes=[],graph=null,ghost=null,tween=null,raf=0,disposed=false;
  let localSize=new THREE.Vector3(5,10,1),space={center:[0,0,0],scale:1},currentKey='overview';
  let fit={position:new THREE.Vector3(6,3,24),target:new THREE.Vector3(),distance:25};scene.add(group);
  camera.position.copy(fit.position);controls.target.copy(fit.target);
  const css=name=>getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const direction=()=>camera.position.clone().sub(controls.target).normalize();
  const palette=()=>({neutral:css('--line'),query:css('--llm-query'),key:css('--llm-key'),value:css('--llm-value'),ink:css('--ink')});
  const smooth=t=>t*t*(3-2*t);
  function disposeGroup(root){root.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of (Array.isArray(o.material)?o.material:[o.material]))m.dispose();}});scene.remove(root);}
  function removeGhost(){if(!ghost)return;disposeGroup(ghost.group);ghost.labels.forEach(n=>n.element.remove());ghost=null;}
  function invalidate(){if(!raf&&!disposed)raf=requestAnimationFrame(draw);}
  function cameraLimits(wide=false){
    const current=camera.position.distanceTo(controls.target);
    controls.minDistance=Math.min(current,fit.distance)*.12;controls.maxDistance=Math.max(wide?current:0,fit.distance)*6;
    camera.near=Math.max(1e-10,Math.min(current,fit.distance)/300);camera.far=Math.max(current,fit.distance)*100;
    camera.updateProjectionMatrix();
  }
  function place(next,axis=direction()){
    space={center:[...next.center],scale:next.scale};group.position.fromArray(space.center);group.scale.setScalar(space.scale);
    const height=(localSize.y+2.8)*space.scale,width=(localSize.x+3.2)*space.scale;
    const distance=Math.max(height,width/camera.aspect)/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2))*1.12;
    fit={target:group.position.clone(),position:group.position.clone().add(axis.multiplyScalar(distance)),distance};
    group.updateMatrixWorld(true);
  }
  function snap(){tween=null;removeGhost();camera.position.copy(fit.position);controls.target.copy(fit.target);cameraLimits();controls.update();host.dataset.motion='idle';invalidate();}
  function move(duration){
    if(reduced.matches){snap();return;}
    cameraLimits(true);
    tween={from:{position:camera.position.toArray(),target:controls.target.toArray()},to:{position:fit.position.toArray(),target:fit.target.toArray()},start:performance.now(),duration};invalidate();
  }
  function draw(now){
    raf=0;if(disposed)return;
    if(tween){
      const progress=Math.min((now-tween.start)/tween.duration,1),frame=dollyFrame(tween.from,tween.to,progress);
      camera.position.fromArray(frame.position);controls.target.fromArray(frame.target);controls.update();
      if(ghost){const fade=1-smooth(Math.min(progress/.85,1));for(const [m,opacity]of ghost.materials)m.opacity=opacity*fade;ghost.opacity=fade;}
      if(progress===1){tween=null;removeGhost();cameraLimits();host.dataset.motion='idle';}
    }
    camera.lookAt(controls.target);renderer.render(scene,camera);
    for(const item of [...labelNodes,...(ghost?.labels||[])]){
      const point=item.point.clone().applyMatrix4(item.root.matrixWorld),projected=point.clone().project(camera);
      const edge=item.point.clone().add(new THREE.Vector3(item.width/2,0,0)).applyMatrix4(item.root.matrixWorld).project(camera);
      const pixels=Math.abs(edge.x-projected.x)*host.clientWidth;
      const readable=pixels>=Math.min(80,item.element.textContent.length*4.3+10)||item.id===selected;
      item.element.style.left=`${(projected.x*.5+.5)*host.clientWidth}px`;item.element.style.top=`${(-projected.y*.5+.5)*host.clientHeight}px`;
      item.element.style.opacity=String(item.ghost?(ghost?.opacity||0):1);
      item.element.hidden=!readable||projected.z>1||projected.z< -1||Math.abs(projected.x)>1||Math.abs(projected.y)>1;
    }
    const captions=labelNodes.filter(item=>!item.id&&!item.element.hidden);
    if(captions.length){
      const viewport=host.getBoundingClientRect();
      const rectangle=item=>{const box=item.element.getBoundingClientRect();return {x:box.left-viewport.left,y:box.top-viewport.top,width:box.width,height:box.height};};
      const occupied=labelNodes.filter(item=>item.id&&!item.element.hidden).map(rectangle);
      for(const item of captions){
        const box=captionPosition(rectangle(item),occupied,{width:host.clientWidth,height:host.clientHeight});
        item.element.style.left=`${box.x+box.width/2}px`;item.element.style.top=`${box.y+box.height/2}px`;occupied.push(box);
      }
    }
    if(tween)invalidate();
  }
  function build(data,retain=false){
    removeGhost();
    if(retain&&meshes.length){
      const materials=new Map();group.traverse(o=>{if(o.material){o.material.transparent=true;o.material.depthWrite=false;materials.set(o.material,o.material.opacity);}});
      ghost={group,labels:labelNodes,materials,opacity:1};labelNodes.forEach(n=>n.ghost=true);
    }else{disposeGroup(group);labelNodes.forEach(n=>n.element.remove());}
    group=new THREE.Group();scene.add(group);meshes=[];edges=[];labelNodes=[];graph=data;
    const colors=palette(),byId=new Map(),nodes=layoutNodes(data.nodes,host.clientWidth);
    host.parentElement.dataset.dense=String(host.clientWidth<900&&nodes.filter(n=>n.id.startsWith('head-')).length>8);
    function label(text,id,point,width){const element=document.createElement('span');element.className='scene-label';element.textContent=text;labels.append(element);labelNodes.push({element,id,point,width,root:group});}
    nodes.forEach(n=>{
      const head=n.id.startsWith('head-')||n.id.startsWith('kv-'),width=head?2.05:5;
      const geometry=new THREE.BoxGeometry(width,head?.75:1.05,.75),material=new THREE.MeshStandardMaterial({color:colors[n.role],transparent:true,opacity:.38,roughness:.32,metalness:.08,depthWrite:false});
      const mesh=new THREE.Mesh(geometry,material);mesh.position.set(n.x,n.y,0);mesh.userData=n;
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineBasicMaterial({color:colors[n.role==='neutral'?'ink':n.role]})));
      group.add(mesh);meshes.push(mesh);byId.set(n.id,mesh);
      label(head?(n.id.startsWith('head-')?`Q${n.id.slice(5)}`:`KV${n.id.slice(3)}`):n.label,n.id,new THREE.Vector3(n.x,n.y,.55),width);
    });
    data.edges.forEach(edge=>{
      const a=byId.get(edge.from).position.clone(),b=byId.get(edge.to).position.clone();a.y-=.5;b.y+=.5;
      const color=edge.residual?colors.key:colors.ink,narrowProjection=host.clientWidth<520&&edge.from==='normalized'&&['q','k','v'].includes(edge.to);let curve;
      if(edge.residual){const x=edge.from==='input'?-4:4;curve=new THREE.CatmullRomCurve3([a,new THREE.Vector3(x,a.y,0),new THREE.Vector3(x,b.y,0),b]);label(edge.label,'',new THREE.Vector3(x,(a.y+b.y)/2,.2),5);}
      else if(narrowProjection)curve=new THREE.CatmullRomCurve3(projectionRoute(a.toArray(),byId.get(edge.to).position.toArray()).map(point=>new THREE.Vector3(...point)));
      else curve=new THREE.LineCurve3(a,b);
      const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,edge.residual||narrowProjection?32:1,.025,5,false),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.55}));group.add(tube);
      const arrow=new THREE.Mesh(new THREE.ConeGeometry(.09,.24,6),new THREE.MeshBasicMaterial({color,transparent:true}));arrow.position.copy(curve.getPoint(.95));arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),curve.getTangent(.95).normalize());group.add(arrow);edges.push({from:edge.from,to:edge.to,tube,arrow});
    });
    const bounds=new THREE.Box3().setFromObject(group),center=bounds.getCenter(new THREE.Vector3());localSize=bounds.getSize(new THREE.Vector3());
    group.children.forEach(child=>child.position.sub(center));labelNodes.forEach(n=>n.point.sub(center));
    highlight(selected);return {size:localSize.toArray()};
  }
  let selected=null;
  function highlight(id){
    selected=id;const sharing=graph?.nodes.some(n=>n.id.startsWith('head-'))&&(id?.startsWith('head-')||id?.startsWith('kv-')),connected=new Set([id]);
    for(const e of edges){const active=e.from===id||e.to===id;if(sharing&&active){connected.add(e.from);connected.add(e.to);}for(const object of [e.tube,e.arrow]){object.material.opacity=sharing?(active?1:.08):.55;object.position.z=sharing&&active?.25:0;}}
    for(const m of meshes){const active=connected.has(m.userData.id);m.material.opacity=active?.68:sharing?.16:.38;m.scale.setScalar(active?1.035:1);}
    labelNodes.forEach(n=>n.element.classList.toggle('is-selected',connected.has(n.id)));invalidate();
  }
  function update(data,{focusId=null,key='overview'}={}){
    const initial=!graph,axis=direction(),previous=meshes.find(m=>m.userData.id===focusId);
    const parent=previous?{center:previous.getWorldPosition(new THREE.Vector3()).toArray(),size:new THREE.Box3().setFromObject(previous).getSize(new THREE.Vector3()).toArray()}:null;
    const entering=!!parent&&key!==currentKey,changing=key!==currentKey;tween=null;
    const bounds=build(data,!reduced.matches&&changing);
    const next=entering?nestedSpace(parent,bounds,camera.aspect,camera.fov,axis.toArray()):(spaces.get(key)||{center:[0,0,0],scale:1});
    spaces.set(key,next);currentKey=key;place(next,axis);host.dataset.view=key;host.dataset.motion=entering?'enter':changing?'exit':'fit';
    if(initial||reduced.matches)snap();else move(changing?950:280);
  }
  function resize(){
    const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return;
    const axis=direction();renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
    if(graph){tween=null;build(graph);place(space,axis);snap();}else invalidate();
  }
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);controls.addEventListener('change',invalidate);
  controls.addEventListener('start',()=>{if(tween)snap();});
  let down=null;canvas.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
  canvas.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;down=null;const box=canvas.getBoundingClientRect();pointer.set((e.clientX-box.left)/box.width*2-1,-(e.clientY-box.top)/box.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(meshes,false)[0];if(hit)onSelect(hit.object.userData.id,true);});
  canvas.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key))return;e.preventDefault();if(tween)snap();
    if(e.key==='Home'){move(350);return;}
    const spherical=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if(e.key==='ArrowLeft')spherical.theta-=.12;if(e.key==='ArrowRight')spherical.theta+=.12;if(e.key==='ArrowUp')spherical.phi-=.1;if(e.key==='ArrowDown')spherical.phi+=.1;
    if(e.key==='+'||e.key==='=')spherical.radius*=.9;if(e.key==='-')spherical.radius*=1.1;
    spherical.radius=Math.min(controls.maxDistance,Math.max(controls.minDistance,spherical.radius));spherical.makeSafe();camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();invalidate();
  });
  const themeObserver=new MutationObserver(()=>{if(graph){const axis=direction();tween=null;build(graph);place(space,axis);snap();}});themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();tween=null;removeGhost();document.getElementById('renderer-status').textContent='3D context lost. Component buttons and explanations remain available; reload to restore 3D.';});
  const motionChanged=()=>{if(tween)snap();};reduced.addEventListener('change',motionChanged);resize();
  return {update,highlight,reset:()=>{if(tween)snap();else move(350);},dispose:()=>{disposed=true;cancelAnimationFrame(raf);resizeObserver.disconnect();themeObserver.disconnect();reduced.removeEventListener('change',motionChanged);controls.dispose();removeGhost();disposeGroup(group);labels.replaceChildren();renderer.dispose();canvas.remove();}};
}
