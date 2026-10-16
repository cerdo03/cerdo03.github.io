# Equation Explorer and practice

The authored `data-equation="softmax-stable"` placeholder mounts a visible equation, purpose and notation key. Decode, Compute and Practice are optional native disclosures. Computation uses full precision and rounds display only. Existing shared glossary definitions supply common symbol meanings; no second tooltip system is created.

`math-exercises.js` exports pure `stableSoftmax`, `resolveReturnLink`, `evaluateChoice` and authored `exercises`. `data-math-exercise="notation"` mounts deterministic choices, feedback, two graduated hints and an ungated explanation. No answers are stored or transmitted. Return links accept only frozen authored origin keys; unknown inputs use the safe softmax route.

Initial slice: stable softmax, notation checkpoint and return links. Renderer and stylesheet are loaded by the host page. `mountEquationExplorers` and `mountMathExercises` accept a document or subtree and are idempotent. Both auto-mount authored nodes when loaded in a browser.

Numerical tests: `node --test tests/math-explorer.test.mjs`. Tests cover shift invariance, long rows, exact mask zeros, tiny positive weights, invalid/all-masked rows and safe return resolution. Illustrative data is not model telemetry.
