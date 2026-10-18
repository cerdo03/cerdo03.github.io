import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';

// Render on demand: no idle animation, spinning scene, particles or synthetic data flow.
export function mountScene(host,labels,onSelect) {
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.7));
  const canvas=renderer.domElement;
  canvas.tabIndex=0;
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','3D architecture. Arrow keys orbit, plus and minus zoom, Home resets. Component buttons below provide equivalent navigation.');
  host.append(canvas);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.1,200);
  const controls=new OrbitControls(camera,canvas);
  controls.enableDamping=false;controls.enablePan=false;controls.minDistance=5;controls.maxDistance=65;
  controls.maxPolarAngle=Math.PI*.85;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  scene.add(new THREE.AmbientLight(0xffffff,2));
  const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(5,10,12);scene.add(light);
  let group=new THREE.Group(),meshes=[],edgeObjects=[],labelNodes=[],graph=null,selected=null,raf=0,tween=null,pendingGraph=null,serial=0,disposed=false,fit={position:new THREE.Vector3(3,2,24),target:new THREE.Vector3()};
  scene.add(group);
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const css=name=>getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const palette=()=>({neutral:css('--line'),query:css('--llm-query'),key:css('--llm-key'),value:css('--llm-value'),ink:css('--ink')});
  function draw(now) {
    raf=0;if(disposed)return;
    if(tween) {
      const progress=Math.min((now-tween.start)/tween.duration,1),ease=1-(1-progress)**3;
      camera.position.lerpVectors(tween.from,tween.to,ease);controls.target.lerpVectors(tween.fromTarget,tween.toTarget,ease);controls.update();
      if(progress===1) {const done=tween.done;tween=null;done?.();}
    }
    camera.lookAt(controls.target);renderer.render(scene,camera);
    for(const item of labelNodes) {
      const p=item.point.clone().project(camera);
      item.element.style.left=`${(p.x*.5+.5)*host.clientWidth}px`;
      item.element.style.top=`${(-p.y*.5+.5)*host.clientHeight}px`;
      item.element.hidden=p.z>1||p.z< -1||Math.abs(p.x)>1||Math.abs(p.y)>1;
    }
    if(tween)invalidate();
  }
  function invalidate(){if(!raf&&!disposed)raf=requestAnimationFrame(draw);}
  function animate(to,toTarget,duration,done) {
    if(reduced.matches) {camera.position.copy(to);controls.target.copy(toTarget);controls.update();done?.();invalidate();return;}
    tween={from:camera.position.clone(),to:to.clone(),fromTarget:controls.target.clone(),toTarget:toTarget.clone(),start:performance.now(),duration,done};invalidate();
  }
  function clear(){
    group.traverse(o=>{o.geometry?.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});
    scene.remove(group);group=new THREE.Group();scene.add(group);meshes=[];edgeObjects=[];labelNodes=[];labels.replaceChildren();
  }
  function rebuild(data){
    clear();graph=data;const colors=palette(),byId=new Map();
    host.parentElement.dataset.dense=String(host.clientWidth<520&&data.nodes.filter(n=>n.id.startsWith('head-')).length>16);
    // Phone: reflow heads instead of clipping a wide head grid.
    const nodes=data.nodes.map(n=>({...n}));
    if(host.clientWidth<520&&nodes.some(n=>n.id.startsWith('head-'))) {
      const queries=nodes.filter(n=>n.id.startsWith('head-')),kv=nodes.filter(n=>n.id.startsWith('kv-'));
      for(const [items,above] of [[queries,true],[kv,false]])items.forEach((n,i)=>{const cols=Math.min(items.length,4),rows=Math.ceil(items.length/cols);n.x=(i%cols-(cols-1)/2)*2.6;n.y=above?2+(rows-1-Math.floor(i/cols))*1.6:-2-Math.floor(i/cols)*1.6;});
    }
    nodes.forEach(n=>{
      const head=n.id.startsWith('head-')||n.id.startsWith('kv-'),width=head?2.05:5;
      const geometry=new THREE.BoxGeometry(width,head?.75:1.05,.75);
      const material=new THREE.MeshStandardMaterial({color:colors[n.role],transparent:true,opacity:.38,roughness:.32,metalness:.08,depthWrite:false});
      const mesh=new THREE.Mesh(geometry,material);mesh.position.set(n.x,n.y,0);mesh.userData={...n};
      const outline=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineBasicMaterial({color:colors[n.role==='neutral'?'ink':n.role]}));mesh.add(outline);group.add(mesh);meshes.push(mesh);byId.set(n.id,mesh);
      const element=document.createElement('span');element.className='scene-label';
      element.textContent=head?(n.id.startsWith('head-')?`Q${n.id.slice(5)}`:`KV${n.id.slice(3)}`):n.label;
      labels.append(element);labelNodes.push({element,id:n.id,point:new THREE.Vector3(n.x,n.y,.55)});
    });
    data.edges.forEach(edge=>{
      const a=byId.get(edge.from).position.clone(),b=byId.get(edge.to).position.clone();
      a.y-=.5;b.y+=.5;
      const color=edge.residual?colors.key:colors.ink;
      let curve;
      if(edge.residual) {
        const x=edge.from==='input'?-4:4;
        curve=new THREE.CatmullRomCurve3([a,new THREE.Vector3(x,a.y,0),new THREE.Vector3(x,b.y,0),b]);
        const element=document.createElement('span');element.className='scene-label';element.textContent=edge.label;labels.append(element);labelNodes.push({element,id:'',point:new THREE.Vector3(x,(a.y+b.y)/2,.2)});
      } else curve=new THREE.LineCurve3(a,b);
      const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,edge.residual?32:1,.025,5,false),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.55}));group.add(tube);
      const tangent=curve.getTangent(.95).normalize(),end=curve.getPoint(.95);
      const arrow=new THREE.Mesh(new THREE.ConeGeometry(.09,.24,6),new THREE.MeshBasicMaterial({color,transparent:true}));
      arrow.position.copy(end);arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tangent);group.add(arrow);edgeObjects.push({from:edge.from,to:edge.to,tube,arrow});
    });
    const box=new THREE.Box3().setFromObject(group),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    // Reserve horizontal room for readable HTML labels, including residual captions.
    const height=size.y+2.8,width=size.x+(nodes.length>16?1:3.2),vFov=THREE.MathUtils.degToRad(camera.fov);
    const distance=Math.max(height,width/camera.aspect)/(2*Math.tan(vFov/2));
    fit={target:center,position:center.clone().add(new THREE.Vector3(distance*.28,distance*.12,distance*1.12))};
    highlight(selected);invalidate();
  }
  function update(data,{focusId=null}={}) {
    const version=++serial;
    tween=null;pendingGraph=null;
    const previous=meshes.find(m=>m.userData.id===focusId);
    const reveal=()=>{if(version!==serial)return;pendingGraph=null;rebuild(data);animate(fit.position,fit.target,400);};
    if(previous&&!reduced.matches) {
      pendingGraph=data;
      const target=previous.position.clone(),to=target.clone().add(new THREE.Vector3(1,1,9));
      animate(to,target,220,reveal);
    } else reveal();
  }
  // Camera interruption must not cancel the requested architecture navigation.
  function finishPendingGraph(){
    if(!pendingGraph)return;
    const data=pendingGraph;pendingGraph=null;rebuild(data);
    camera.position.copy(fit.position);controls.target.copy(fit.target);controls.update();
  }
  function highlight(id){
    selected=id;
    const sharing=graph?.nodes.some(n=>n.id.startsWith('head-'))&&(id?.startsWith('head-')||id?.startsWith('kv-'));
    const connected=new Set([id]);
    for(const e of edgeObjects){const active=e.from===id||e.to===id;if(sharing&&active){connected.add(e.from);connected.add(e.to);}for(const object of [e.tube,e.arrow]){object.material.opacity=sharing?(active?1:.08):.55;object.position.z=sharing&&active?.25:0;}}
    for(const m of meshes){const active=connected.has(m.userData.id);m.material.opacity=active?.68:sharing?.16:.38;m.scale.setScalar(active?1.035:1);}
    for(const item of labelNodes)item.element.classList.toggle('is-selected',connected.has(item.id));
    invalidate();
  }
  function resize(){
    const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return;
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
    if(graph){rebuild(graph);camera.position.copy(fit.position);controls.target.copy(fit.target);controls.update();}
    invalidate();
  }
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);
  controls.addEventListener('change',invalidate);
  controls.addEventListener('start',()=>{tween=null;finishPendingGraph();});
  let down=null;
  canvas.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
  canvas.addEventListener('pointerup',e=>{
    if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;
    down=null;const box=canvas.getBoundingClientRect();pointer.set((e.clientX-box.left)/box.width*2-1,-(e.clientY-box.top)/box.height*2+1);ray.setFromCamera(pointer,camera);
    const hit=ray.intersectObjects(meshes,false)[0];if(hit)onSelect(hit.object.userData.id,true);
  });
  canvas.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key))return;
    e.preventDefault();tween=null;finishPendingGraph();
    if(e.key==='Home'){animate(fit.position,fit.target,350);return;}
    const offset=camera.position.clone().sub(controls.target),spherical=new THREE.Spherical().setFromVector3(offset);
    if(e.key==='ArrowLeft')spherical.theta-=.12;if(e.key==='ArrowRight')spherical.theta+=.12;
    if(e.key==='ArrowUp')spherical.phi-=.1;if(e.key==='ArrowDown')spherical.phi+=.1;
    if(e.key==='+'||e.key==='=')spherical.radius*=.9;if(e.key==='-')spherical.radius*=1.1;
    spherical.radius=Math.min(65,Math.max(5,spherical.radius));spherical.makeSafe();
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();invalidate();
  });
  const themeObserver=new MutationObserver(()=>{if(graph){rebuild(graph);invalidate();}});themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();tween=null;document.getElementById('renderer-status').textContent='3D context lost. Component buttons and explanations remain available; reload to restore 3D.';});
  function reduceChanged(){if(tween){const target=tween.to.clone(),look=tween.toTarget.clone(),done=tween.done;tween=null;camera.position.copy(target);controls.target.copy(look);controls.update();done?.();invalidate();}}
  reduced.addEventListener('change',reduceChanged);
  resize();
  return {update,highlight,reset:()=>{serial++;tween=null;finishPendingGraph();animate(fit.position,fit.target,350);},dispose:()=>{disposed=true;cancelAnimationFrame(raf);resizeObserver.disconnect();themeObserver.disconnect();reduced.removeEventListener('change',reduceChanged);controls.dispose();clear();renderer.dispose();canvas.remove();}};
}
