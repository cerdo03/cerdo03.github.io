import { launchModel, sectorModel, multiply, toyLeft, toyRight, tileTraffic, roofline, projection, decodeAttention } from './model.js';
const num = value => new Intl.NumberFormat('en-US',{maximumFractionDigits:3}).format(value);
const precise = value => value === 0 ? '0' : value < 0.001 ? value.toExponential(3) : num(value);
let controlId = 0;
function element(tag, text, cls) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
function control(host, title, options, initial, update) {
  const label = element('label',title), select = document.createElement('select');
  select.id = `gpu-control-${++controlId}`;
  label.htmlFor = select.id;
  for (const option of options) {
    const [value,text] = Array.isArray(option) ? option : [option,option];
    const node = element('option',String(text));node.value = value;select.append(node);
  }
  select.value = initial;
  select.addEventListener('change',update);label.append(select);host.append(label);
  return select;
}
function metrics(host, entries) {
  host.replaceChildren();
  for (const [name,value] of entries) {
    const node = element('div');node.append(element('strong',value),element('span',name));host.append(node);
  }
}
function flow(host, entries, step = entries.length - 1) {
  host.replaceChildren();
  entries.forEach(([name,text],i) => {
    const node = element('div',undefined,`gpu-stage${i === step ? ' is-active' : ''}`);
    node.append(element('strong',name),element('span',text));node.hidden = i > step;host.append(node);
  });
}
function setup(root) {
  root.querySelector('.gpu-static')?.remove();
  const controls = element('div',undefined,'gpu-controls'), body = element('div'), output = element('p');
  output.setAttribute('aria-live','polite');
  root.append(controls,body,output);
  return { controls,body,output };
}
function steps(host, maximum, render) {
  let step = 0;
  const bar = element('div',undefined,'gpu-controls');
  const back = element('button','Previous operation'), next = element('button','Next operation'), all = element('button','Show all'), reset = element('button','Reset operations');
  for (const button of [back,next,all,reset]) { button.type = 'button';bar.append(button); }
  const paint = () => { back.disabled = step === 0;next.disabled = step === maximum;render(step); };
  back.onclick = () => { step = Math.max(0,step - 1);paint(); };
  next.onclick = () => { step = Math.min(maximum,step + 1);paint(); };
  all.onclick = () => { step = maximum;paint(); };
  reset.onclick = () => { step = 0;paint(); };
  host.append(bar);paint();
  return () => { step = 0;paint(); };
}
function execution(root) {
  const {controls,body,output} = setup(root), scene = element('div',undefined,'gpu-flow'), lanes = element('div',undefined,'gpu-lanes');body.append(scene,lanes);
  let refresh = () => {};
  const items = control(controls,'Output elements',[128,1000,4096],1000,()=>refresh());
  const threads = control(controls,'Threads per block',[64,128,256],128,()=>refresh());
  refresh = steps(root,3,step => {
    const a=launchModel(+items.value,+threads.value,32,8),last=a.blocks-1;
    flow(scene,[['Kernel → grid',`${num(+items.value)} independent output elements. ceil(${items.value} / ${threads.value}) = ${a.blocks} blocks.`],['Block → SM',`Inspect block ${last}. It stays on one SM. SM assignment and execution order are unspecified.`],['Block → warps',`${threads.value} threads / 32 = ${a.warps} warps per block. Inspect the final warp of the final block.`],['Warp → lanes',`Global output index = block index × block size + thread index. ${a.tailLanes} of 32 lanes in this final warp are valid.`]],step);
    lanes.replaceChildren();
    if(step===3) for(let lane=0;lane<32;lane++) {
      const index = a.blocks * +threads.value - 32 + lane,valid=index<+items.value;
      const cell=element('span',`${lane}: ${valid?index:'guard'}`,valid?'':'masked');
      cell.setAttribute('aria-label',`Lane ${lane}: ${valid?`writes output ${index}`:'out of range; no output store'}`);lanes.append(cell);
    }
    output.textContent=`Operation ${step+1} of 4. ${step===3?'Tail guards prevent out-of-range work; they do not create extra useful lanes.':'Reveal the next mapping. No schedule or runtime is being simulated.'}`;
  });
}
function residency(root) {
  const {controls,body,output}=setup(root), values=element('div',undefined,'gpu-metrics'),scene=element('div',undefined,'gpu-flow'),slots=element('div',undefined,'gpu-lanes');body.append(values,scene,slots);
  const threads=control(controls,'Threads per block',[64,128,256,512],128,draw), registers=control(controls,'32-bit registers per thread',[16,32,64,128],64,draw), shared=control(controls,'Shared KiB per block',[8,16,32,64],32,draw);
  function draw() {
    const a=launchModel(4096,+threads.value,+registers.value,+shared.value);
    metrics(values,[['Resident blocks / SM',num(a.residentBlocks)],['Resident warps / SM',num(a.residentBlocks*a.warps)],['Occupancy (not utilization)',`${num(a.occupancy*100)}%`]]);
    flow(scene,[['Toy SM resource budgets','2,048 threads · 65,536 32-bit registers · 64 KiB shared · 8 blocks maximum'],['Each resource permits this many blocks',`Threads: ${a.limits.threads}; registers: ${a.limits.registers}; shared memory: ${a.limits.shared}; block cap: 8.`],['Minimum wins',`${a.residentBlocks} resident blocks × ${threads.value} threads/block / 2,048 threads = ${num(a.occupancy*100)}%.`]]);
    slots.replaceChildren();
    slots.classList.add('gpu-resident-slots');
    slots.setAttribute('aria-label','Toy SM: 64 warp slots. W indicates a resident warp; dash indicates an empty slot.');
    for(let warp=0;warp<64;warp++){
      const resident=warp<a.residentBlocks*a.warps;
      const slot=element('span',resident?`W${warp}`:'—',resident?'':'masked');
      slot.title=resident?`Block ${Math.floor(warp/a.warps)}, warp ${warp%a.warps}`:'Unallocated warp slot';slots.append(slot);
    }
    const limiting=Object.entries(a.limits).filter(([,v])=>v===a.residentBlocks).map(([key])=>key).join(', ');
    output.textContent=`Limiting resource(s): ${limiting}. W = resident warp; — = unallocated slot. Toy upper bound with enough blocks; no prediction of execution time. Change one resource and explain the new minimum.`;
  }draw();
}
function memory(root) {
  const {body,output}=setup(root),scene=element('div',undefined,'gpu-flow');body.append(scene);
  steps(root,4,step=>{
    flow(scene,[['Global allocation in device DRAM','Weights and inputs exist before this kernel. Datacenter GPUs often use HBM; other GPUs may use different DRAM.'],['Hardware cache lookup','Conceptual L2 / SM-local L1 lookup. A hit can avoid a DRAM fetch; exact path depends on instructions and hardware.'],['Cooperative load → shared memory','In this tiled path, a block stages operands for reuse. A barrier makes loaded values safe to consume. Not every kernel uses this stage.'],['Shared → registers → multiply-add','Threads read operands, update per-thread accumulators. Registers are not shared addressable storage.'],['Store output','The completed output goes to global memory, through the applicable store/cache path. This is a scope diagram, not a cycle-accurate route.']],step);
    output.textContent=`Operation ${step+1} of 5. ${['Choose a memory boundary before counting traffic.','A global-memory load is not necessarily an HBM read.','Shared memory is explicit block-local storage, unlike a hardware cache.','Reusing operands may reduce global-load demand.','Capacity and per-step traffic remain different quantities.'][step]}`;
  });
}
function coalescing(root) {
  const {controls,body,output}=setup(root),values=element('div',undefined,'gpu-metrics'),lanes=element('div',undefined,'gpu-lanes');body.append(values,lanes);
  const stride=control(controls,'Stride (4-byte elements)',[1,2,4,8,32],1,draw),offset=control(controls,'Starting byte offset',[0,4,16],0,draw);
  function draw() {
    const a=sectorModel(+stride.value,+offset.value);
    metrics(values,[['Useful requested bytes','128'],['Distinct 32-byte sectors',num(a.sectors.length)],['Sector bytes',num(a.bytes)],['Useful / sector bytes',`${num(128/a.bytes*100)}%`]]);
    lanes.replaceChildren();a.addresses.forEach((address,lane)=>{
      const cell=element('span');cell.append(element('strong',`Lane ${lane}`),element('br'),document.createTextNode(`@${address}`),element('br'),document.createTextNode(`S${Math.floor(address/32)}`));lanes.append(cell);
    });
    output.textContent=`Address in bytes = ${offset.value} + lane × ${stride.value} × 4. S marks the 32-byte sector index. ${a.sectors.length} sectors service 32 distinct values. This is instruction demand, not measured DRAM traffic or a speedup.`;
  }draw();
}
function matrixTable(host, caption, data, onCell, active) {
  const table=element('table'),head=element('caption',caption),tbody=element('tbody'),thead=element('thead'),headers=element('tr');
  const corner=element('th','Row / col');corner.scope='col';headers.append(corner);
  data[0].forEach((_,j)=>{const th=element('th',String(j));th.scope='col';headers.append(th);});thead.append(headers);table.append(head,thead,tbody);
  data.forEach((row,i)=>{
    const tr=element('tr'),header=element('th',String(i));header.scope='row';tr.append(header);row.forEach((value,j)=>{
      const td=element('td');
      if(onCell){const button=element('button',String(value));button.type='button';button.setAttribute('aria-label',`Inspect output row ${i}, column ${j}`);button.setAttribute('aria-pressed',String(active?.(i,j)||false));button.onclick=()=>onCell(i,j);td.append(button);}
      else td.textContent=value;
      tr.append(td);
    });tbody.append(tr);
  });host.append(table);return {rows:[...tbody.rows].map(row=>({cells:[...row.querySelectorAll('td')]}))};
}
function matmul(root) {
  const {body,output}=setup(root),matrices=element('div',undefined,'gpu-matrices'),formula=element('div',undefined,'gpu-formula');body.append(matrices,formula);
  let row=0,col=0,reset=()=>{};
  const result=multiply(toyLeft,toyRight);
  reset=steps(root,4,step=>{
    matrices.replaceChildren();
    const left=matrixTable(matrices,'Input U [4 × 4]',toyLeft),right=matrixTable(matrices,'Weights W [4 × 4]',toyRight);
    const shown=result.map((r,i)=>r.map((value,j)=>i===row&&j===col&&step===4?value:'?'));
    matrixTable(matrices,'Output Y [4 × 4] — select a cell',shown,(i,j)=>{row=i;col=j;reset();matrices.querySelector('[aria-pressed="true"]').focus();},(i,j)=>i===row&&j===col);
    for(let p=0;p<4;p++) {
      left.rows[row].cells[p].classList.add('selected');right.rows[p].cells[col].classList.add('selected');
      if(p<step){left.rows[row].cells[p].classList.add('used');right.rows[p].cells[col].classList.add('used');}
    }
    const terms=Array.from({length:step},(_,p)=>`${toyLeft[row][p]} × ${toyRight[p][col]} = ${toyLeft[row][p]*toyRight[p][col]}`);
    formula.textContent=step===0?`Known inputs: row ${row} and column ${col}. Accumulator starts at 0. Reveal the first product.`:`Revealed products: ${terms.join('; ')}. Partial sum = ${toyLeft[row].slice(0,step).reduce((sum,v,p)=>sum+v*toyRight[p][col],0)}.${step===4?` Output Y[${row},${col}] = ${result[row][col]}.`:''}`;
    output.textContent=`${step} of 4 multiply-adds revealed. ${step===4?'All four terms are present; this selected output is complete.':'Future products and final output remain concealed.'} Select another output to restart its dot product.`;
  });
}
function tiling(root) {
  const {controls,body,output}=setup(root),scene=element('div',undefined,'gpu-flow'),values=element('div',undefined,'gpu-metrics'),matrices=element('div',undefined,'gpu-matrices');body.append(scene,matrices,values);
  let reset=()=>{};
  const tile=control(controls,'Tile side (elements)',[1,2,4],2,()=>reset());
  reset=steps(root,3,step=>{
    const b=+tile.value,a=tileTraffic(4,4,4,b,4),baseline=tileTraffic(4,4,4,1,4);
    flow(scene,[['Known task: U [4×4] × W [4×4] → Y [4×4]',`Select an output patch of ${b}×${b} cells: rows 0–${b-1}, columns 0–${b-1}.`],['Load the first reduction tile',`U rows 0–${b-1}, columns 0–${b-1}; W rows 0–${b-1}, columns 0–${b-1}. Together: ${2*b*b} elements. Barrier before reuse.`],['Accumulate the patch',`Each loaded operand serves ${b} output cells in this tile. This reduction chunk does ${2*b*b*b} FLOPs. Repeat for ${4/b} reduction chunks, with a barrier before overwriting.`],['Repeat for every output patch',`${(4/b)**2} output patches × ${4/b} chunks × ${2*b*b} loaded elements = ${a.loads} loads. Store 16 output elements once.`]],step);
    matrices.replaceChildren();
    const left=matrixTable(matrices,'Input U [4 × 4]',toyLeft),right=matrixTable(matrices,'Weights W [4 × 4]',toyRight);
    const whole=multiply(toyLeft,toyRight);
    const cells=whole.map((row,i)=>row.map((value,j)=>step===3?value:step===2&&i<b&&j<b?toyLeft[i].slice(0,b).reduce((sum,v,p)=>sum+v*toyRight[p][j],0):'?'));
    const out=matrixTable(matrices,step===3?'Output Y — all patches complete':step===2?'Y sums after the first reduction chunk':'Planned output Y — results concealed',cells);
    for(let i=0;i<b;i++)for(let j=0;j<b;j++){
      out.rows[i].cells[j].classList.add('selected');
      if(step>=1){left.rows[i].cells[j].classList.add('selected');right.rows[i].cells[j].classList.add('selected');}
    }
    values.hidden=step<3;
    if(step===3)metrics(values,[['Useful work','128 FLOPs'],['Logical load + store bytes',num(a.bytes)],['Two shared input tiles',`${a.sharedBytes} bytes`],['Logical arithmetic intensity',`≈ ${precise(a.flops/a.bytes)} FLOP/byte`]]);
    output.textContent=step===3?`Tile side ${b}: ${num(a.bytes)} bytes versus ${num(baseline.bytes)} at side 1, same result and 128 FLOPs. Global-load demand only; HBM reuse and runtime unmeasured.`:`Operation ${step+1} of 4. Predict the total load count before revealing it.`;
  });
}
function plot(host,a,compute,bandwidth) {
  const x=value=>70+(Math.log10(value)+1)/5*580,y=value=>260-(Math.log10(value)+2)/5*230;
  const roof=Array.from({length:100},(_,i)=>{const intensity=10**(-1+i*5/99);return `${i?'L':'M'}${x(intensity)},${y(Math.min(compute,bandwidth*intensity))}`;}).join(' ');
  const xticks=[0.1,1,10,100,1000,10000].map(v=>`<text x="${x(v)}" y="282" text-anchor="middle">${num(v)}</text>`).join('');
  const yticks=[0.01,0.1,1,10,100,1000].map(v=>`<text x="60" y="${y(v)+4}" text-anchor="end">${v}</text>`).join('');
  host.innerHTML=`<svg class="gpu-plot" viewBox="0 0 720 330" role="img" aria-label="Logarithmic roofline. Selected intensity ${precise(a.intensity)} FLOP per byte; ideal ceiling ${precise(a.ceilingTF)} TFLOP per second."><title>Hypothetical DRAM roofline</title><desc>Horizontal axis: FLOP per byte. Vertical axis: TFLOP per second. Sloped bandwidth roof joins the horizontal compute roof. The point lies on the ideal roof, not at measured performance.</desc><path class="axis" d="M70 20 V260 H650"></path><path class="roof" d="${roof}"></path><circle class="point" cx="${x(a.intensity)}" cy="${y(a.ceilingTF)}" r="6"></circle>${xticks}${yticks}<text x="360" y="315" text-anchor="middle">Arithmetic intensity (FLOP/byte), log scale</text><text x="70" y="14">TFLOP/s, log scale</text></svg>`;
}
function roof(root) {
  const {controls,body,output}=setup(root),chart=element('div'),values=element('div',undefined,'gpu-metrics');body.append(chart,values);
  const rows=control(controls,'Projection rows',[1,16,128,512,2048],1,draw),compute=control(controls,'Hypothetical dense TFLOP/s',[50,100,200],100,draw),bandwidth=control(controls,'Hypothetical DRAM TB/s',[0.5,1,2],1,draw);
  function draw() {
    const work=projection(+rows.value,4096,4096,2),a=roofline(work.flops,work.bytes,+compute.value,+bandwidth.value);
    plot(chart,a,+compute.value,+bandwidth.value);
    metrics(values,[['Work',`${num(work.flops)} FLOPs`],['Assumed DRAM bytes',num(work.bytes)],['Intensity',`≈ ${precise(a.intensity)} FLOP/byte`],['Ridge',`${num(a.ridge)} FLOP/byte`],['Compute time bound',`≈ ${precise(a.computeMs)} ms`],['Memory time bound',`≈ ${precise(a.memoryMs)} ms`]]);
    output.textContent=`Model limit: ${a.bound}. Ideal time lower bound ≈ ${precise(a.timeMs)} ms. Point is an upper roof at this intensity, not measured performance. 4096 input/output width, 2-byte inputs/weights/output; each fetched or stored once. Change compute alone, then bandwidth alone.`;
  }draw();
}
function phases(root) {
  const {controls,body,output}=setup(root),scene=element('div',undefined,'gpu-flow'),values=element('div',undefined,'gpu-metrics');body.append(scene,values);
  const phase=control(controls,'Phase',[['decode','Ordinary decode'],['prefill','Prefill chunk']], 'decode',draw),batch=control(controls,'Active sequences',[1,4,32,128,512],1,draw),chunk=control(controls,'Tokens per prefill chunk',[1,16,128,512,2048],512,draw);
  function draw() {
    const prefill=phase.value==='prefill',rows=+batch.value*(prefill?+chunk.value:1),work=projection(rows,4096,4096,2),a=roofline(work.flops,work.bytes,100,1);
    chunk.disabled=!prefill;
    flow(scene,[['Rows available this step',`${batch.value} sequences × ${prefill?chunk.value:1} processed token(s) = ${num(rows)} rows.`],['One shared projection weight matrix',`[${num(rows)} × 4096] × [4096 × 4096] → [${num(rows)} × 4096]. More rows reuse the same 33,554,432 weight bytes under this ideal model.`],['Resource comparison',`100 dense TFLOP/s; 1 TB/s DRAM. Ridge = 100 FLOP/byte. Work and byte assumptions match lesson 3.4.`]]);
    metrics(values,[['Projection work',`${num(work.flops)} FLOPs`],['Assumed DRAM bytes',num(work.bytes)],['Intensity',`≈ ${precise(a.intensity)} FLOP/byte`],['Ideal time bound',`≈ ${precise(a.timeMs)} ms`]]);
    output.textContent=`${prefill?'Prefill':'Decode'} projection: ${a.bound} roof in this model. ${prefill?'Try a one-token chunk.':'Try 512 active sequences.'} Phase is not the bottleneck. These results exclude attention and all other decoder work.`;
  }draw();
}
function kv(root) {
  const {controls,body,output}=setup(root),values=element('div',undefined,'gpu-metrics'),scene=element('div',undefined,'gpu-flow');body.append(scene,values);
  const batch=control(controls,'Sequences',[1,4,16],1,draw),context=control(controls,'Visible positions per sequence',[256,4096,32768],4096,draw),heads=control(controls,'KV heads (32 query heads)',[1,8,32],8,draw);
  function draw() {
    const a=decodeAttention(+batch.value,+context.value,32,+heads.value,128,2);
    flow(scene,[['Current query rows',`${batch.value} sequence(s), 32 query heads, width 128. Queries match cached keys, then normalized weights mix cached values.`],['KV-head reuse assumption',`${32/+heads.value} query head(s) per KV head. Assume each KV element is fetched once and reused across grouped queries.`],['Read old/current KV; append new KV',`${context.value} visible positions include the current consumed position. Appending one new K/V row is accounted separately from the read payload.`]]);
    metrics(values,[['One-layer KV read payload',`${num(a.kvBytes)} bytes`],['Read payload in MiB',`${num(a.kvBytes/2**20)} MiB`],['QK + weighted-V work',`${num(a.flops)} FLOPs`],['KV-read-only intensity',`${num(a.flops/a.kvBytes)} FLOP/byte`],['New KV append',`${num(a.appendBytes)} bytes`]]);
    output.textContent=`${num(a.kvBytes)} raw KV bytes per step under perfect grouped-query reuse. Doubling context or sequences doubles read payload and work here; reducing KV heads reduces payload but leaves query-head work unchanged. Not full attention traffic, HBM measurement or token latency.`;
  }draw();
}
const mounts={execution,residency,memory,coalescing,matmul,tiling,roofline:roof,phases,kv};
for(const root of document.querySelectorAll('[data-gpu-lab]'))mounts[root.dataset.gpuLab]?.(root);
for(const root of document.querySelectorAll('[data-check]'))for(const button of root.querySelectorAll('button'))button.addEventListener('click',()=>{
  for(const sibling of root.querySelectorAll('button'))sibling.setAttribute('aria-pressed',String(sibling===button));
  const feedback=root.querySelector('[data-feedback]');feedback.hidden=false;feedback.setAttribute('role','status');feedback.textContent=`${button.dataset.answer==='correct'?'Yes.':'Reconsider. '}${feedback.dataset.explanation}`;
});

function markMatrixNames(root) {
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];
  while(walker.nextNode())if(/\b[UWY]\b/.test(walker.currentNode.textContent)&&!walker.currentNode.parentElement.closest('var, code, pre, button, select, svg'))nodes.push(walker.currentNode);
  for(const node of nodes){
    const fragment=document.createDocumentFragment();
    for(const token of node.textContent.split(/(\b[UWY]\b)/g))fragment.append(/^[UWY]$/.test(token)?element('var',token):document.createTextNode(token));
    node.replaceWith(fragment);
  }
}
for(const root of document.querySelectorAll('[data-gpu-lab]')){
  markMatrixNames(root);
  new MutationObserver(records=>{
    const roots=new Set();
    for(const record of records)if(record.addedNodes.length)roots.add(record.target);
    for(const target of roots)markMatrixNames(target);
  }).observe(root,{childList:true,subtree:true});
}
