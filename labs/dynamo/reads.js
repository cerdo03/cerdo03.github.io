// Scalar version ranks model an ancestry chain only; siblings require vector clocks.
export function readTrace(replies, required, deadline, postResponseWait = 5) {
  if(!Number.isInteger(required) || required<1 || !Number.isFinite(deadline) || deadline<0 || postResponseWait<0) throw new RangeError('Read needs a positive integer threshold and nonnegative time bounds');
  const unique=new Map();
  for(const reply of [...replies].sort((a,b)=>a.time-b.time)) if(!unique.has(reply.node))unique.set(reply.node,reply);
  const ordered=[...unique.values()];
  const timely=ordered.filter(reply=>reply.time<=deadline);
  const responseTime=timely.length>=required ? timely[required-1].time : null;
  const cutoff=responseTime===null?deadline:responseTime+postResponseWait;
  const observed=ordered.filter(reply=>reply.time<=cutoff);
  const latest=observed.length?Math.max(...observed.map(reply=>reply.version)):null;
  const observedAt=observed.find(reply=>reply.version===latest)?.time ?? 0;
  const repairs=responseTime===null ? [] : observed.filter(reply=>reply.version<latest)
    .map(reply=>({node:reply.node,time:Math.max(responseTime,reply.time,observedAt),version:latest}));
  return {responseTime,repairs,latest,cutoff,observed};
}
export function percentile(samples, fraction) {
  const ordered=[...samples].sort((a,b)=>a-b);
  if(!ordered.length || fraction<=0 || fraction>1) throw new RangeError('Percentile requires samples and fraction in (0,1]');
  return ordered[Math.ceil(fraction*ordered.length)-1];
}
