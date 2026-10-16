# Mathematical fluency: independent verification

Audit base: integration commit `69699e5`. Audit adds only `tests/math-audit.test.mjs` and this report. No deployment or remote writes occurred.

## Automated evidence

- `npm test`: 207 tests passed, zero failures, including eight independent audit tests.
- `npm run lint`: passed for HTML, shared/topic CSS and application JavaScript.
- Independent analytic softmax odds agree to 1e-14, masked probabilities remain exactly zero, tiny legal probabilities remain positive, and all-masked rows reject.
- Matrix shape inference: `(4 × 8)(8 × 6) → 4 × 6`; incompatible inner dimensions reject. Transpose preserves element count.
- A separately calculated six-term row/column product equals 36. Raw cache example equals exactly 536,870,912 bytes, or 512 MiB; halving KV heads halves bytes.
- All six authored checkpoint definitions have deterministic success, explanatory failure and optional hints. Every allowlisted contextual return route resolves to an existing attention anchor; arbitrary origins cannot redirect.
- Optional progress stores only lesson IDs. Repeated marking deduplicates, resume/reset work, and blocked storage does not throw.
- The actual deployment preparation script was executed in a temporary directory. Its top-level allowlist excludes tests, documentation and private state. The pinned KaTeX runtime and fonts remain present, local JS imports/HTML references receive revision suffixes, all artifact entries are free of symlinks, and the inspected lesson contains exactly one default GoatCounter beacon.

## Browser evidence

Headless installed Chrome controlled through Playwright, served as ordinary static files. Covered collection overview, Module 1, all five Module 2 lessons, Module 0 overview and all six new lessons.

- 224 route/theme/viewport/zoom cases: widths 320, 390, 768, 1280 and 1600; paper, midnight and contrast; 200% CSS zoom with reduced motion. No document overflow, render error markers, symbol-help mutation inside KaTeX/MathML, page exceptions or HTTP errors.
- A further 960 cases inspected every direct lesson section across all six new and five existing attention lessons at those five widths and three themes. No document overflow.
- Each of the six main practice checkpoints was answered incorrectly, then correctly; Hint 1 opened. Keyboard Enter activated the check button. Duplicate exercise instances retained independent radio selection.
- Browser activities verified: six-term column change gives 36; incompatible matrix dimensions explain the mismatch; shifted large scores show ordinary floating-point overflow alongside finite stable probabilities; the three transformer shapes check successfully; the indexed equation composer matches the loop.
- Progress marking, overview resume and reset were exercised. A context whose localStorage getter throws still rendered math without page exceptions.
- At 320 px, an irreducible matrix equation overflowed only its local container (278 px viewport, 387 px content). It was reachable using Tab and ArrowRight scrolled the equation; Chrome supplies native keyboard scrolling even though DOM tabIndex reports -1.
- JavaScript-disabled previews retained authored textual formulas and noscript practice explanations on Module 0 lessons 1/4 and Module 2 lesson 1.
- Stable-softmax screenshots at 320/1280 in all three themes were captured outside public assets and visually inspected. Equation, purpose, symbol key, optional disclosure, return link and navigation remain legible; long expressions use local scrolling.

## Findings and limits

No remaining blocking defect was found in this audit. The duplicate radio-name regression discovered during integration was reproduced and retested after the component owner's fix.

This is an automated browser/accessibility smoke audit, not a WCAG certification. Actual screen-reader speech, physical touch devices, OS/browser zoom, Safari/Firefox and qualitative learner outcomes were not tested. MathML presence and accessible labels were checked structurally; intelligibility should still be assessed with a screen reader. CSS zoom approximates increased content scale and does not establish browser-zoom equivalence. Local equation scrolling was verified in Chrome; other engines require their own keyboard checks.

## Orchestrator final recheck

After the independent audit, the orchestrator removed redundant maximum notation
from the compact stable-softmax formula, added visible overflow cues and explicit
keyboard focus only for long equations, and tested cleanup when display math
changes to inline. Both new renderer tests were observed failing before their
implementation. Final suite: **209 passed**, full lint and diff check passed.
The 224-case route matrix, 960-case concept matrix, all activity flows,
keyboard/progress/storage checks and JavaScript-disabled fallbacks were rerun
successfully. Final screenshots were refreshed in all three themes at 320/1280.
