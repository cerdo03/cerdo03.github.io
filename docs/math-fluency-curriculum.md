# Optional mathematical notation toolkit

Module 0 teaches symbolic reading alongside the existing mechanisms. It does not insert a prerequisite or change the Module 1 → Module 2 route. Static lesson text, worked examples and reference explanations remain usable without JavaScript; optional components add authored practice. Shared course navigation owns the page hierarchy.

## Representative lesson: notation grammar

Outcome: distinguish a declaration of type and shape from an operation; read component selection, powers, transpose, functions, grouping, equality, approximate equality and definitions. Prerequisite: arrays and ordinary arithmetic. The existing attention projection section supplies its context.

Worked example: a three-by-two key matrix transposes into a two-by-three matrix with all six entries preserved. Transfer uses a different five-by-three matrix and asks what remains unknown, then asks the learner to write a seven-by-four declaration.

The practice interaction uses `data-math-exercise="notation"` and the shared exercise component. Its five-part design card:

1. **Mental model:** distinguish what an expression declares from what it computes; interpret overloaded superscripts in context.
2. **Prediction:** classify the expression before requesting help or checking an answer.
3. **Manipulation:** select an interpretation and optionally reveal progressively explicit hints; feedback distinguishes an incorrect mathematical reading from an arithmetic mistake. Hints can remain closed for an independent attempt.
4. **Evidence:** deterministic authored feedback explains the shape or operation and why alternative interpretations fail.
5. **Transfer:** read a new matrix declaration without the interaction, infer its transpose, explain why one entry is unknown, then author a declaration with different dimensions.

The toolkit's default return link targets the existing softmax section. The shared practice component resolves only allowlisted contextual `from` keys. Typed answers are never stored; optional progress belongs to the shared practice component.

## Sources and conventions

Examples and prose are authored for this site; numerical values are invented teaching examples. Tensor rows follow the existing course's token-row convention, with one-based indices explicitly stated in worked sums. Transformer context: Vaswani et al., [Attention Is All You Need](https://arxiv.org/abs/1706.03762), Section 3.2. These lessons teach notation and simplified mathematical computation rather than GPU execution order or measurements from a trained model.

## Complete six-lesson sequence

| Route | Outcome | Worked case | Unaided transfer |
| --- | --- | --- | --- |
| `lesson-1.html` | Separate declarations, component selection and transformations | Three-by-two matrix transpose | New five-by-three declaration; author a seven-by-four declaration |
| `lesson-2.html` | Distinguish free and bound indices and count terms | Six source products sum to 24; maximum of [4,8,2,6] is 8 | New letters and three terms; translate to a loop |
| `lesson-3.html` | Infer axes and reject incompatible multiplication | Four-by-eight Q times transposed six-by-eight K gives four-by-six scores | Three-by-five P times transposed seven-by-five R |
| `lesson-4.html` | Decode stable softmax and separate identity from floating-point behavior | Scores [4,8,2,6], maximum 8; shifted and unshifted-by-1000 cases | New indexed expression and scores [−1,1] |
| `lesson-5.html` | Read typed attention transformations and raw cache units | Three-token, two-feature head; weighted feature equals 5; 512 MiB raw cache | Unequal query/key lengths and halved element bytes |
| `lesson-6.html` | Write equations, then decode an unfamiliar expression | Five-component dot-product pseudocode | New U/R/F equation, intermediate shapes, indexed output and assumptions |

The overview exposes all six lessons. Static previous/next links remain usable independently of the shared course shell. The existing inference-to-attention route remains optional-toolkit-free.

## Interaction design cards

All exercises allow an attempt without hints, deterministic explanation, and a later independent prompt. These cards describe the instructional task; numerical component behavior is owned by the shared exercise implementation.

### 0.2 · Indices (`indices`)

1. **Mental model:** a free output coordinate remains fixed while a reduction coordinate enumerates products.
2. **Prediction:** name the number of terms and predict which row/column changing a fixed coordinate selects.
3. **Manipulation:** choose fixed output indices; the generated six products reveal a different row-column pairing, which a single static expansion cannot compare directly.
4. **Evidence:** the selected products sum to the displayed scalar; row 1, column 1 in the authored example is 24.
5. **Transfer:** expand a three-term expression with new symbol names and write the scalar-accumulator loop without using the display.

