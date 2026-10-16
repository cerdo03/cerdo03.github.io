# Shared math renderer

`labs/llm-systems/math-renderer.js` renders trusted, authored TeX synchronously.
Load `math.css` after topic CSS and import the module once. There is no runtime
network dependency, delimiter scanning, visitor input rendering or glyph tooltip
system. Course integration calls `renderMathIn(root)` after inserting new lesson
content; the module also handles the initial document.

```html
<link rel="stylesheet" href="../llm-systems/math.css">
<span data-math="x_i">xᵢ</span>
<div data-math="a_j=\frac{e^{z_j-m}}{\sum_k e^{z_k-m}}"
     data-display="true" data-math-label="Stable softmax">
  a_j = exp(z_j − m) / sum_k exp(z_k − m)
</div>
<script type="module" src="../llm-systems/math-renderer.js"></script>
```

Keep readable fallback text in authored HTML for JavaScript-disabled visits.
Use `aligned` for a multiline derivation. Display equations scroll inside their
own region on narrow screens. Equation containers use shared theme variables;
KaTeX's dedicated mathematical glyph fonts remain upstream assets.

## API

- `renderMath(element, tex, {displayMode = false, label, id} = {})` returns the
  element. `label` optionally names a group containing the accessible MathML.
- `renderMathIn(root = document)` renders `[data-math]` descendants and an authored
  root itself, returning the visited array. `data-display="true"` selects display
  mode and `data-math-label` supplies the optional label.
- Identical calls leave the rendered DOM intact; changed TeX or options render
  again. Output has `data-math-rendered="true"`. Invalid TeX gets
  `data-math-error="true"` and literal source text through `textContent`.

MathML is retained alongside visual HTML (`htmlAndMathml`). No extra hidden copy
or `role="img"` masks the mathematical structure. Definitions belong in the shared
glossary and equation key; do not wrap generated `.katex` or MathML glyphs in
symbol-help controls. Long equation regions are native overflow containers; test
keyboard scrolling when the browser exposes a focusable scrolling region.

## Dependency provenance and deployment

Pinned KaTeX **0.19.0**, the current release verified against the official
[release](https://github.com/KaTeX/KaTeX/releases/tag/v0.19.0) and
[API](https://katex.org/docs/api) on 2026-10-16. Vendored under
`assets/vendor/katex/0.19.0/` from
`https://registry.npmjs.org/katex/-/katex-0.19.0.tgz`.
Archive SHA-256: `d8e49f2fea6eeed7cdae2cf4fd48e2f1d348758aa9e5740715e4533c2c96d1ee`.
The published `dist/katex.mjs` is copied byte-for-byte as `katex.js`, so the
existing static deployment versioner handles its import. `dist/katex.min.css`,
all `dist/fonts/` files and the upstream MIT `LICENSE` are copied unchanged.
The vendor directory is within the existing deployment allowlist. CSS uses
versioned-directory relative font URLs, independent of a page's route.

[Upstream options](https://katex.org/docs/options) inform fixed `trust: false`,
`throwOnError: true`, `strict: 'error'`, a fresh macro object per expression,
`maxExpand: 1000` and `maxSize: 20`. Authors cannot override these options through
markup. The renderer deliberately accepts no untrusted equation editor input.

## Verification

`node --test tests/math-renderer.test.mjs` tests actual KaTeX fraction/MathML
output, inline/display modes, multiline alignment, idempotence, changed TeX,
invalid fallback, disabled HTML/unsafe URL extensions, license and every CSS
font reference. Browser QA must additionally inspect fonts, overflow, theme
contrast and assistive-technology behavior in the integrated lesson.

## Narrow equation affordance

Connected display equations are measured after mounting, font readiness, concept
changes, disclosure toggles and window resizing. Actual horizontal overflow shows
“Scroll equation horizontally” and makes that region explicitly keyboard
focusable. The cue disappears when the expression fits; compact equations do not
add focus stops. These checks never re-typeset mathematics or retain discarded
simulation nodes. `updateMathOverflow(root)` is also available for explicit mounts.
