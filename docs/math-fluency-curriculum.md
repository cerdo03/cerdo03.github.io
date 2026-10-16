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
