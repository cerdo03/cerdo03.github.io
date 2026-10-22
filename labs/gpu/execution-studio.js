import {describeLaunch,outputCalculation,placementFor} from './execution-model.js';

const root=document.querySelector('[data-execution-studio]');
const state={items:150,threads:64,output:137,step:0,calculation:0,placed:0,inspected:null};
const find=selector=>root.querySelector(selector);
const steps=[
  ['Start with one output','A matrix multiplication produces many numbers. Choose one output; keep following that same number as the view changes.','The selected output','Every cell has an address. A highlighted cell represents the number to compute, not a processor.'],
  ['Give it one thread','A thread is one run of the GPU function. In this simple mapping, its job is to compute one output number. It is work, not a dedicated physical core.','One thread’s calculation','Read one input row and one weight column. Multiply matching entries, add the products, then store this output.'],
  ['Find its warp','A warp groups 32 neighbouring threads within one block. A lane is a thread’s position in that warp, numbered 0–31.','32 lanes, one warp','Each numbered square is a lane. The outlined lane computes your selected output. Hatched lanes have no output and skip the calculation.'],
  ['Keep the block together','A block is a group of threads that can share temporary storage and synchronize. Its warps stay in the same block. The grid is all the blocks in this launch.','Inside the selected block','Each strip is a warp of 32 threads. Regrouping changes block boundaries; it does not change which output we follow.'],
  ['Place work on hardware','An SM (streaming multiprocessor) is a physical GPU unit. A block’s threads execute on one SM. The GPU has several SMs, and each can host multiple blocks when resources permit.','One possible placement','The main button places the next block. Coming from the block view places through your selected block, so its SM is visible immediately. This is one possible assignment, not a prediction of scheduling, speed, or simultaneous residency.']
];
function point(x,y,z=0){return [575+(x-y)*.88,231+(x+y)*.38-z];}
function polygon(points,cls){return `<polygon class="${cls}" points="${points.map(p=>p.join(',')).join(' ')}"/>`;}
function plate(x,y,w,h,z,depth,top='board-top'){
 const a=point(x,y,z),b=point(x+w,y,z),c=point(x+w,y+h,z),d=point(x,y+h,z);
 return polygon([d,c,point(x+w,y+h,z-depth),point(x,y+h,z-depth)],'board-side')+polygon([b,c,point(x+w,y+h,z-depth),point(x+w,y,z-depth)],'board-side')+polygon([a,b,c,d],top);
}
const plane=(x,y,z)=>`matrix(.88 .38 -.88 .38 ${point(x,y,z).join(' ')})`;
// The raised sheet is logical work, not an extra chip or a map of physical cores.
function workLayer(launch){
 if(state.step<1||state.step>3)return '';
 const selected=launch.selected,block=launch.blocks[selected.block],calculation=outputCalculation(state.output),z=130;
 let content='';
 if(state.step===1){
  const phase=['READ INPUTS','MULTIPLY','ADD PRODUCTS','STORE OUTPUT'][state.calculation];
  content=`<text class="work-title" x="10" y="21">THREAD ${state.output}</text><rect data-work-thread class="work-thread work-selected" x="12" y="38" width="158" height="82" rx="5"/><text class="work-on-selected" x="23" y="59">${phase}</text><text class="work-on-selected work-value" x="23" y="85">${state.calculation>=2?calculation.value:state.calculation===1?calculation.products.join(' + '):calculation.left.join(', ')}</text><text class="work-caption" x="12" y="145">${state.calculation===3?'Stored in output '+state.output:state.calculation===0?'Read row and weight column':state.calculation===1?'Three products':'One sum in the accumulator'}</text>`;
 }
 if(state.step===2){
  content=`<text class="work-title" x="10" y="21">WARP ${selected.warp} · 32 LANES</text>`+block.warps[selected.warp].lanes.map(lane=>{const x=12+lane.lane%8*20,y=38+Math.floor(lane.lane/8)*24;return `<rect data-work-thread class="work-thread ${lane.lane===selected.lane?'work-selected':''} ${lane.valid?'':'work-guarded'}" x="${x}" y="${y}" width="16" height="19" rx="2"/><text class="work-lane-label ${lane.lane===selected.lane?'work-on-selected':''}" x="${x+8}" y="${y+13}" text-anchor="middle">${lane.lane}</text>`;}).join('')+`<text class="work-caption" x="12" y="151">Selected lane ${selected.lane} → output ${state.output}</text>`;
 }
 if(state.step===3){
  content=`<text class="work-title" x="10" y="21">BLOCK ${selected.block} · ${state.threads} THREADS</text>`+block.warps.map(warp=>`<text class="work-caption" x="10" y="${45+warp.id*29}">W${warp.id}</text>${warp.lanes.map(lane=>`<rect data-work-thread class="work-thread ${lane.output===state.output?'work-selected':''} ${lane.valid?'':'work-guarded'}" x="${40+lane.lane%16*8.2}" y="${33+warp.id*29+Math.floor(lane.lane/16)*9}" width="6" height="7" rx="1"/>`).join('')}`).join('')+`<text class="work-caption" x="12" y="165">${state.threads/32} warps stay in one block</text>`;
 }
 const lowerA=point(146,61,35),lowerB=point(330,239,35),upperA=point(146,61,z),upperB=point(330,239,z);
 return `<g data-gpu-work-layer class="gpu-work-layer"><path class="work-guide" d="M ${lowerA.join(' ')} L ${upperA.join(' ')} M ${lowerB.join(' ')} L ${upperB.join(' ')}"/>${polygon([point(146,61,z),point(330,61,z),point(330,239,z),point(146,239,z)],'work-surface')}<g transform="${plane(146,61,z+1)}">${content}</g></g>`;
}
function draw(launch){
 const selected=launch.selected, placements=placementFor(launch,state.placed);
 const inspected=state.inspected??(state.step===4?placements.find(p=>p.block===selected.block)?.sm:null);
 const gridStart=Math.floor(state.output/60)*60,gridEnd=Math.min(gridStart+60,state.items);
 let cells='';
 for(let output=gridStart;output<gridEnd;output++){
  const n=output-gridStart,x=49+(n%10)*23,y=161+Math.floor(n/10)*23;
  const sameBlock=Math.floor(output/state.threads)===selected.block;
  const sameWarp=sameBlock&&Math.floor((output%state.threads)/32)===selected.warp;
  const cls=output===state.output?'output-selected':state.step===2&&sameWarp?'output-warp':state.step>=3&&sameBlock?'output-block':'';
  cells+=`<g role="button" tabindex="${output===state.output?0:-1}" aria-label="Follow output ${output}" aria-pressed="${output===state.output}" data-output="${output}" class="${cls}"><rect class="output-cell" x="${x}" y="${y}" width="19" height="19" rx="2"/>${output===state.output?`<text x="${x+9.5}" y="${y+12}" text-anchor="middle">${state.calculation===3?outputCalculation(output).value:output}</text>`:''}</g>`;
 }
 let board=plate(0,0,460,310,0,18);
 // Etched interconnects and package pins establish the board's physical structure.
 let traces='';
 for(let i=0;i<18;i++)traces+=`<path class="board-trace" d="M ${18+i*22} 20 V ${48+i%4*7} H ${165+i%6*18} V 94 M ${18+i*22} 285 V ${254-i%4*7} H ${180+i%6*16} V 190"/>`;
 for(let i=0;i<10;i++)traces+=`<path class="board-trace" d="M 18 ${48+i*22} H ${62+i%4*12} V ${110+i%4*16} H 160 M 444 ${48+i*22} H ${394-i%4*9} V ${110+i%4*16} H 325"/>`;
 let screws='';for(const [x,y] of [[14,14],[444,14],[14,296],[444,296]])screws+=`<circle class="board-edge" cx="${x}" cy="${y}" r="5"/><path class="board-edge" d="M ${x-2} ${y} h 4"/>`;
 let contacts='';for(let i=0;i<28;i++)contacts+=`<rect class="board-contact" x="${70+i*10}" y="300" width="7" height="23" rx="1"/>`;
 board+=`<g transform="${plane(0,0,1)}">${traces}${screws}${contacts}<text x="20" y="35" class="drawing-small">EXECUTION STUDY / 01</text></g>`;
 const chips=[[63,62],[63,124],[63,186],[368,62],[368,124],[368,186]];
 for(const [x,y] of chips){
  board+=plate(x,y,39,46,8,8,'chip-top');
  board+=`<g transform="${plane(x,y,9)}"><text class="chip-text" x="5" y="16">MEMORY</text><text class="chip-text" x="5" y="28">DRAM</text>${Array.from({length:6},(_,i)=>`<path class="board-edge" d="M -4 ${5+i*6} H 0 M 39 ${5+i*6} H 43"/>`).join('')}</g>`;
 }
 board+=plate(133,48,210,204,14,14,'die-base');
 for(let i=0;i<15;i++)board+=`<g transform="${plane(0,0,15)}"><path class="board-edge" d="M ${142+i*13} 43 v 5 M ${142+i*13} 252 v 5 M 128 ${58+i*13} h 5 M 343 ${58+i*13} h 5"/></g>`;
 board+=plate(146,61,184,178,29,10,'die-top');
 const sms=Array.from({length:4},(_,sm)=>{
  const x=153+sm%2*87,y=69+Math.floor(sm/2)*83;
  const blocks=placements.filter(p=>p.sm===sm);
  const blockMarks=blocks.map((placement,i)=>`<rect class="placed-block ${placement.block===selected.block?'placed-selected':''}" x="5" y="${30+i*13}" width="66" height="11" rx="1"/><text class="placed-label ${placement.block===selected.block?'placed-selected-label':''}" x="8" y="${38+i*13}">BLOCK ${placement.block}</text>`).join('');
  let circuitry='';for(let i=0;i<4;i++)for(let j=0;j<6;j++)circuitry+=`<rect class="sm-trace" x="${6+j*11}" y="${28+i*8}" width="8" height="5"/>`;
  return `<g role="button" tabindex="0" aria-label="Inspect SM ${sm}" aria-pressed="${inspected===sm}" data-sm="${sm}" class="${inspected===sm?'sm-selected':''}">${plate(x,y,78,73,35,6,'sm-top')}<g transform="${plane(x,y,36)}"><text class="sm-name" x="7" y="17">SM ${sm}</text><path class="sm-trace" d="M 5 22 H 72"/>${blocks.length?blockMarks:circuitry}</g></g>`;
 }).join('');
 board+=sms;
 // The raised outline exposes the compute die; it is not an extra processor.
 const dieAnchor=point(241,69,35),memoryAnchor=point(407,145,8),connectorAnchor=point(265,318,0);
 const trail=state.step>0?`<path class="trail arrival" d="M 293 250 C 360 250 352 144 ${dieAnchor[0]-35} ${dieAnchor[1]-24}"/>`:'';
 const outputValue=outputCalculation(state.output).value;
 const status=state.step===4?`${state.placed} / ${launch.blocks.length} blocks placed`:state.step>0?'Raised sheet = logical work, not physical cores':'Select an SM to inspect it';
 const sceneTitle=['One GPU. Many work groups.','Thread '+state.output+' · one output','Warp '+selected.warp+' · 32 threads','Block '+selected.block+' · '+state.threads+' threads','Assign whole blocks to SMs'][state.step];
 const desktop=`<g class="scene-output-panel"><rect class="output-panel" x="30" y="85" width="265" height="310" rx="9"/><text class="drawing-label" x="49" y="111">OUTPUT MATRIX</text><text class="drawing-small" x="49" y="135">${gridStart}–${gridEnd-1} of ${state.items} outputs</text>${cells}<text class="drawing-heading" x="49" y="337">Output ${state.output}${state.calculation===3?' = '+outputValue:''}</text><text class="drawing-small" x="49" y="361">Row ${selected.row} · column ${selected.column}</text><text class="drawing-small" x="49" y="380">Select a cell · arrow keys move</text></g>`;
 const mobile=window.matchMedia('(max-width:650px)').matches;
 find('[data-drawing]').innerHTML=`<svg viewBox="${mobile?'280 95 750 510':'0 0 1050 635'}" role="group" aria-label="Illustrated GPU with four selectable streaming multiprocessors and a selected output matrix cell"><title>Follow output ${state.output} onto an illustrated GPU</title><desc>Six memory packages surround a raised compute die containing four SMs. Select a component for an explanation. Work grouping is separate from these physical components.</desc>${mobile?'':desktop}${mobile?'':trail}<g class="scene-machine">${board}</g>${workLayer(launch)}<text class="drawing-label" x="421" y="110">OUTPUT ${state.output} / ${state.step===0||state.step===4?'PHYSICAL HARDWARE':'WORK CLOSE-UP'}</text><text class="drawing-heading" x="421" y="139">${sceneTitle}</text><text class="drawing-small" x="421" y="161">${status}</text><path class="leader" d="M 828 199 H 868 V ${dieAnchor[1]} H ${dieAnchor[0]+20}"/><text class="drawing-label" x="828" y="185">COMPUTE DIE</text><path class="leader" d="M 848 365 H 925 V ${memoryAnchor[1]} H ${memoryAnchor[0]+8}"/><text class="drawing-label" x="848" y="386">MEMORY</text><path class="leader" d="M 435 542 H 565 V ${connectorAnchor[1]+10} H ${connectorAnchor[0]}"/><text class="drawing-label" x="355" y="564">HOST CONNECTION</text><text class="drawing-small" x="355" y="585">Work arrives from the CPU</text><path class="zoom-bracket" d="M ${dieAnchor[0]-24} ${dieAnchor[1]-16} v -10 h 20"/></svg>`;
}
function detail(launch){
 const s=launch.selected,c=outputCalculation(state.output),block=launch.blocks[s.block];
 if(state.step===0)return `<p class="detail-kicker">A concrete matrix example · 10 columns · indices start at 0</p><div class="calculation-rows"><div><span>Input row ${s.row}</span><strong>[${c.left.join(', ')}]</strong></div><div><span>Weight column ${s.column}</span><strong>[${c.right.join(', ')}]</strong></div><div><span>Output ${state.output}</span><strong>${state.calculation===3?c.value:'Not computed yet'}</strong></div></div><p>Follow this cell’s thread to calculate its number. These are invented teaching inputs.</p>`;
 if(state.step===1)return `<div data-calculation><p class="detail-kicker">Thread ${state.output} · read row ${s.row}, column ${s.column}</p><div class="calculation-rows">${c.left.map((v,i)=>`<div><span>Pair ${i+1}</span><strong>${v} × ${c.right[i]}</strong><span>${state.calculation>=1?'= '+c.products[i]:'Multiply next'}</span></div>`).join('')}</div><p class="calculation-sum">${state.calculation>=2?c.products.join(' + ')+' = '+c.value:'The accumulator will hold the sum.'}</p><button type="button" class="execution-primary" data-calculate ${state.calculation===3?'disabled':''}>Step calculation</button> <span class="detail-kicker">${['Next: multiply pairs','Next: add products','Next: store the output','Stored '+c.value+' in output '+state.output][state.calculation]}</span></div>`;
 if(state.step===2){const warp=block.warps[s.warp];return `<p class="detail-kicker">Block ${s.block} / warp ${s.warp} · selected lane ${s.lane}</p><div class="execution-lanes" data-lanes>${warp.lanes.map(lane=>`<div data-lane class="execution-lane ${lane.lane===s.lane?'is-selected':''} ${lane.valid?'':'is-guarded'}" aria-label="Lane ${lane.lane}: ${lane.valid?'output '+lane.output:'guarded, no output'}"><span>${lane.lane}</span></div>`).join('')}</div><p>${warp.valid} lanes have outputs. ${32-warp.valid} are guarded. ${warp.valid<32?'A full warp still has 32 lane positions; unused lanes do no output work.':'All 32 lanes have work in this warp.'}</p>`;}
 if(state.step===3)return `<p class="detail-kicker">Block ${s.block} · ${state.threads} threads · ${state.threads/32} warps</p><div class="execution-warp-stack">${block.warps.map(warp=>`<div class="execution-warp-row ${warp.id===s.warp?'is-selected':''}"><strong>Warp ${warp.id}</strong><span class="warp-ticks" aria-hidden="true">${warp.lanes.map(lane=>`<i class="${lane.valid?'':'is-guarded'} ${lane.output===state.output?'is-selected':''}"></i>`).join('')}</span><span>${warp.valid} / 32 valid</span></div>`).join('')}</div><p>Dashed outline = work group. All ${state.threads/32} warps belong to one block. Hatched or empty marks represent guarded threads.</p>`;
 return `<p data-placement-status>${state.placed} of ${launch.blocks.length} blocks placed. Four illustrated SMs remain unchanged.</p><div class="execution-grid-summary">${launch.blocks.map(block=>{const placement=placementFor(launch,state.placed).find(p=>p.block===block.id);return `<button class="execution-block" type="button" data-follow-block="${block.id}" aria-pressed="${block.id===s.block}">Block ${block.id}<small>${placement?'SM '+placement.sm:'Not placed'}</small></button>`;}).join('')}</div><div class="execution-placement-controls"><button class="execution-text" type="button" data-reset-placement ${state.placed===0?'disabled':''}>Reset placement</button></div><p>Previously placed blocks remain drawn for tracking; this does not mean they are resident simultaneously.</p>`;
}
function render(message='',focusSelector=null){
 const launch=describeLaunch(state.items,state.threads,state.output),s=launch.selected;
 root.dataset.executionReady='';
 find('#story-title').textContent=steps[state.step][0];find('[data-story]').textContent=steps[state.step][1];
 find('#detail-title').textContent=steps[state.step][2];find('[data-detail-intro]').textContent=steps[state.step][3];
 find('[data-step-count]').textContent=`0${state.step+1} / 05`;
 root.querySelectorAll('[data-step]').forEach(button=>button.setAttribute('aria-current',Number(button.dataset.step)===state.step?'step':'false'));
 const input=find('#output-number');input.value=state.output;input.max=state.items-1;
 find('[data-output-range]').textContent=`Numbering starts at 0; ${state.items} outputs means 0–${state.items-1}.`;
 find('[data-output-prev]').disabled=state.output===0;find('[data-output-next]').disabled=state.output===state.items-1;
 const placement=placementFor(launch,state.placed).find(p=>p.block===s.block);
 find('[data-address]').textContent=`Output ${state.output} → ${state.step===0?`row ${s.row}, column ${s.column}`:`Block ${s.block} · thread ${s.localThread}${state.step>=2?` · warp ${s.warp} · lane ${s.lane}`:''}${state.step===4?' → '+(placement?'SM '+placement.sm:'not placed yet'):''}`}`;
 let inspection=`<strong>Follow the highlighted cell.</strong> Its identity stays the same when you regroup threads.`;
 if(state.step===1)inspection=`<strong>Thread ${state.output} has one job here.</strong> Read inputs, multiply, add, store. Three products give one output.`;
 if(state.step===2)inspection=`<strong>Lane ${s.lane} belongs to warp ${s.warp}.</strong> Warps are numbered within each block. Another block has its own warp 0.`;
 if(state.step===3)inspection=`<strong>Block ${s.block} contains your thread.</strong> Change threads per block below; the selected output remains ${state.output}.`;
 if(state.step===4)inspection=`<strong>${placement?'Block '+s.block+' is assigned to SM '+placement.sm+'.':'Your block has not been placed yet.'}</strong> Each block stays intact on one SM. Multiple blocks can be assigned to the same SM.`;
 if(state.inspected!==null)inspection=`<strong>SM ${state.inspected} · physical hardware</strong>This is one of the four illustrated streaming multiprocessors. It runs warps from blocks assigned to it. It is not a block, warp, or individual thread.`;
 find('[data-inspection]').innerHTML=inspection;
 find('[data-next-step]').textContent=state.step===1&&state.calculation<3?['Multiply input pairs →','Add the products →','Store the output →'][state.calculation]:state.step===4?(state.placed<launch.blocks.length?'Place next block':'Restart walkthrough →'):['Follow its thread →','Reveal its warp →','Reveal its block →','Place it on an SM →'][state.step];
 find('[data-back-step]').disabled=state.step===0;
 find('[data-detail]').innerHTML=detail(launch);draw(launch);
 find('[data-consequence]').textContent=`${state.items} outputs → ${launch.blocks.length} blocks of ${state.threads} threads. ${launch.guardedThreads} extra threads are guarded: they skip the calculation and store. ${state.items%state.threads?'The final block is partially used.':'Every thread has a valid output.'}`;
 if(message)find('[data-status]').textContent=message;
 if(focusSelector){const target=find(focusSelector);(target?.disabled?find('[data-next-step]'):target)?.focus({preventScroll:true});}
}
function selectOutput(output,focus=false){
 if(!Number.isInteger(output)||output<0||output>=state.items){find('#output-number').value=state.output;find('[data-status]').textContent=`Choose an output from 0 to ${state.items-1}.`;return;}
 state.output=output;state.calculation=0;state.inspected=null;render(`Following output ${output}.`,focus?`[data-output="${output}"]`:null);
}
root.querySelectorAll('button,input,select').forEach(control=>control.disabled=false);
root.addEventListener('click',event=>{
 const button=event.target.closest('button,[role="button"]');if(!button||button.disabled)return;
 if(button.hasAttribute('data-step')){state.step=Number(button.dataset.step);state.inspected=null;render(`View ${state.step+1}: ${steps[state.step][0]}.`);}
 if(button.hasAttribute('data-next-step')){
  const launch=describeLaunch(state.items,state.threads,state.output);state.inspected=null;
  if(state.step===1&&state.calculation<3){state.calculation++;render(['','Products calculated on the work layer.','Products added on the work layer.','Output stored in the selected matrix cell.'][state.calculation]);}
  else if(state.step===3){state.step=4;state.placed=Math.max(state.placed,launch.selected.block+1);render(`Placed blocks 0 through ${launch.selected.block}; your block is on SM ${launch.selected.block%4}.`);}
  else if(state.step===4&&state.placed<launch.blocks.length){state.placed++;render(`Placed block ${state.placed-1} on SM ${(state.placed-1)%4}.`);}
  else if(state.step===4){state.step=0;state.placed=0;state.calculation=0;render('Walkthrough restarted.');}
  else{state.step++;render(`View ${state.step+1}: ${steps[state.step][0]}.`);}
 }
 if(button.hasAttribute('data-back-step')){state.step=Math.max(0,state.step-1);state.inspected=null;render();}
 if(button.hasAttribute('data-output-prev'))selectOutput(state.output-1);
 if(button.hasAttribute('data-output-next'))selectOutput(state.output+1);
 if(button.hasAttribute('data-output'))selectOutput(Number(button.dataset.output),true);
 if(button.hasAttribute('data-sm')){state.inspected=Number(button.dataset.sm);render(`Inspecting SM ${state.inspected}.`,`[data-sm="${state.inspected}"]`);}
 if(button.hasAttribute('data-calculate')){state.calculation=Math.min(3,state.calculation+1);render(['','Products calculated.','Products added.',`Stored ${outputCalculation(state.output).value} in output ${state.output}.`][state.calculation],'[data-calculate]');}
 if(button.hasAttribute('data-reset-placement')){state.placed=0;state.inspected=null;render('Placement reset.','[data-next-step]');}
 if(button.hasAttribute('data-follow-block'))selectOutput(Math.min(state.items-1,Number(button.dataset.followBlock)*state.threads+state.output%state.threads));
});
root.addEventListener('keydown',event=>{
 const cell=event.target.closest('[data-output]'),sm=event.target.closest('[data-sm]');
 if((cell||sm)&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.target.closest('[role="button"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));}
 if(cell&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
  event.preventDefault();const shift={ArrowLeft:-1,ArrowRight:1,ArrowUp:-10,ArrowDown:10}[event.key];selectOutput(Math.max(0,Math.min(state.items-1,state.output+shift)),true);
 }
 if(event.target.id==='output-number'&&event.key==='Enter')selectOutput(Number(event.target.value));
});
find('#output-number').addEventListener('change',event=>selectOutput(Number(event.target.value)));
for(const [selector,key] of [['#output-count','items'],['#block-size','threads']])find(selector).addEventListener('change',event=>{
 const previous=describeLaunch(state.items,state.threads,state.output);state[key]=Number(event.target.value);state.output=Math.min(state.output,state.items-1);state.placed=0;state.calculation=0;state.inspected=null;
 const launch=describeLaunch(state.items,state.threads,state.output);
 render(`Now ${launch.blocks.length} blocks; previously ${previous.blocks.length}. Following output ${state.output}; placement reset. The four illustrated SMs do not change.`);
});
window.matchMedia('(max-width:650px)').addEventListener('change',()=>draw(describeLaunch(state.items,state.threads,state.output)));
render();
