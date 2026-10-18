import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const load = () => import('../labs/attention/architecture-explorer/model.js');
test('32 query / 8 KV mapping shares exactly four queries, keeps independent outputs', async () => {
  const { configuration } = await load();
  const c = configuration({qHeads:32, kvHeads:8, headDim:128, tokens:2048});
  assert.deepEqual(c.mapping.groups[7], [28,29,30,31]);
  assert.deepEqual(c.shapes.q, [2048,32,128]);
  assert.deepEqual(c.shapes.kv, [2048,8,128]);
  assert.deepEqual(c.shapes.joined, [2048,4096]);
  assert.equal(c.bytes, 16777216);
  assert.equal(c.bytes / c.mhaBytes, .25);
});
test('all offered configurations have exact mappings, safe memory and invariant output width', async () => {
  const { configuration, OPTIONS } = await load();
  for (const qHeads of OPTIONS.qHeads) for (const kvHeads of OPTIONS.kvHeads(qHeads)) {
    for (const headDim of OPTIONS.headDim) for (const tokens of OPTIONS.tokens) {
      const c = configuration({qHeads,kvHeads,headDim,tokens});
      assert.equal(c.mapping.mapping.length,qHeads);
      assert.equal(c.mapping.groups.flat().length,qHeads);
      assert.deepEqual(c.shapes.output,[tokens,qHeads*headDim]);
      assert.equal(c.bytes,2*2*tokens*kvHeads*headDim*2);
      assert.equal(c.mapping.kind,kvHeads===qHeads?'MHA':kvHeads===1?'MQA':'GQA');
    }
  }
});
test('invalid and unbounded model inputs rejected', async () => {
  const { configuration } = await load();
  for (const change of [{qHeads:0},{kvHeads:3},{headDim:NaN},{tokens:Infinity},{tokens:0},{qHeads:64}]) {
    assert.throws(()=>configuration(change));
  }
});
test('attention shapes and causal row agree with selected token; no numerical weights invented', async () => {
  const { configuration, inspect } = await load();
  const c = configuration({qHeads:8,kvHeads:2,tokens:8,headDim:64});
  const a = inspect(c,'head-5',2);
  assert.match(a.body,/KV head 1/);
  assert.match(a.body,/0 through 2/);
  assert.match(a.formula,/softmax/);
  assert.deepEqual(a.shapes, [['Query row',[1,64]],['Allowed K and V, each',[3,64]],['Score / weight row',[1,3]],['Head result',[1,64]]]);
  assert.throws(()=>inspect(c,'head-8',2));
  assert.throws(()=>inspect(c,'head-0',8));
});
test('pre-norm block order and residual edges preserve input bypasses', async () => {
  const { configuration, sceneModel } = await load();
  const graph = sceneModel('block', configuration(), 1);
  assert.deepEqual(graph.nodes.map(n=>n.id),['input','norm1','attention','add1','norm2','ffn','add2','output']);
  assert.ok(graph.edges.some(e=>e.from==='input'&&e.to==='add1'&&e.residual));
  assert.ok(graph.edges.some(e=>e.from==='add1'&&e.to==='add2'&&e.residual));
  for (const view of ['overview','block','attention','heads','qkv','ffn']) {
    const g = sceneModel(view, configuration(), 0);
    const ids = new Set(g.nodes.map(n=>n.id));
    assert.equal(ids.size,g.nodes.length);
    assert.ok(g.edges.every(e=>ids.has(e.from)&&ids.has(e.to)));
  }
});
test('head graph renders each query once and shared K/V once per group', async () => {
  const { configuration, sceneModel } = await load();
  for (const kvHeads of [8,2,1]) {
    const graph=sceneModel('heads',configuration({kvHeads}),0);
    assert.equal(graph.nodes.filter(n=>n.id.startsWith('head-')).length,8);
    assert.equal(graph.nodes.filter(n=>n.id.startsWith('kv-')).length,kvHeads);
    assert.equal(graph.edges.length,8);
    assert.ok(graph.edges.every(e=>e.label==='reads shared K/V'));
  }
});
test('explorer integrated without replacing homepage, nested assets and explicit optional scope', () => {
  const page=readFileSync('labs/attention/architecture-explorer/index.html','utf8');
  assert.match(page,/\.\.\/\.\.\/\.\.\/assets\/theme.css/);
  assert.match(page,/\.\.\/\.\.\/llm-systems\/course-shell.js/);
  assert.match(page,/Optional/);
  assert.match(page,/<noscript>/);
  for (const path of ['labs/attention/index.html','labs/attention/lesson-2.html','labs/attention/lesson-3.html']) {
    assert.match(readFileSync(path,'utf8'),/architecture-explorer\//);
  }
  const shell=readFileSync('labs/llm-systems/course-shell.js','utf8');
  assert.match(shell,/architecture-explorer/);
  assert.match(shell,/moduleBase/);
});
test('GQA comparison remains intermediate even at smallest query count', async () => {
  const {configuration,memoryComparison}=await load();
  const rows=memoryComparison(configuration({qHeads:4,kvHeads:2}));
  assert.deepEqual(rows.map(r=>r.kvHeads),[4,2,1]);
});
test('nested page and local Three dependency chain survive Pages preparation', async () => {
  const {mkdtempSync,rmSync,existsSync}=await import('node:fs');
  const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {spawnSync}=await import('node:child_process');
  const out=mkdtempSync(join(tmpdir(),'architecture-pages-'));
  try {
    const result=spawnSync(process.execPath,['scripts/prepare-site.mjs',out,'architecture-test'],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const dir=join(out,'labs/attention/architecture-explorer');
    assert.match(readFileSync(join(dir,'index.html'),'utf8'),/app.js\?v=architecture-test/);
    assert.match(readFileSync(join(dir,'scene.js'),'utf8'),/three.module.js\?v=architecture-test/);
    assert.match(readFileSync(join(dir,'vendor/three.module.js'),'utf8'),/three.core.js\?v=architecture-test/);
    assert.match(readFileSync(join(dir,'vendor/OrbitControls.js'),'utf8'),/three.module.js\?v=architecture-test/);
    assert.equal((readFileSync(join(dir,'index.html'),'utf8').match(/data-goatcounter=/g)||[]).length,1);
    assert.ok(existsSync(join(dir,'vendor/LICENSE')));
    for(const path of ['AGENTS.md','tests','node_modules','GROWTH_TRACKER.md'])assert.equal(existsSync(join(out,path)),false);
  }finally{rmSync(out,{recursive:true,force:true});}
});
