# Equation Explorer and practice

## Authored components

Load `equation-explorer.css`, `math.css` and the shared JS modules. An authored `data-equation="ID"` placeholder retains readable fallback text before JavaScript runs. Recognized placeholders replace that fallback with a visible equation, purpose and notation key. One native **Understand this equation** disclosure contains optional Decode, Compute and Practice. Equation keys use the existing shared glossary for common symbols. Context-dependent indices are defined locally; no second tooltip system is created.

The six stable IDs are `softmax-stable`, `qkv-projection`, `attention-scores`, `masked-attention`, `weighted-values` and `kv-memory`. `equationDefinitions` and `computeExample` are exported. Toolkit links select the relevant lesson and an allowlisted return-context key. All worked numbers are explicitly illustrative; the projection/value examples reuse pure `projectionTrace` / `valueTrace` from `visual-model.js` without changing its course model.

`mountEquationExplorers(root)` and `mountMathExercises(root)` accept a document or subtree, auto-mount authored nodes and are idempotent. Multiple independently mounted exercise groups have unique radio names. No arbitrary visitor TeX, free-text grading or general parser is accepted.

## Practice and interaction design

Use `data-math-exercise="ID"` for `notation`, `indices`, `shapes`, `softmax`, `transformer` or `capstone`. Each has an unaided deterministic check, explanatory feedback, two opt-in hints and an ungated explanation. No scores or navigation gates appear.

| Task | Prediction and state | Computed evidence | Transfer |
| --- | --- | --- | --- |
| Notation | Identify a shape/type declaration | Explain 3 × 4 axes and 12 unspecified entries | Distinguish declarations from computations |
| Indices | Select fixed i,j; predict six products | Row/column selections regenerate paired terms and scalar sum | Identify free/bound indices without the table |
| Shapes | Choose original or transposed K | Derive output axes or explain incompatible inner dimensions | Derive QKᵀ shape independently |
| Softmax | Predict maximum and shifted-row behavior before reveal | Compare finite ordinary/stable results with large-logit overflow | Explain j/k/m and real-number equivalence versus floating point |
| Transformer | Choose three intermediate shapes | Check projection, score, and value dimensions separately | Parse value mixing from dimensions |
| Capstone | Compose indexed equation from a loop using constrained authored terms | Validate output index, bound index and both factors | Self-check equivalent matrix notation; solve unfamiliar-symbol shape problem |

The index inspector uses a separately labeled general matrix A, not normalized attention weights: rows [1,2,3,4,5,6] and [6,5,4,3,2,1]. V rows are [1,2], [2,1], [1,0], [0,1], [2,2], [1,3]. The softmax comparison uses [4,8,2,6] and that row plus 1000. Its initial maximum is concealed until reveal. Controls and explanations use the same state.

## Numerical and privacy contracts

Pure exports include `stableSoftmax`, `dot`, `matmulShape`, `transposeShape`, `indexedTerms`, `rawKvBytes`, `toMiB`, `evaluateChoice` and `resolveReturnLink`. Computation retains precision; display alone rounds. Masked −∞ entries become exact zeros, an all-masked row rejects, and finite tiny weights remain positive unless floating-point underflow occurs. Long arrays use a loop for maximum rather than spread. Raw storage `2×32×4096×8×128×2` gives 536,870,912 bytes = 512 MiB, excluding runtime overhead.

`data-math-return` accepts only `softmax`, `scores`, `values`, `kv`, `projections` and `masking`. Unknown input uses the safe softmax route. No arbitrary redirect is supported.

Optional `data-math-progress` displays review status and a **Mark this lesson reviewed** button on lesson pages; `data-math-reset` clears it. Only strings `1` through `6` are stored in `llm-math-progress:v1`; `llm-math-resume:v1` keeps the last visited lesson ID. The overview offers a local Resume link when a valid ID exists. Reset clears both namespaces. No answers, notes, scores or analytics are stored or sent. Storage-disabled browsers retain full functionality; their review status may last only for the current interaction.

## Verification

`node --test tests/math-explorer.test.mjs` covers normal/large logits, shift invariance, long rows, invalid/all-masked rows, mask zeros, tiny weights, shape rules, six-term indices, raw storage, all six deterministic checks, allowlisted returns, blocked/malformed storage, independent radio groups and curated TeX/MathML. Browser integration, responsive/theme and keyboard checks belong to the integration audit.
