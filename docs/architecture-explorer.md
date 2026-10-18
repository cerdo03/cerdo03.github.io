# Transformer Architecture Explorer

Route: `/labs/attention/architecture-explorer/`.

A buildless, self-contained 3D companion to attention lessons 2.1–2.3. The
homepage remains the journal; its only change is the collection's site count.
The attention overview, lessons 2.2/2.3, collection and shared module hierarchy
link to the explorer. Residual/normalization/FFN and KV memory are explicitly
optional previews, with return links to the course.

## Preview and checks

Use Node 24 or newer. From the repository checkout:

```sh
npm ci --ignore-scripts
npm run preview:architecture
```

Open `http://127.0.0.1:4192/labs/attention/architecture-explorer/`.
Stop the server with Ctrl+C. Choose another port if 4192 is already occupied.
Python 3 serves the unchanged static source; there is no frontend build step.

```sh
npm test
npm run lint
npx playwright install chromium
npm run test:architecture:browser
```

The browser check starts/stops its own loopback static server. It uses a real
headless browser with software WebGL, not a mocked renderer. Optional environment
variables: `QA_BROWSER_CHANNEL=chrome` to use installed Chrome;
`QA_OUTPUT=/absolute/path` for screenshots/report; `QA_SITE_ROOT=/absolute/path`
for a prepared Pages artifact. Default output is `/tmp/architecture-qa`.

To test the same versioned artifact GitHub Pages receives:

```sh
node scripts/prepare-site.mjs /tmp/architecture-pages-preview architecture-review
QA_SITE_ROOT=/tmp/architecture-pages-preview npm run test:architecture:browser
```

This prepares and tests local files only. Main pushes auto-deploy the site;
review and obtain owner approval before any push or deployment.

## Interaction

- Use **Expand explorer** for a browser-page view containing the same model controls,
  3D scene and selected-component explanation. Exit or Escape restores the normal
  course layout, scroll position and keyboard focus. Settings fold on narrow screens;
  component controls join the inspector in expanded mode. No second canvas or
  independent model state is created.
- Open either decoder block, then attention, Q/K/V projections or head sharing.
  Breadcrumbs and Zoom out return through the hierarchy. FFN opens a separate
  optional view. All components also have native HTML buttons.
- Pointer/touch can orbit and zoom the scene. Focus the canvas and use arrows,
  +/− and Home for equivalent camera controls. Dragging does not activate nodes.
- Head count, head width, layout and token count share one configuration across
  scene, inspector and cache comparison. GQA only offers valid intermediate
  divisors; MHA fixes KV count to query count, MQA to one.
- Select a token position to inspect its causal context; select a query head to
  see exactly which KV group it reads. Indices are zero-based. In dense phone
  layouts the scene grows vertically and uses compact Qn/KVn labels; complete
  mappings remain in HTML controls and inspector text.
- Inspectors describe each operation and its shapes. Symbol help reuses the
  collection glossary, supporting hover, focus, tap and Escape.
- Drill-down places child geometry inside and behind the selected block, keeping
  its world-space anchor. One continuous logarithmic dolly carries the camera
  through the entry plane; the surrounding model fades during approach. Back
  returns to the remembered enclosing space. This is a spatial teaching device,
  not a claim about physical tensor placement.
- The renderer runs on demand, without idle animation. Camera transitions honor
  reduced motion; controls and explanations remain available if WebGL or the
  graphics module is unavailable. JavaScript-disabled readers retain a static
  architecture description and lesson links.

## Mathematical contract

One sequence, two independent decoder layers; no batch axis. This is a
GPT-style **pre-norm causal decoder**, not the original encoder-decoder design:

1. Token embeddings + learned position embeddings.
2. Each block computes `u = x + attention(LayerNorm(x))`, then
   `y = u + FFN(LayerNorm(u))`.
3. FFN: Linear → GELU → Linear, with hidden width 4× model width.
4. After block 2: final LayerNorm → vocabulary projection → logits. Softmax
   gives a next-token distribution; the schematic samples no token.

Every position keeps one current vector. Each layer computes its own Q/K/V
from its normalized inputs. All heads receive the entire input vector; splitting
happens after learned projection. Each query head has its own query projection.
A KV group has one key matrix and one value matrix, shared by its query heads.
The page shows a different architecture when switching MHA/GQA/MQA; it does not
claim to convert a checkpoint losslessly at runtime.

For query count Hq, KV count Hkv and head width D:

