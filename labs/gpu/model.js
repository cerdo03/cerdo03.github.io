// Analytical teaching models. No device execution or measured timing.
export function launchModel(items, threads, registers, sharedKiB) {
  const blocks = Math.ceil(items / threads);
  const limits = { threads: Math.floor(2048 / threads), registers: Math.floor(65536 / (threads * registers)), shared: Math.floor(64 / sharedKiB), blocks: 8 };
  const residentBlocks = Math.min(...Object.values(limits));
  return { blocks, warps: threads / 32, tailLanes: Math.max(0, Math.min(32, items - (blocks * threads - 32))), residentBlocks, limits, occupancy: residentBlocks * threads / 2048 };
}
export function sectorModel(stride, offset) {
  const addresses = Array.from({length:32}, (_,lane) => offset + lane * stride * 4);
  const sectors = [...new Set(addresses.map(address => Math.floor(address / 32)))];
  return { addresses, sectors, bytes: sectors.length * 32, usefulBytes: 128 };
}
export function multiply(left, right) {
  return left.map(row => right[0].map((_,j) => row.reduce((sum,value,p) => sum + value * right[p][j],0)));
}
export const toyLeft = [[1,2,0,1],[0,1,2,1],[2,0,1,1],[1,1,1,1]];
export const toyRight = [[1,0,2,1],[0,1,1,2],[2,1,0,1],[1,2,1,0]];
export function tileTraffic(rows, columns, reduction, tile, elementBytes) {
  // Every output tile loads its input rows/weight columns over the full reduction.
  const loads = rows * reduction * Math.ceil(columns / tile) + reduction * columns * Math.ceil(rows / tile);
  return { flops: 2 * rows * columns * reduction, bytes: elementBytes * (loads + rows * columns), loads, sharedBytes: 2 * tile * tile * elementBytes };
}
export function roofline(flops, bytes, tflops, tbps) {
  const computeMs = flops / (tflops * 1e12) * 1000, memoryMs = bytes / (tbps * 1e12) * 1000;
  const intensity = flops / bytes, ridge = tflops / tbps;
  return { intensity, ridge, computeMs, memoryMs, timeMs: Math.max(computeMs,memoryMs), bound: intensity < ridge ? 'bandwidth' : intensity > ridge ? 'compute' : 'balanced', ceilingTF: Math.min(tflops,tbps * intensity) };
}
export function projection(rows, inputWidth, outputWidth, elementBytes) {
  return { flops: 2 * rows * inputWidth * outputWidth, bytes: elementBytes * (rows * inputWidth + inputWidth * outputWidth + rows * outputWidth) };
}
export function decodeAttention(batch, context, queryHeads, kvHeads, width, elementBytes) {
  // One layer. Two dot-product-like operations: QK and attention-weighted V.
  return { flops: 4 * batch * context * queryHeads * width, kvBytes: 2 * batch * context * kvHeads * width * elementBytes, appendBytes: 2 * batch * kvHeads * width * elementBytes };
}
