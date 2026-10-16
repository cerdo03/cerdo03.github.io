import {renderVisualMath} from './math-integration.js';
import {mountStudio} from './studio-arithmetic.js';
import {flowSnapshot,animateFlow} from './flow-motion.js';
import { attentionState, promptTokens, representations } from '../inference/guide-model.js';
import { projectionTrace, valueTrace, requestFrame, sharingState, predictionState, dependencyState } from './visual-model.js';
const number=x=>Number.isFinite(x)?Number(x.toFixed(3)).toString():'−∞';
const share=x=>x>0&&x<.001?'<0.001':number(x);
const shares=row=>`[${row.map(share).join(', ')}]`;
const vector=row=>`[${row.map(number).join(', ')}]`;
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const symbols=text=>escape(text).replace(/\b(WQ|WK|WV|WO|Q|K|V|x)\b/g,key=>`<tspan class="sym" data-symbol="${key.length===2?`W_${key[1]}`:key}" aria-describedby="sym-${key.length===2?`W_${key[1]}`:key}">${key}</tspan>`);
const node=(x,y,w,label,lines=[],active=false,action='')=>`<g class="route-node ${active?'is-active':''}" ${/^(Q|K|V)(?=[ \[:=·]|$)/.test(label)?`data-role="${label[0]}"`:''} ${action?`role="button" tabindex="0" aria-pressed="${active}" data-pick="${escape(action)}" aria-label="${escape(action.startsWith('key:')?`Inspect score for ${promptTokens[Number(action.split(':')[1])]}`:label)}"`:''}><rect x="${x}" y="${y}" width="${w}" height="${45+lines.length*21}" rx="7"/><text x="${x+12}" y="${y+25}">${symbols(label)}</text>${lines.map((line,i)=>`<text class="visual-small" x="${x+12}" y="${y+49+i*21}">${symbols(line)}</text>`).join('')}</g>`;
const edge=(x,y,toX,toY,active=false,label='')=>`<path class="route-edge ${active?'is-active':''}" d="M ${x} ${y} C ${(x+toX)/2} ${y}, ${(x+toX)/2} ${toY}, ${toX} ${toY}"/><path class="visual-arrow ${active?'is-active':''}" transform="translate(${toX} ${toY}) rotate(${toX===x?toY>=y?90:-90:toX>x?0:180})" d="M -6 -4 L 0 0 L -6 4"/>${label?`<text class="route-edge-label" x="${(x+toX)/2-14}" y="${(y+toY)/2-8}">${symbols(label)}</text>`:''}`;
const svg=(body,height,label)=>`<div class="route-canvas" tabindex="0" role="region" aria-label="${escape(label)}; scroll horizontally on narrow screens"><svg viewBox="0 0 900 ${height}" role="group" aria-label="${escape(label)}">${body}</svg></div>`;
const select=(key,label,items,value,disabled=false)=>`<label>${label}<select data-field="${key}" ${disabled?'disabled':''}>${items.map(([v,t])=>`<option value="${v}" ${v===value?'selected':''}>${escape(t)}</option>`).join('')}</select></label>`;
function arithmetic(type,s,rows){
 const a=attentionState(s.position,undefined,rows),component=s.component,token=promptTokens[s.position];
 const position=select('position','Inspect position',promptTokens.map((t,i)=>[i,`${i+1}: ${t}`]),s.position);
 if(type==='projections'){
  const matrices={Q:[[1,0],[0,1]],K:[[0,1],[1,0]],V:[[2,0],[0,1]]},role=s.role,matrix=matrices[role],calc=projectionTrace(a.x,matrix,component);
  const outputs={Q:a.q,K:a.keys[s.position],V:a.values[s.position]};
  let graph=node(15,190,155,`x at ${token}`,[vector(a.x),'Same input for Q/K/V'],s.stage===0);
  for(const [index,r] of ['Q','K','V'].entries()){
   const y=25+index*145;
   graph+=edge(170,230,235,y+40,s.stage===0,'×');
   graph+=node(235,y,230,`W${r} · 2 × 2 matrix`,matrices[r].map(vector),s.stage===1);
   graph+=edge(465,y+40,535,y+40,s.stage>=1,'≈');
   graph+=node(535,y,345,`${r} = x × W${r}`,[vector(outputs[r]),'','',''],s.stage===2);
   for(let c=0;c<2;c++){
    graph+=node(550+c*165,y+60,145,`${r}[${c+1}]`,[number(outputs[r][c])],!!s.inspect&&role===r&&component===c,`projection:${r}:${c}`);
   }
  }
  if(s.inspect){
   graph+=`<text class="visual-label" x="15" y="465">Inspect ${role}[${component+1}]: input × column ${component+1} of W${role}</text>`;
   for(let i=0;i<2;i++){
    const y=490+i*110;
    graph+=node(15,y,150,`x component ${i+1}`,[number(a.x[i])],s.stage===0);
    graph+=node(225,y,180,`W${role} matrix entry`,[`row ${i+1}, column ${component+1}`,number(matrix[i][component])],s.stage===1);
    graph+=edge(165,y+40,225,y+40,s.stage>=1,'×');
    graph+=node(470,y,160,'Product',[`${number(a.x[i])} × ${number(matrix[i][component])}`,number(calc.terms[i])],s.stage===1);
    graph+=edge(405,y+40,470,y+40,s.stage>=1);
    graph+=edge(630,y+40,700,590,s.stage>=2,'+');
   }
   graph+=node(700,555,185,'Sum of products',[calc.terms.map(number).join(' + '),`${role}[${component+1}] ≈ ${number(calc.total)}`],s.stage===2);
  }
  return {graph:svg(graph,s.inspect?745:460,'Complete Q K V projections with selectable output components'),equation:'Q = x × WQ; K = x × WK; V = x × WV',controls:position,max:0,note:'Same invented first-layer head as the main lesson. Calculations use full precision; displayed numbers are rounded.',caption:s.inspect?`${role}[${component+1}]: ${calc.terms.map(number).join(' + ')} ≈ ${number(calc.total)}. The other components and both other projections remain visible above.`:`“${token}”: the same x ${vector(a.x)} is multiplied by three matrices. Q ${vector(a.q)}, K ${vector(a.keys[s.position])}, V ${vector(a.values[s.position])}. Select any output component to inspect its products and sum.`};
 }
 if(type==='scores'){
  const j=s.key,k=a.keys[j],terms=a.q.map((q,i)=>q*k[i]),raw=terms.reduce((x,y)=>x+y,0),allowed=j<=s.position;
  let graph='';
  for(let i=0;i<2;i++){
   const y=35+i*100;
   graph+=node(15,y,170,`Q[${i+1}] at ${token}`,[number(a.q[i])],s.stage===0);
   graph+=node(230,y,175,`K[${i+1}] at ${promptTokens[j]}`,[number(k[i])],s.stage===0);
   graph+=edge(185,y+35,230,y+35,s.stage>=1,'×');
   graph+=node(450,y,145,'Product',[number(terms[i])],s.stage===1);
   graph+=edge(405,y+35,450,y+35,s.stage>=1);
   graph+=edge(595,y+35,670,115,s.stage>=2,'+');
  }
  graph+=node(670,75,210,'Dot product → score',[`${terms.map(number).join(' + ')} ≈ ${number(raw)}`,allowed?`÷ √2 ≈ ${number(raw/Math.sqrt(2))}`:'Future key → masked −∞'],s.stage>=2);
  if(s.stage>=4){
   graph+=`<path class="route-edge is-active" d="M 775 162 V 240 H 125 V 270"/><path class="visual-arrow is-active" transform="translate(125 270) rotate(90)" d="M -6 -4 L 0 0 L -6 4"/><text class="route-edge-label" x="320" y="232">Repeat for the other keys → the whole score row</text>`;
   graph+=node(15,270,215,'All scaled, masked scores',[vector(a.scores)],true);
   graph+=edge(230,310,300,310,true,'exp');
   const exps=a.scores.map(v=>Math.exp(v-Math.max(...a.scores)));
   graph+=node(300,270,240,'Exponentials',[shares(exps),`sum ≈ ${number(exps.reduce((x,y)=>x+y,0))}`],true);
   graph+=edge(540,310,620,310,true,'÷ sum');
   graph+=node(620,270,260,'Attention weights',[shares(a.weights),'Over input positions, not words to output'],true);
  }
  let overview='';
  for(let key=0;key<3;key++){
   const y=25+key*125,dot=a.q.reduce((sum,q,i)=>sum+q*a.keys[key][i],0);
   overview+=node(15,y,235,`Compare with ${promptTokens[key]}`,[`Q ${vector(a.q)}`,`K ${vector(a.keys[key])}`],s.stage===0);
   overview+=edge(250,y+40,305,y+40,s.stage>=1);
   overview+=node(305,y,245,'Dot → scale → mask',[`Σ(Qᵢ × Kᵢ) ≈ ${number(dot)}`,key<=s.position?`÷ √2 ≈ ${number(a.scores[key])}`:'Future key → masked −∞'],!!s.inspect&&s.key===key,`key:${key}`);
   overview+=edge(550,y+40,600,190,s.stage>=3);
   overview+=edge(725,190,770,y+35,s.stage>=4);
   overview+=node(770,y,115,`Share: ${promptTokens[key]}`,[share(a.weights[key])],s.stage>=4);
  }
  overview+=node(600,150,125,'Softmax',['Whole row','Shares sum to 1'],s.stage===4);
  const complete=overview+(s.inspect?`<g transform="translate(0 440)">${graph}</g>`:'');
  return {graph:svg(complete,s.inspect?850:395,'All query key comparisons and attention shares with optional arithmetic'),equation:'scoreⱼ = Σᵢ(Qᵢ × Kⱼᵢ) ÷ √2; shares = softmax(masked scores)',controls:position,max:0,note:'Same invented first-layer head; calculations use full precision, display rounded. Future-position shares are exactly zero; tiny positive shares are shown as <0.001.',caption:s.inspect?[`Q for “${token}” compares with K for “${promptTokens[j]}”.${allowed?'':' This later key is shown to illustrate masking; its score will not contribute.'}`,`Multiply matching components. These products are not attention weights yet.`,`Add products to form one dot product: ${number(raw)}.`,`Divide by √2. ${allowed?'This position is allowed.':'This key is later than the query, so replace its score with −∞.'}`,`Softmax acts on the whole score row. exp(score − maximum) ÷ sum gives the shares; future positions receive exactly zero.`][s.stage]:`The same Q ${vector(a.q)} compares with every key. Each comparison gives one score; softmax uses the whole allowed row to produce shares ${shares(a.weights)}. Future positions receive exactly zero. Select a score node to inspect its arithmetic.`};
 }
 const mix=valueTrace(a.values,a.weights,component);let graph='';
 for(let j=0;j<3;j++){
  const y=20+j*105,contribution=a.values[j].map(v=>v*a.weights[j]);
  graph+=node(15,y,190,`V at ${promptTokens[j]}`,[vector(a.values[j]),j>s.position?'Masked: share 0':'Allowed position'],s.stage===0);
  graph+=edge(205,y+40,270,y+40,s.stage>=1,'×');
  graph+=node(270,y,165,'Share',[share(a.weights[j])],s.stage===1);
  graph+=edge(435,y+40,500,y+40,s.stage>=1,'≈');
  graph+=node(500,y,195,'Contribution',[vector(contribution)],s.stage===1);
  graph+=edge(695,y+35,735,160,s.stage>=2,'+');
 }
 graph+=node(735,115,150,'Head result',[vector(a.output)],s.stage===2);
 for(let c=0;c<2;c++)graph+=node(735,205+c*85,150,`Result[${c+1}]`,[number(a.output[c])],!!s.inspect&&component===c,`component:${c}`);
 if(s.inspect){
  graph+=`<text class="visual-label" x="15" y="425">Inspect result component ${component+1}: scale each V component, then add</text>`;
  for(let j=0;j<3;j++){
   const y=450+j*90;
   graph+=node(15,y,205,`V[${component+1}] at ${promptTokens[j]}`,[number(a.values[j][component])],s.stage===0);
   graph+=edge(220,y+35,290,y+35,s.stage>=1,'×');
   graph+=node(290,y,205,'Attention weight',[share(a.weights[j])],s.stage===1);
   graph+=edge(495,y+35,555,y+35,s.stage>=1);
   graph+=node(555,y,150,'Contribution',[`≈ ${number(mix.terms[j])}`],s.stage===1);
   graph+=edge(705,y+35,755,575,s.stage>=2,'+');
  }
  graph+=node(755,540,130,`Result[${component+1}]`,[`≈ ${number(mix.total)}`],s.stage===2);
 }
 return {graph:svg(graph,s.inspect?740:390,'Whole value vectors weighted and summed, with selectable result components'),equation:'head result = Σⱼ (shareⱼ × Vⱼ)',controls:position,max:0,note:'Same invented first-layer head; calculations use full precision, display rounded. Inspection does not change the calculation.',caption:s.inspect?`Component ${component+1}: ${mix.terms.map(number).join(' + ')} ≈ ${number(mix.total)}. Both components of every V and the full result stay visible above.`:`Each share scales the whole V vector. Add the contribution vectors component by component to obtain ${vector(a.output)}. Select a result component to inspect its arithmetic. Cached K/V stay unchanged.`};
}
function request(s,rows,options){
 const f=requestFrame(s.pass,s.stage,rows,options.prompt,options.answer),query=f.queries[Math.min(s.query,f.queries.length-1)];
 const all=[...f.old,...f.newRows],height=Math.max(570,375+all.length*96);let graph='';
 graph+=node(10,25,205,s.pass===0?'Prefill input':'Decode input',[f.input.join(' · '),`${f.input.length} new position${f.input.length===1?'':'s'}`],s.stage===0);
 if(s.stage>=1)graph+=edge(215,65,275,65,true);
 if(s.stage>=1)graph+=node(275,25,235,`x × WQ / WK / WV`,[s.stage>=1?`Q = ${vector(query.q)}`:'Q pending',s.stage>=1?`new K = ${vector(query.k)}`:'new K pending',s.stage>=1?`new V = ${vector(query.v)}`:'new V pending'],s.stage===1);
 graph+=node(630,25,255,'Chosen answer so far',[f.answer.join(' · ')||'None',s.stage===5?`“${f.chosen}” has no K/V yet`:'No new token chosen in this pass'],s.stage===5);
 graph+=`<text class="visual-label" x="18" y="185">Layer 1 · head 1: ${f.cache.length} stored K/V rows</text>`;
 const resultY=205+Math.floor(all.length/2)*96;
 for(let i=0;i<all.length;i++){
  const r=all[i],isNew=i>=f.old.length,y=205+i*96,created=!isNew||s.stage>=1,stored=!isNew||s.stage>=4,allowed=i<=query.position;
  if(!created)continue;
  graph+=node(15,y,390,`${i+1}: ${r.token} · ${stored?isNew?'new row stored':'cached · unchanged':'fresh from its own x'}`,[created?`K ${vector(r.k)}    V ${vector(r.v)}`:'K/V not calculated yet'],isNew&&s.stage===4);
  if(isNew&&i===query.position&&s.stage>=1)graph+=edge(395,135,405,y+35,s.stage===1||s.stage===4,s.stage>=4?'store K/V':'new K/V');
  if(s.stage>=2&&allowed){
   graph+=edge(510,85,535,y+30,s.stage===2,'Q');
   graph+=edge(405,y+35,535,y+35,s.stage===2||s.stage===3,s.stage===2?'K':'V');
   graph+=node(535,y,180,s.stage===2?'Σ(Qᵢ × Kᵢ) ÷ √2':'share × V',s.stage===2?[`≈ ${number(query.scores[i])}`]:[`weight ≈ ${share(query.weights[i])}`,`≈ ${vector(r.v.map(v=>v*query.weights[i]))}`],s.stage===2||s.stage===3);
   if(s.stage>=3)graph+=edge(715,y+35,760,resultY+35,s.stage===3,'+');
  }
 }
 if(s.stage>=3)graph+=node(760,resultY,125,'Head result',[vector(query.output),'not cached'],s.stage===3);
 const bottom=245+all.length*96;
 if(s.stage===5){graph+=node(15,bottom,390,'Remaining layer → model stack',[s.stage===5?'Output projection, residuals, feed-forward, next layers':'Waiting for the rest of the forward pass',s.stage===5?'Final vector → vocabulary scores':'Head result continues here; cache stays separate'],s.stage===5);
 graph+=edge(405,bottom+40,600,bottom+40,s.stage===5,'select');
 graph+=node(600,bottom,285,'Next output token',[s.stage===5?f.chosen:'Not chosen yet','Selection does not create a cache row'],s.stage===5);}
 if(s.stage===5)graph+=`<path class="route-edge ${s.stage===5?'is-active':''}" d="M 885 ${resultY+35} H 895 V ${bottom-15} H 210 V ${bottom}"/><path class="visual-arrow ${s.stage===5?'is-active':''}" transform="translate(210 ${bottom}) rotate(90)" d="M -6 -4 L 0 0 L -6 4"/>`;

 const titles=['New input','Calculate Q/K/V','Read keys and score','Mix values','Store new K/V','Choose next token'];
 const controls=select('pass','Pass',Array.from({length:(options.answer||['blue','today','.']).length},(_,p)=>[p,p===0?'Prefill':`Decode ${p}`]).filter(([p])=>p>=(options.minPass||0)),s.pass)+select('query',s.pass===0?'Inspect prompt query':'Current query',f.input.map((t,i)=>[i,t]),Math.min(s.query,f.input.length-1),s.pass!==0);
 const captions=[s.pass===0?'All prompt positions are supplied together. Select a query to inspect its allowed keys.':`“${f.input[0]}” was chosen in the preceding pass. It now enters the model; earlier positions supply cached K/V.`,
 'Multiply each new position’s x by three learned matrices: Q = x × WQ, K = x × WK, V = x × WV. Each output component is a sum of products. Q/K score compatibility; V supplies information. Old cache rows are not used to create these new projections.',
 'For each allowed key, multiply matching Q/K components, add them, then divide by √2: one score per key. Later positions are masked. Softmax converts the allowed scores into shares summing to 1.',
 'Multiply each V component by that position’s softmax share, then add contributions component by component. This head result continues through the model; it never replaces cached K/V.',
 'Store the new K/V rows. Earlier rows retain exactly the same numbers. The drawing groups operations for teaching; real engines may store new K/V before attention.',
 `The final-layer output supplies vocabulary scores, then a token is chosen. “${f.next}” is scripted for this trace and remains outside the cache until its next pass.`];
 return {graph:svg(graph,height,'New input, fresh projections, cache reads, head result and chosen output'),controls,max:5,title:titles[s.stage],caption:captions[s.stage],note:'One first-layer head shown; every layer has its own cache. Trace continuation is scripted, not predicted by this tiny head.'};
}
function heads(s){
 const stage=s.stage;let graph=node(15,135,165,'Whole incoming x',['x₁ x₂ x₃ x₄'],stage===0);
 if(stage>=1)graph+=edge(180,175,235,175,true);
 if(stage>=1)graph+=node(235,135,210,'Combined Q projection',['x × WQ: 4 × 4','q₁₁ q₁₂ | q₂₁ q₂₂'],stage===1);
 if(stage>=2)for(let h=0;h<2;h++){
  const y=35+h*215;
  graph+=edge(445,175,505,y+45,stage>=2,`columns ${h*2+1}–${h*2+2}`);
  graph+=node(505,y,170,stage>=3?`Head ${h+1} result`:`Head ${h+1} Q`,[stage>=3?h===0?'a₁  a₂':'b₁  b₂':h===0?'q₁₁ q₁₂':'q₂₁ q₂₂',stage>=3?'After its attention':'2 projected components'],stage===2||stage===3);
  if(stage>=4)graph+=edge(675,y+45,725,175,true);
 }
 if(stage>=4)graph+=node(725,140,160,'Concatenate',['a₁ a₂ b₁ b₂','4 components'],stage===4);
 if(stage>=5){graph+=edge(805,227,710,405,true);graph+=node(300,370,410,'joined × WO → update',['4 × 4 output projection → 4 components','Residual addition: x + update, component by component'],true);}
 return {graph:svg(graph,490,'Full input projected into combined columns, split between heads, then joined'),controls:'',max:5,caption:['Both heads receive the same entire four-component x. This is a wider schematic, not the two-component numeric toy.','Each head has its own 4 × 2 query matrix. Placing those matrices side by side gives one 4 × 4 WQ; it computes both projections together.','Split the projected columns: 1–2 become head 1 Q, 3–4 become head 2 Q. K and V split the same way. The original embedding is never sliced in half.','Each head independently compares its Q/K and mixes its V. Its result still has two components.','Concatenation places the two head results side by side. No addition happens here: 2 + 2 components = 4.','Multiply the joined vector by WO: multiply matching entries and add products for each output component. This creates a four-component update. Add it to incoming x component by component; this residual addition preserves the width.'][stage]};
}
function sharing(s,rows){
 const a=sharingState(s.kvHeads,rows),selected=a.heads[s.head];let graph='';
 for(const head of a.heads){
  const y=20+head.head*95,cacheY=35+head.group*(360/s.kvHeads),on=head.head===s.head;
  graph+=node(15,y,180,`Query head ${head.head+1}`,[vector(head.q)],on,`head:${head.head}`);
  graph+=edge(195,y+35,340,y+35,on,'Q');
  graph+=node(340,y,260,`Head ${head.head+1} attention result`,[vector(head.output),`Reads KV head ${head.group+1}`],on);
  graph+=edge(675,cacheY+45,600,y+35,on,'K/V');
 }
 for(const c of a.caches){const y=35+c.group*(360/s.kvHeads);graph+=node(675,y,210,`KV head ${c.group+1}`,[`K rows: ${c.keys.map(vector).join(' ')}`,`V rows: ${c.values.map(vector).join(' ')}`],c.group===selected.group);}
 const other=a.heads.find(h=>h.head!==selected.head&&h.group===selected.group);
 return {graph:svg(graph,440,'Query heads connected to their shared key/value head and individual results'),controls:select('kvHeads','Compare toy architectures',[[4,'MHA: 4 query / 4 KV'],[2,'GQA: 4 query / 2 KV'],[1,'MQA: 4 query / 1 KV']],s.kvHeads),max:0,caption:`Head ${s.head+1}: compare Q ${vector(selected.q)} with keys in KV head ${selected.group+1} → weights ${shares(selected.weights)}. Multiply that head’s V rows by these weights, then add → result ${vector(selected.output)}.${other?` Head ${other.head+1} reads those exact same K/V rows, but its own Q gives weights ${shares(other.weights)} and result ${vector(other.output)}.`:' MHA keeps separate K/V for every query head.'}`,note:'Invented first-layer projections: Qh = [x₁, h × x₂]; Kg = [g × x₂, x₁]; Vg = [2x₁, g × x₂]. Heads/groups numbered from 1 here. Comparing architectures does not alter a trained checkpoint.'};
}
function prediction(s,rows){
 const p=predictionState(rows),stage=s.stage,j=s.candidate;let graph='';
 if(stage<=1){
  for(let l=0;l<(stage===0?1:2);l++){
   const a=p.layers[l],y=25+l*175;
   graph+=node(15,y,170,`Layer ${l+1} input x`,[vector(a.incoming[2])],stage===0);
   graph+=edge(185,y+35,235,y+35,true);
   graph+=node(235,y,170,'Attention result',[vector(a.attention[2])],stage===0);
   if(stage>=1){graph+=edge(405,y+35,465,y+35,true,'+ x');
   graph+=node(465,y,170,'Residual u',[vector(a.residual[2])],stage===1);
   graph+=edge(635,y+35,695,y+35,stage>=1);
   graph+=node(695,y,190,'Feed-forward + residual',[vector(a.outgoing[2]),'u + 0.1u'],stage===1);
   if(l===0)graph+=edge(885,y+35,15,y+210,true,'next layer');}
  }
 }else{
  const calc=projectionTrace(p.final,p.vocabulary,j);
  graph+=node(15,35,180,'Final vector h',[vector(p.final)],true);
  graph+=edge(195,75,245,75,true,'×');
  graph+=node(245,35,225,`Vocabulary column: ${p.tokens[j]}`,[vector(p.vocabulary.map(r=>r[j]))],stage===2);
  graph+=edge(470,75,545,75,true);
  graph+=node(545,35,335,'One logit',[`${p.final.map((v,i)=>`${number(v)} × ${number(p.vocabulary[i][j])}`).join(' + ')}`,`≈ ${number(calc.total)}`],stage===2);
  for(let i=0;i<3;i++){
   const y=185+i*85;
   graph+=node(15,y,220,p.tokens[i],[`logit ≈ ${number(p.logits[i])}`],i===j,`candidate:${i}`);
   if(stage>=3)graph+=edge(235,y+35,305,300,true);
   if(stage===3){graph+=edge(560,300,645,y+35,true);graph+=node(645,y,235,p.tokens[i],[`probability ≈ ${share(p.probabilities[i]*100)}%`],true);}
  }
  if(stage===3){
   const exps=p.logits.map(x=>Math.exp(x-Math.max(...p.logits))),sum=exps.reduce((a,b)=>a+b,0);
   graph+=node(305,255,255,'Softmax across all candidates',[`exp(z − max): ${shares(exps)}`,`sum ≈ ${number(sum)}`,'Each exponential ÷ this same sum'],true);
  }
  if(stage===4){graph+=node(305,255,255,'Greedy: compare all scores',[`largest logit ≈ ${number(Math.max(...p.logits))}`],true);graph+=edge(560,290,645,290,true);graph+=node(645,255,235,'Chosen output token',[p.greedy,'Not processed or cached yet'],true);}

 }
 return {graph:svg(graph,470,'Toy block output calculated through vocabulary projection, probabilities and token selection'),controls:select('candidate','Inspect vocabulary column',p.tokens.map((t,i)=>[i,t]),j,stage<2),max:4,caption:['At “is”, each layer reads its own allowed context. These numerical attention results use the same starting embeddings and Q/K/V matrices as the first-layer example.','Add incoming x to the attention update. Our deliberately tiny FF branch returns 0.1u; adding it gives 1.1u. All three positions pass through both layers, although only “is” is displayed.','A vocabulary matrix has one column per candidate token. Multiply final h by a column and add the products: one score (logit). Select another candidate to inspect its column.','Softmax over vocabulary logits gives next-token probabilities. These are calculated from h, not attention shares over The/sky/is.','Greedy selection chooses the largest score. A sampled choice may differ; neither choice processes the chosen token.'][stage],note:'Separate complete toy model: 2 layers, 1 head, identity output projections, identical Q/K/V matrices in both toy layers, linear FF = 0.1u, no normalization/positions. Vocabulary [[0.2, −0.15, 0.1], [−0.1, 0.2, 0.05]]. All values calculated; not trained-model predictions.'};
}
function dependencies(s,type){
 const d=dependencyState(s.change);let graph='';
 const columns=[25,245,465,685];
 for(let i=0;i<4;i++){
  graph+=node(columns[i],20,185,`Cached: ${d.a[i]}`,['K/V across model layers']);
  if(s.stage>=1){graph+=edge(columns[i]+90,86,columns[i]+90,200,true,d.reused[i]?'reuse':'invalidate');graph+=node(columns[i],200,185,`New: ${d.b[i]}`,[d.reused[i]?'Same K/V retained':'Recompute position state'],!d.reused[i]);}
  if(s.stage>=2&&i===s.change)for(let j=i+1;j<4;j++){const from=columns[i]+90,to=columns[j]+90,bend=300+(j-i)*20;graph+=`<path class="route-edge is-active" d="M ${from} 266 C ${from} ${bend}, ${to} ${bend}, ${to} 266"/><path class="visual-arrow is-active" transform="translate(${to} 266) rotate(-90)" d="M -6 -4 L 0 0 L -6 4"/>`;}
 }
 if(s.change===-1&&s.stage>=1)graph+=node(685,315,185,'Appended: today',['New position → new K/V'],true);
 const options=[[-1,'Append “today”'],[0,'Change The → Our'],[1,'Change sky → sea'],[2,'Change is → looks'],[3,'Change blue → gray']];
 return {graph:svg(graph,420,'Changed-token causal dependencies and reusable prefix'),controls:select('change',type==='prefix'?'Compare requests':'Modify the sequence',options,s.change),max:2,caption:[`Original request: ${d.a.join(' ')}. ${type==='prefix'?'Compare a second compatible request.':'Inspect whether earlier cached state stays valid.'}`,`${d.match} identical beginning positions can reuse K/V. ${s.change===-1?'Appending does not change earlier causal inputs.':'The changed position and later positions need fresh whole-model state—even unchanged words can receive different context in deeper layers.'}`,s.change===-1?'The new position reads the retained prefix K/V. Only its own K/V is newly calculated.':`Following the arrows shows potential dependencies, not guaranteed numerical changes. “${d.b.at(-1)}” ${d.a.at(-1)===d.b.at(-1)?'has the same spelling, but a different earlier context.':'belongs to the changed suffix.'}`][s.stage],note:'Whole-position cache compatibility, across model layers. First-layer token-local K/V can stay numerically the same while deeper-layer states change. Reuse also requires matching model parameters, positions and relevant settings. Serving engines may reuse only complete blocks; fully cached prompts may still need boundary work for logits.'};
}
export function visualView(type,s,rows=representations,options={}){
 if(['projections','scores','values'].includes(type))return arithmetic(type,s,rows);
 if(type==='request')return request(s,rows,options);
 if(type==='heads')return heads(s);
 if(type==='sharing')return sharing(s,rows);
 if(type==='prediction')return prediction(s,rows);
 return dependencies(s,type);
}
const owners=new WeakMap();
export function disposeVisual(root){const cleanup=owners.get(root);owners.delete(root);cleanup?.();}
export function ownVisual(root,cleanup){owners.set(root,cleanup);}
export function sharedRows(){try{const rows=JSON.parse(localStorage.getItem('inference-course-v4'))?.embeddings;if(rows?.length===3&&rows.every(r=>r?.length===2&&r.every(x=>Number.isFinite(x)&&Math.abs(x)<=4)))return rows;}catch{/* Optional storage. */}return representations;}
export function mountLearningVisual(root,type,options={}){
 disposeVisual(root);
 let position=2;try{position=JSON.parse(localStorage.getItem('inference-course-v4'))?.attention?.position??2;}catch{/* Optional. */}
 if(['projections','scores','values'].includes(type)){
  const cleanup=mountStudio(root,type,{...options,position, getRows:()=>options.rows||sharedRows(),onPosition:value=>{
   options.onPosition?.(value);
   try{const saved=JSON.parse(localStorage.getItem('inference-course-v4'))||{};saved.attention={position:value};localStorage.setItem('inference-course-v4',JSON.stringify(saved));}catch{/* Optional storage. */}
  }});
  owners.set(root,cleanup);return cleanup;
 }
 let s={stage:options.stage??0,position:[0,1,2].includes(position)?position:2,component:0,role:'Q',key:2,pass:options.pass??0,query:(options.prompt||promptTokens).length-1,kvHeads:2,head:0,candidate:0,inspect:false,change:type==='validity'?-1:2};
 let timer=null,disposed=false;
 const stop=()=>{if(timer)clearInterval(timer);timer=null;};
 owners.set(root,()=>{disposed=true;stop();window.removeEventListener('storage',storage);});
 function rows(){return options.rows||sharedRows();}
 function render(focus){
  const previous=flowSnapshot(root);
  const view=visualView(type,s,rows(),options);
  const scope=['projections','scores','values'].includes(type)?`Prefill · layer 1 · head 1 · ${promptTokens[s.position]}`:type==='sharing'?'Prefill · layer 1 · is':type==='prediction'?'Prefill · is · two-layer numeric toy':type==='heads'?'One position · two-head schematic':type==='request'?`${s.pass===0?'Prefill':`Decode ${s.pass}`} · layer 1 · head 1`:'Compatible requests · token-level reuse';
  root.classList.add('teaching-visual');root.classList.toggle('is-playing',!!timer);
  root.innerHTML=`<div class="route-toolbar">${view.controls}${view.max?`<div class="visual-actions"><button type="button" data-command="reset" aria-label="Reset diagram">↺</button><button type="button" data-command="back" ${s.stage===0?'disabled':''}>← Previous</button><button type="button" data-command="play">${timer?'Pause':'Play'}</button><button type="button" data-command="next" ${s.stage===view.max&&!(type==='request'&&s.pass<(options.answer||['blue','today','.']).length-1)?'disabled':''}>${s.stage===view.max&&type==='request'?'Next pass →':'Next →'}</button></div>`:''}</div><div class="route-stage"><span>${scope} — ${view.title||({projections:'Complete Q/K/V projections',scores:'Query → scores → weights',values:'Whole value vectors',heads:'Split and join head results',sharing:'Shared K/V, separate queries',prediction:'Vector → vocabulary',validity:'Cache validity',prefix:'Prefix reuse'}[type])}</span>${view.max?`<span>${s.stage+1} / ${view.max+1}</span>`:''}</div>${view.equation?`<p class="route-formula">${symbols(view.equation).replaceAll('tspan','span')}</p>`:''}${view.graph}${s.inspect&&['projections','scores','values'].includes(type)?'<button type="button" data-command="overview">Close detail</button>':''}<p class="visual-caption" role="status">${escape(view.caption)}</p>${view.note?`<details class="visual-assumptions"><summary>Toy assumptions</summary><p>${escape(view.note)}</p></details>`:''}`;
  renderVisualMath(root, type);
  root.querySelectorAll('[data-field]').forEach(control=>control.onchange=()=>{
   stop();const field=control.dataset.field;s[field]=field==='role'?control.value:Number(control.value);
   if(['pass','change'].includes(field))s.stage=0;
   if(field==='position')s.inspect=false;
   if(field==='position')options.onPosition?.(s.position);
   if(field==='position')try{const saved=JSON.parse(localStorage.getItem('inference-course-v4'))||{};saved.attention={position:s.position};localStorage.setItem('inference-course-v4',JSON.stringify(saved));}catch{/* Optional. */}
   render(`[data-field="${field}"]`);
  });
  root.querySelectorAll('[data-command]').forEach(button=>button.onclick=()=>{
   const command=button.dataset.command;
   if(command==='play'){
    if(timer)stop();else{if(s.stage===view.max)s.stage=0;timer=setInterval(()=>{if(disposed||!root.isConnected||!root.getClientRects().length){stop();return;}if(s.stage>=visualView(type,s,rows(),options).max){stop();render();return;}s.stage++;render();},1600);}
   }else{stop();if(command==='overview')s.inspect=false;if(command==='reset'){s.stage=0;s.inspect=false;}if(command==='back')s.stage=Math.max(0,s.stage-1);if(command==='next'){if(s.stage<view.max)s.stage++;else if(type==='request'){s.pass++;s.stage=0;}}}
   render(command==='overview'?`[data-pick="${type==='projections'?`projection:${s.role}:${s.component}`:type==='scores'?`key:${s.key}`:`component:${s.component}`}"]`:`[data-command="${command}"]`);
  });
  root.querySelectorAll('[data-pick]').forEach(target=>{
   const choose=()=>{stop();const [field,value,column]=target.dataset.pick.split(':');if(field==='projection'){s.role=value;s.component=Number(column);s.inspect=true;}else{s[field]=Number(value);if(field==='component'||field==='key')s.inspect=true;}render(`[data-pick="${target.dataset.pick}"]`);};
   target.onclick=choose;target.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose();}};
  });
  animateFlow(root,previous);
  options.onFrame?.({pass:s.pass,stage:s.stage});
  if(focus){const target=root.querySelector(focus);(target&&!target.disabled?target:root.querySelector('[data-command=back]:not(:disabled),[data-command=reset]'))?.focus({preventScroll:true});}
 }
 function storage(event){if(event.key==='inference-course-v4'&&root.isConnected){stop();render();}}
 window.addEventListener('storage',storage);render();
 return ()=>disposeVisual(root);
}
