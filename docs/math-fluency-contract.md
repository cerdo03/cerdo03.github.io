# Math fluency implementation contract

Baseline: f4b633132ab44fac7d81ab84ea19098901c22826. Baseline: 166 tests pass, lint passes. Buildless static site; no deployment authorized.

## Interfaces (frozen before parallel implementation)
- Route: labs/math-fluency/index.html and lesson-1.html through lesson-6.html. Module 0 / optional math toolkit. Body uses data-math-lesson="1" etc, NEVER data-lesson (reserved Module 2).
- Renderer: labs/llm-systems/math-renderer.js exports renderMath(element, tex, {displayMode=false,label,id}={}), renderMathIn(root=document). Trusted authored nodes use data-math="TeX" and optional data-display="true". Idempotent. Self-hosted pinned KaTeX; JS module imports vendor runtime or safely loads it, exports work in Node tests. CSS math.css imports vendor CSS. No runtime CDN. Generated output marked data-math-rendered. Never render visitor input.
- Explorer: equation-explorer.js exports mountEquationExplorers(root=document), automatically mounts authored [data-equation="ID"] placeholders; renders equation and purpose/key ALWAYS, disclosure Decode/Compute/Practice. Imports renderer. Curated IDs: softmax-stable, qkv-projection, attention-scores, masked-attention, weighted-values, kv-memory. Export equationDefinitions for tests. Use shared glossary, no glyph popovers. Practice engine math-exercises.js exports mountMathExercises(root=document), auto-mount authored [data-math-exercise="ID"]. IDs: notation, indices, shapes, softmax, transformer, capstone. Export pure numerical helpers and exercises as suitable. Scaffolds/help opt-in; no score/gate; blocked localStorage harmless.
- Curriculum: Module 0 pages load theme.css/theme.js, attention/styles.css for base layout if useful, course.css/course-shell.js, math.css/math-renderer.js and equation-explorer.js/math-exercises.js. Static lesson text and authored data-math nodes. Origin links via ?from=allowlisted-key only; C owns resolver in math-exercises.js, keys softmax, scores, values, kv, projections, masking; exact paths to valid Module 2 anchors, no arbitrary redirect. B adds [data-math-return] link defaulting attention/lesson-1.html#s2-1-5. C owns optional progress/reset UI through [data-math-progress] and [data-math-reset]. No typed answers persisted.
- CSS ownership: A math.css. C equation-explorer.css. B labs/math-fluency/styles.css. Semantic variables only. No assets/theme.css edits planned.
- Symbol help compatibility: D owns labs/attention/symbols.js exclusion of [data-math], .katex, math ancestors. Shared glossary remains source. C uses exported glossary functions after inspecting API.
- D integrates renderer/explorer imports into shared course-shell.js and adds CSS to relevant pages; preserve prior routes, anchors, simulations and enhancement replacements. Must test final rendered DOM (course enhancements may replace source equations).

## Ownership
A: math-renderer.js, math.css, assets/vendor/katex/**, tests/math-renderer.test.mjs; docs/math-renderer.md.
B: labs/math-fluency/**; docs/math-fluency-curriculum.md; tests/math-curriculum.test.mjs.
C: equation-explorer.js/.css, math-exercises.js, tests/math-explorer.test.mjs; docs/math-explorer.md.
D: course-shell.js, existing collection/attention/inference HTML/integration, symbols.js, assets/learning-catalog.js; tests/math-integration.test.mjs; docs/math-migration.md.
E: independent tests/math-audit.test.mjs; docs/math-qa.md; private screenshots outside public deployment paths.
Orchestrator: contract, integration, reviewed fixes, delivery report.

## Gates
B first builds lesson 0.1 only, then waits for orchestrator inspection. C first builds stable-softmax; A renderer. Orchestrator inspects representative browser slice before B completes remaining lessons. Then inspect stable-softmax lesson plus Module 2 integration before migration broadens. Write tests first where applicable; run lint before reporting, never silently repair new lint failures: report to orchestrator for owner approval. No push, main merge or deploy. Commit only scoped public files with repo no-reply identity; no private plan/memory content. Each agent isolated worktree; orchestrator cherry-picks reviewed commits sequentially.

## Integration refinements

D also owns course-context.js and math-integration.js; explicit hooks in inference/app.js and learning-visuals.js apply trusted formulas after deterministic mounts, without a mutation-observer rendering loop. Query propagation retains only known origin keys. C uses independent radio-group identities per mount. Orchestrator adds progress hosts to all lesson pages and reviews final copy. Node24 from the desktop runtime is used for final validation.
