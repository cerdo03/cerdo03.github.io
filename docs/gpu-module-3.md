# Module 3: GPU Architecture and Performance Engineering

Module 3 bridges attention equations to testable inference-performance hypotheses. It adds five short lessons at `labs/gpu/`, reuses the existing course shell and global themes, and requires only a browser. It runs no GPU kernel, pretrained model, benchmark or remote service.

## Reading sequence

1. **GPU execution:** output independence, grid/block/warp/lane mapping, guarded tails, resource-limited residency and dependencies.
2. **Memory and movement:** registers, shared memory, L1/L2 and device DRAM; software KV cache versus hardware cache; sector demand, alignment and synchronization.
3. **Matrix multiplication and tiling:** exact scalar products, dimension-to-loop mapping, tile reuse, logical load counts, storage trade-offs and motivation for IO-aware attention.
4. **Arithmetic intensity and roofline:** work/bytes, boundary-specific intensity, resource-time bounds, ridge point, hypothetical ceilings and falsifiable predictions.
5. **Prefill, decode and evidence:** projection row reuse, phase counterexamples, causal attention pair counts, one-layer decode KV reads and a measurement handoff.

Each lesson has three concepts. The shared shell shows one at a time; derivations remain in expandable details. Guided operations reveal results progressively with Previous, Next, Show all and Reset. Controls explain their consequences; checks provide feedback without gating navigation. No animations are required. Static worked examples remain when scripts are disabled.

## Model contracts

`labs/gpu/model.js` contains pure, independently tested arithmetic shared by the controls and charts.

- **Execution:** NVIDIA/CUDA terminology and 32-thread warps. One logical thread per flattened output illustrates indexing, not an optimized GEMM. Entirely guarded final warps are possible. Block placement/order are unspecified.
- **Residency:** invented SM limits: 2,048 threads, 65,536 32-bit registers, 64 KiB shared memory, eight blocks. Minimum resource limit sets an upper bound. No allocation granularity, real device specification, schedule, spilling or utilization prediction.
- **Sector demand:** 32 lanes load distinct four-byte values. Count distinct aligned 32-byte sectors, ignoring caches. Sector bytes are not a measured HBM transaction count.
- **Exact toy arithmetic:** invented 4×4 matrices, separate from previous lessons' embeddings. Conventional multiply-add accounting counts two FLOPs, including an accumulator initialized at zero.
- **Tiling:** logical input-load demand plus one output store per element, no old-output read. Square single-buffered tiles use `2 × tile² × element_bytes` shared storage. Edge demand counts only valid elements; UI uses divisible 4×4 examples. Does not model caching, padding, spills, synchronization time or shared/register traffic.
- **Roofline/projection:** `F=2×rows×input_width×output_width`; optimistic cold-data DRAM bytes are one read of inputs and weights plus one output write. Each device ceiling is explicitly hypothetical. Decimal tera units. `max(F/P, bytes/BW)` is a time lower bound; a point on the plotted roof is an ideal upper throughput, never a measurement. Match precision and dense/sparse instruction accounting before using real ceilings.
- **Decode attention:** one layer, equal visible context lengths, current consumed position included, perfect reuse across grouped queries. FLOPs include QK and weighted V only. Read payload includes KV only; append payload is separate. Excludes queries/output, softmax, scales/metadata, workspace, allocator and redundant/cache-dependent traffic. Displayed intensity is optimistic KV-read-only intensity, not complete attention intensity or token latency.
- **Phases:** projection rows come from actual processed token rows; phase names alone do not classify bottlenecks. Full causal prefill allowed-pair count differs from executed masked math. Chunked/ragged/speculative workloads require their actual shapes.

Primary sources are linked in the overview. Claims are scoped to the selected operation and memory boundary. CPU/Mac learners can derive counts and verify scalar correctness; they must leave NVIDIA performance unmeasured until a real run exists.

## Integration and privacy

The existing `course-shell.js` registers the Module 3 hierarchy and identifies GPU pages by their own dataset, preserving older module datasets and routes. Navigation disclosures, concept stepping, Previous/Next, theme switch, symbol help and layout remain shared. No framework, dashboard or global layout redesign is introduced.

`learning-catalog.js` registers the module. The collection and homepage show five local sites; these edits become public only after an authorized deployment. Existing Module 0–2 lesson files are unchanged. GPU glossary additions are scoped to GPU pages to avoid reinterpreting symbols elsewhere. Private learner notes and engineering-verification artifacts belong outside this public repository.

## Local preview and verification

From this checkout, use Node 24 or later for development tools:

```sh
npm ci
npm test
npm run lint
node scripts/qa-gpu.mjs
python3 -m http.server 4194 --bind 127.0.0.1
```

Open `http://127.0.0.1:4194/labs/gpu/` or start at `/labs/gpu/lesson-1.html`.

Browser QA requires Playwright and installed Google Chrome. It checks 320/390/820/1440 widths in Paper/Midnight/Contrast, every concept with expanded details, calculation changes, progressive reveal, matrix selection/focus, keyboard symbol help/Escape, paging, older module navigation and no-JavaScript fallback. Screenshots and JSON default to `/tmp/gpu-qa`. Override `QA_OUTPUT` to retain evidence elsewhere.

For deployment-equivalent local verification:

```sh
node scripts/prepare-site.mjs /tmp/gpu-site-review module3-review
QA_SITE_ROOT=/tmp/gpu-site-review QA_OUTPUT=/tmp/gpu-prepared-qa node scripts/qa-gpu.mjs
```

That only prepares and serves local files. Analytics are blocked during QA. It does not push, merge or deploy.

## Deliberate gaps

No full CUDA kernel authoring, real GPU profile or measured speedup; no tensor-core fragment layout, bank-conflict simulator, complete FlashAttention derivation, full-model latency estimator, PagedAttention allocator or serving scheduler. Hardware access and subsequent exercises should test the hypotheses developed here. Automated accessibility and emulated widths cannot establish physical-touch or screen-reader speech quality; Safari/Firefox are not covered by this Chrome script.
