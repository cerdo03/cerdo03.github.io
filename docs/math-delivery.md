# Mathematical fluency: delivery notes

## Architecture decisions

Module 0 is an optional collection member at `labs/math-fluency/`. Existing Module 1/2 routes and progression remain canonical. A pinned self-hosted KaTeX runtime supplies accessible HTML plus MathML; authored data attributes opt equations into rendering. The glossary remains authoritative for existing tensor symbols. Contextual explorers supplement, rather than replace, existing numerical diagrams. Deterministic local practice uses authored answers and reference rubrics, never remote grading or custom analytics.

New code uses buildless modules and collection-scoped semantic styles. Source content remains readable without successful typesetting. Origin navigation accepts only authored symbolic keys mapped to known same-site sections. Optional progress stores lesson identifiers only, under its own namespace; learner answers do not enter the repository.

## Implementation gates

Baseline `f4b633132ab44fac7d81ab84ea19098901c22826`: 166 tests pass; full lint passes. Renderer, curriculum, explorer, integration and independent QA roles use isolated branches under `.claude/worktrees/`; roles are staggered to fit available worker slots.

Representative 0.1 + stable-softmax slice inspected before lesson expansion: Chrome desktop1280 and phone320;13 KaTeX expressions and13 MathML trees, no fallback rendering, fonts loaded, no missing requests, console exceptions or document overflow. Equation purpose and variable key remain visible; explanations are optional. Notation exercise was aligned with declarations before replication.

Integration gate and final validation recorded below after implementation.

## Scope and limits

No runtime framework, account system, remote answer grading, analytics events or public learner history. No main merge, remote push or deployment is authorized by this implementation task. Browser checks establish observed behavior, not learner mastery or comprehensive screen-reader certification.

## Final delivery

Implemented six optional lessons: notation grammar; indices/reductions; dimensions/transpose; stable softmax; transformer/KV equations; equation writing and unfamiliar paper-style transfer. Six curated explorers expose an equation, purpose and shared notation key by default, with optional Decode / Compute / Practice. Activities include six-term index inspection, incompatible-shape feedback, actual ordinary/stable floating-point comparison, a three-stage shape chain and constrained equation composition.

The migration covers 23 authored Module 2 equation blocks, six contextual equation origins, selected Module 1 concepts and explicitly mounted dynamic operation identities. Existing paths, fragments, canonical inference files, progressive numerical reveal and simulation arithmetic remain intact. Module 0 is registered in the shared course shell and learning catalog; counts reflect the additional site. Local review/resume/reset stores only allowlisted lesson IDs. No exercise answers are persisted or transmitted.

The final stable-softmax lesson was inspected before acceptance: the maximum and worked probabilities stay concealed until requested. The compact stable formula fits a 320 px phone region; its maximum is defined in the visible key and preceding stage. Longer expressions remain locally scrollable with a visible cue and explicit keyboard focus only when necessary. Renderer measurements respond to font readiness, resizing, section changes and disclosures without re-typesetting or retaining discarded frames.

### Routes

- `/labs/math-fluency/` and `/labs/math-fluency/lesson-1.html` through `lesson-6.html` are new.
- Collection `/labs/llm-systems/`, Module 1 `/labs/inference/`, and all existing `/labs/attention/` routes are updated in place.
- A known `?from=softmax`, `scores`, `values`, `kv`, `projections` or `masking` key preserves an exact allowlisted return section. Arbitrary redirect URLs are rejected.

### Verification

Node 24.19.0:

- `npm test`: **209 passed, 0 failed**.
- `npm run lint`: **passed** (HTML, CSS, JavaScript).
- `git diff --check`: **passed**.
- Chrome/Playwright: **224 route/theme/viewport/CSS-zoom/reduced-motion cases + 960 concept cases**; no page overflow, KaTeX error, glossary mutation inside generated math, missing asset or page exception in the checked matrix.
- All six practice flows tested with incorrect/correct answers and hints, plus index terms, invalid shapes, large-score stability, transformer shape chain and equation composition. Keyboard activation, independent radio groups, review/resume/reset, blocked storage and JavaScript-disabled source fallbacks passed.
- Local long-equation scrolling was checked with Tab and ArrowRight. Final phone/desktop screenshots cover paper, midnight and contrast. Softmax odds, exact mask zeros, tensor shapes and 536,870,912 bytes = 512 MiB were independently checked.
- Deployment preparation was exercised locally: pinned renderer/fonts remain within the existing allowlist, imports are versioned, exactly one default page-view beacon is injected, and private files/tests/docs are excluded. This does not publish anything.

Independent evidence and limitations are recorded in `math-qa.md`. Final renderer refinements were then rechecked with the same browser matrices and activity suite. Actual screen-reader speech, physical touch devices, browser/OS zoom, Safari/Firefox and learner comprehension were not assessed; CSS zoom is only a layout approximation. No blocking defect remains in the completed checks.

### Review artifact

All changes are local on `feat/math-fluency`; main is untouched. The implementation contract, ownership map, curriculum design cards, renderer provenance, explorer API, migration inventory and independent QA report are included under `docs/`. The private handoff folder contains a full changed-file manifest, portable binary patch, test logs and screenshots. No push, main merge or deployment occurred.