- Model width = Hq × D in this schematic. Changing Hq or D changes model width.
- Q logical shape: [tokens, Hq, D]; K and V each: [tokens, Hkv, D].
- Query head i reads KV head floor(i / (Hq/Hkv)). Divisibility is required.
- At position p, a query reads positions 0…p, including itself. Its row score
  shape is [1, p+1], values [p+1, D], head result [1, D]. The full per-head causal
  score matrix would be [tokens, tokens]. No dense score matrix is allocated.
- Concatenating Hq head results gives [tokens, model width], independent of Hkv;
  the learned output projection preserves model width for residual addition.
- Raw KV payload = 2 × layers × tokens × Hkv × D × bytes per element.
  Fixed: two layers, two bytes/element, one sequence. Queries and attention
  outputs are not cached. The inspector position does not shrink full-sequence
  cache accounting. Comparison GQA uses Hq/4 KV heads, except Hq=4 uses two to
  preserve an intermediate GQA configuration.

Example: 32 Q heads, 8 KV heads, D=128, 2048 tokens → groups of four queries,
16,777,216 bytes (16 MiB), one quarter of equivalent MHA raw KV payload.

Connections show dependencies, not measured attention strengths or GPU
scheduling. Q→KV edges mean “reads”; they are distinct from the overview's
representation-flow arrows. No numerical learned weights, output tokens,
latencies or throughput are fabricated. Token names “The sky is” identify the
first three schematic positions, not an actual tokenizer's result. Other
positions have no assigned text. Prefill/decode animation is deliberately omitted;
the view makes no claims about partially processed caches or GPU execution.

The model combines a GPT-style pre-norm layout with generalized head sharing.
It represents no specific pretrained checkpoint. Other models may use rotary
positions, RMSNorm or gated FFNs. Sources are linked in the page, including
OpenAI's GPT-2 implementation and the MQA/GQA papers.

## Files and ownership

- `model.js`: pure scene topology, explanations and shape/configuration helpers.
  Imports the existing Module 2 `gqaMapping` and `kvBytes` implementations.
- `app.js`: semantic HTML controls, shared model state, inspection and navigation;
  initializes independently of the lazily loaded renderer.
- `focus.js`: native modal page expansion, shared controls/tooltips/theme button,
  Escape/Exit, scroll and focus restoration.
- `spatial.js`: pure nested-space geometry and monotonic, reversible camera path.
- `scene.js`: Three.js rendering, picking, camera transitions, resizing, theme
  updates and disposal. CPU geometry count scales with head count, not context
  length. No requestAnimationFrame loop while idle.
- `index.html` / `explorer.css`: accessible fallback, layout and theme-token
  styling. No custom palette or remote runtime scripts.
- `vendor/`: pinned Three.js 0.186.1 renderer/core/OrbitControls, MIT license and
  provenance. See its README before updating all files together.
- Shared `course-shell.js`: module-relative URL resolution supports nested
  companion pages and preserves math-toolkit query strings.
- `tests/architecture-explorer.test.mjs`: math/topology/configuration/integration
  and deployment-chain tests. Existing catalog-count tests reflect four sites.
- `scripts/qa-architecture.mjs`: real-browser responsive/interaction/fallback QA.
- `package.json` / lock: pinned development-only Playwright; lint includes nested
  HTML. ESLint excludes upstream vendor source, retaining all authored checks.

The existing Pages script copies only allowlisted public files, versions local
CSS/JS and transitive imports (including Three core and controls), rejects
symlinks, and injects exactly one existing basic analytics beacon per page.
Source previews contain no beacon. No publishing workflow has been changed.

## Verification boundaries

Browser checks cover 320/390/768/1280/1600px, paper/midnight/contrast, all six
views, dense phone labels, keyboard and canvas selection, both blocks, layouts,
causal positions, exact memory, navigation query preservation, symbol help,
reduced motion, three-level nested camera traversal, expanded mode across five
widths and three themes, focus containment/restoration, interrupted transitions
(including reset, keyboard and orbit), renderer failure, disabled WebGL,
JavaScript-disabled content and blocked storage. They run against actual source
and can run against the prepared Pages bundle.

These checks do not establish real GPU performance, physical-device touch
behavior, screen-reader speech, or Safari/Firefox compatibility. Inspect the
local screenshots and try your target device before publication. Dependency
updates are separate work; existing Stylelint dependency advisories were not
changed by this feature.
