import {chromium} from 'playwright';import assert from 'node:assert/strict';
const b=await chromium.launch({channel:'chrome'});
try{const p=await b.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});for(const chapter of ['online','tiles','cow']){await p.goto(`http://127.0.0.1:4216/labs/efficient-attention/motion.html#${chapter}`);await p.waitForSelector('[data-scene]');while(await p.locator('[data-next]').isEnabled()){
 await p.locator('[data-next]').click();const op=await p.locator('[data-scene]').getAttribute('data-operation');
 const target=chapter==='cow'?p.locator('.ea-pending').first():p.locator('[data-scene] .ea-active').last();
 if(await target.count()){const box=await target.boundingBox();assert.ok(box.y>=45&&box.y+box.height<=844,`${chapter}/${op}: changed state offscreen ${JSON.stringify(box)}`);}
}if(chapter==='cow')assert.equal(await p.locator('.ea-pool .ea-block').count(),2,'free blocks summarized, mapped blocks inspectable');}console.log('PASS phone primary actions keep changed state in view; free pool summarized');}finally{await b.close();}
