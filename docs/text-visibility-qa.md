# Text visibility checks

Run `npm run test:visibility:browser` from the repository root. The check starts an
isolated local server and closes it afterward. It needs a local Chrome installation
(or set `QA_BROWSER_CHANNEL` to an available Playwright browser channel).

The browser checks discover public HTML pages under `journal/` and `labs/`, include
the homepage, visit every concept in the shared course shell, open technical
content, step through inference and Scion walkthroughs, and exercise the shared
illustration stages. They also compare normal and expanded 3D views with every supported
query-head count (4, 8, 16 and 32). Widths are 320, 768 and 1440 pixels; themes are paper, midnight and
contrast. Reduced motion makes settled geometry reproducible.

Checks catch SVG text outside its viewport or containing node, text hidden behind
a later-painted SVG rectangle, overlapping SVG or 3D labels, horizontal page
overflow, and prose clipped by an ancestor with hidden/clip overflow. Deliberately
scrollable tables and diagrams remain scrollable. Intentionally hidden future
steps and accessible-only math markup are excluded.

`QA_FAST=1` checks one desktop/theme combination during iteration.
`QA_VISUALS_ONLY=1` limits the run to generated shared SVG fixtures.
`QA_ARCHITECTURE_ONLY=1` isolates the 3D geometry matrix.
`QA_HEADS=16` isolates a head-count boundary case.
`QA_WIDTHS=320,768,1440` overrides the viewport widths during focused checks.
`QA_SITE_ROOT=/absolute/prepared-site` serves the actual Pages output.
`QA_BASE=http://127.0.0.1:port` instead targets an already running server.
`QA_OUTPUT=/absolute/evidence-folder` saves the report and head-split screenshots.

The head-split regression keeps projected column ranges inside each head's box,
rather than between a short connector and an opaque node. The layer-2 projection
regression keeps the query multiplication label clear of the bottom cache row.
Residual captions in the 3D explorer choose a nearby free position using measured
component-label bounds, with unit checks for clearance and viewport edges. Q/K/V
blocks stack on narrow scenes with independent input branches routed around the
other blocks; the drawing does not turn parallel projections into a chain. Dense head grids use four spaced columns below
900px scene width. More than eight query heads use compact labels and a
scrollable 600px scene in expanded mode.
These layout changes preserve the exact query-to-KV mappings.

Geometry checks complement visual inspection. They do not prove readability for
all fonts, browser extensions, zoom levels, arbitrary camera angles or possible
input values. Keep screenshots and test both the affected diagram and neighboring
stages when changing layout or labels.