The A row is deliberately unnormalized in this arithmetic-only example; the text explicitly distinguishes it from a real attention-probability row.

### 0.3 · Shapes (`shapes`)

1. **Mental model:** matrix multiplication consumes matching inner axes and retains the outer axes.
2. **Prediction:** infer Q times transposed K before choosing an answer.
3. **Manipulation:** compare the transposed compatible case with the untransposed incompatible case; the latter makes the exact axis mismatch visible instead of fabricating an output.
4. **Evidence:** four-by-eight times eight-by-six yields four-by-six; four-by-eight times six-by-eight is rejected with reasoning.
5. **Transfer:** infer a different three-by-seven result, preserving its axes under row softmax and rejecting the corresponding direct product.

### 0.4 · Stability (`softmax`, `softmax-stable` explorer)

1. **Mental model:** one shared row shift preserves ratios but changes overflow exposure in finite precision.
2. **Prediction:** identify the maximum 8 and predict the effect of adding 1000 to every score.
3. **Manipulation:** compare moderate and large score presets; this produces an actual change in direct-exponential overflow while the stable result remains finite.
4. **Evidence:** shifted score vectors match; stable weights normalize, while direct exponentials for the large case become non-finite. Rounded display is distinguished from full-precision computation.
5. **Transfer:** explain free/bound indices and the shared maximum for an unfamiliar notation variant, then derive shifted inputs for [−1,1].

The static derivation independently explains ideal equivalence, underflow limits, exact masked zeros, and the invalid all-masked case.

### 0.5 · Context (`transformer` and curated equation explorers)

1. **Mental model:** identify each operation's input/output meaning and axes, then distinguish an element count from a full engineering memory estimate.
2. **Prediction:** state the projection, score and output shapes before expanding a worked explanation; predict which counts affect raw KV bytes.
3. **Manipulation:** choose an operation/shape interpretation and inspect a curated equation's computation only when needed; this tests the learner's proposed translation against a deterministic calculation rather than requiring a full attention simulation.
4. **Evidence:** three-by-two Q/K/V yield three-by-three weights and three-by-two output; a normalized row mixes a value column to 5; the stated cache counts give 536,870,912 bytes = 512 MiB.
5. **Transfer:** derive shapes for unequal query/key lengths and explain the raw-byte consequence of changing only precision.

Curated explorers use `qkv-projection`, `attention-scores`, `masked-attention`, `weighted-values` and `kv-memory`. Their shared component design and numerical states are documented in the explorer documentation. Static prose defines all symbols, including the distinct causal-mask M and raw-memory M_KV.

### 0.6 · Authoring (`capstone`)

1. **Mental model:** reconstruct a reduction from pseudocode rather than merely recognizing a familiar formula.
2. **Prediction:** write a canonical indexed or matrix expression before opening reference translations.
3. **Manipulation:** select a constrained symbolic translation, receive operation-specific feedback, then compare manually written alternatives with the worked reference. This detects a missing reduction without pretending to grade arbitrary algebra.
4. **Evidence:** the scalar loop maps to a five-term dot product; weighted accumulation, stable softmax and the three-by-five comparison product have explicit reference forms.
5. **Transfer:** independently read an invented paper-style U/R/F expression, infer all shapes, write one indexed output and identify missing assumptions. The final diagnostic offers targeted review links rather than a score or completion gate.

The three open authoring prompts are deliberate self-checks. Free text is neither collected nor automatically graded; consistent renaming of bound indices and alternative exp notation are explicitly accepted.

## Verification boundaries

`tests/math-curriculum.test.mjs` checks routes, required shared assets, isolated `data-math-lesson` markers, exercise contracts, independent transfer sections, static fallback and authored numerical examples. It is not a semantic proof of pedagogy or a browser accessibility test. HTML validation and topic CSS lint supplement it; integration and independent QA own rendered KaTeX, keyboard behavior, responsive layouts and theme checks after shared components are present.
