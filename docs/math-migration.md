# Mathematical equation migration

The optional Module 0 uses its own `data-math-lesson` route and concept navigation. Module 1 and Module 2 numbering, URLs, section anchors, simulation controls and onward journeys remain unchanged. Module 0 navigation carries the query context between lessons; the exercise resolver independently allowlists return destinations.

## Reviewed slice

Module 2 lesson 1, `#s2-1-5`: original softmax and row maximum are separately labeled authored TeX blocks. The final stable form is the equation explorer, with its purpose, symbol key and optional Decode / Compute / Practice disclosure. It is retained on the main concept path rather than folded into technical detail. Module 0 lesson 4 is the direct notation-help destination, with `from=softmax` for returning to this exact section.

The shared shell renders authored mathematics and mounts explorers after course enhancement replaces diagrams. Both APIs are idempotent. Legacy symbol help skips authored math, KaTeX and MathML trees; prose symbols retain the shared glossary help.

## Inventory and priority

| Priority | Surface | Treatment |
| --- | --- | --- |
| P0 | Module 2 lesson 1 projections, scores, scaling, masking, weighted values, full attention | Typeset authored equations; contextual explorer where useful |
| P0 | Module 2 lesson 5 raw KV memory | Typeset formula and contextual memory explanation |
| P1 | Module 2 lessons 2–4 tensor shapes, head mapping, cache arithmetic | Typeset stable authored equation blocks without changing simulations |
| P1 | Module 1 authored attention and memory equations | Typeset stable source where available; preserve existing dynamic controls |
| Retained | High frequency numeric cells, canvas/SVG diagram labels, live tensor tables | Existing accessible DOM and shared symbol glossary; no automatic retypesetting observer |

No simulation arithmetic or model configuration is changed by notation migration. Migration targets trusted authored expressions only, never typed input.
