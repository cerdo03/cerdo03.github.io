# Project instructions

Public personal journal for GitHub account cerdo03. `CLAUDE.md` is a relative symlink to this file; keep this as the single source of agent instructions.

## Privacy and workflow

- Review staged content and commit metadata before every push. Ask the owner before pushing sensitive information.
- Never publish credentials, private keys, private notes, phone numbers or internal company information without explicit owner approval. The public contact email and professional bio already on the homepage are authorized.
- Work in a separate worktree under `.claude/worktrees/`. Preserve unrelated work.
- Use the repo-local no-reply commit email. Verify cerdo03 authentication before remote writes.
- Run relevant tests and local lint. If a lint failure comes from the current change, get owner approval before fixing it.
- Keep source buildless HTML/CSS/JavaScript. Development tools are allowed; avoid runtime frameworks unless needed and agreed.

## Design scheme: personal notebook

One visual language, two levels of interaction. The homepage is a quiet directory and short personal introduction. Inner learning sites teach through exploration.

### Homepage and journal

- Put personal identity first: short professional bio and modest interests, then Learning sites, Writing and Books. Keep navigation to those three links; contact links belong in the introduction. Writing has separate Technical notes and Personal reflections groups; the reading shelf tracks books, with future book essays in Personal reflections.
- Keep the homepage simple: short bio, contact links, dated notes, a reading shelf and learning-site links. No ornamental animations, dashboards, hero illustrations or dense cards.
- Journal entries can cover books, personal reflections, everyday observations or technical questions and experiments. Link sources and related learning sites when relevant. Never invent book opinions, ratings or experiences for the owner. Keep reading status distinct from published reflections.
- Use readable type, generous spacing and clear hierarchy. Keep navigation short. Avoid long resumes and invented accomplishments.

### Learning sites

- Start with the learning goal and a concrete example; define terms before using them. Progress from foundations to deeper mechanisms.
- Include meaningful interactive diagrams, simulations or manipulable examples. Every control must show the resulting change and explain why it happened.
- Use labeled flows, timelines and before/after comparisons to reveal state, cause, failure and recovery. Decorative movement does not count as teaching.
- Include predictions/checks with explanatory feedback where useful; do not block navigation behind quizzes.
- Label invented numbers and simplified models. State important limits and trade-offs. Attribute and link the original article; do not present its prose as original work.
- Preserve keyboard access, focus states, readable contrast, mobile layouts, reduced motion and a return link to the journal. Never encode meaning through color alone.
- Inline symbol explanations: every math symbol, variable and tensor marker in lesson prose, equations, tables and diagrams (for example Q, K, V, A, O, M, T, d_model, d_k, d_v, H, H_KV, D, L, B) shows its short meaning in place when the pointer hovers it, matching the page's notation/legend table (e.g. "H_KV — Query heads and key/value heads", "B — Bytes per stored element (2 for BF16/FP16)"). Keep one shared glossary per site as the single source for these texts; never write different definitions for the same symbol. The explanation must also appear on keyboard focus and on tap, be dismissible with Escape, use an accessible description (aria-describedby or equivalent), stay within the viewport on mobile and use shared theme variables only. The visible notation table stays; tooltips supplement it.

## Shared themes: one global source

- All pages load `assets/theme.css` and `assets/theme.js` using correct relative paths, including journal posts and every learning site.
- Owner default lives in `assets/theme-config.js`: `defaultTheme` is `paper`, `midnight` or `contrast`. Changing it and deploying changes the design everywhere for all visitors.
- Paper: warm beige background, near-black text, white surfaces and restrained brown accents. Midnight: warm charcoal background, light text and muted tan accents. High contrast: black/white with yellow accents.
- Colors must use shared semantic CSS variables. Never add page-specific palettes, hardcoded colors, font families or local theme implementations. Page-specific layouts and interactive diagrams are encouraged.
- Prefer shared `--paper`, `--ink`, `--muted`, `--line`, `--card`, `--surface-alt`, `--accent`, `--on-accent`, `--accent-soft`, `--success-soft`, `--danger-soft` and diagram tokens. Typography uses `--body-font` and `--heading-font`.
- Design scheme control belongs to the owner. Visitors have one shared Light/Dark button on every page, persisted under journal-appearance and synchronized across tabs. Do not expose palette menus or independent page overrides. Legacy scheme preferences remain ignored.
- New palettes, fonts and global visual decisions belong in shared assets, not copied page CSS. Test all themes after adding a component.
- This synchronizes sites hosted under this journal origin; separately hosted external sites need their own integration.

## Deployment

- GitHub Actions deploys an allowlisted static bundle: `index.html`, `styles.css`, `assets/`, `journal/`, `labs/`.
- Keep `CLAUDE.md`, `AGENTS.md`, tests, development dependencies and private state out of the deployment artifact. Git supports the tracked symlink; Pages artifacts must contain no symlinks.
- Main pushes automatically publish after checks. Verify successful deployment and live pages before claiming publication complete.

- Deployment versions all local CSS/JS URLs and module imports with the commit SHA. Keep this automatic cache invalidation when changing the deployment process; never require visitors to clear cache after design updates.

## Inference site ownership

`labs/inference/` is the canonical public inference website. The original learning chat edits these same files through its local `dist` symlink. Preserve this single source; do not copy it back into an independent site. Local edits appear here immediately; publish reviewed changes through the existing main deployment. Keep learner memory and progress files outside this public repository.

## Basic analytics

- Published HTML gets the async GoatCounter beacon in scripts/prepare-site.mjs; local source previews do not track.
- Endpoint: https://cerdo.goatcounter.com/count. This is a public collection address, not a credential.
- Keep analytics limited to default page visits and referrers. No custom events, quiz tracking, learner notes or typed answers.
- Preserve one beacon per page, including future learning sites and journal posts. No analytics dashboard or extra controls in visitor UI.

## Learning collections and tags

- A collection represents one learning project: a course, paper or research topic. It opens a simple landing page listing its published websites; standalone sites stay direct links.
- Do not move existing lab URLs or break the inference source-chat symlink. Group membership is metadata, not a filesystem migration.
- assets/learning-catalog.js is the source for project/site metadata. siteTags merges inherited project tags with site tags, deduplicating them. assets/learning-tags.js displays those tags.
- New sites register in the catalog and appear on their collection page. Update the published count; never present planned lessons as available websites.
- Describe scope honestly, credit primary sources, distinguish simulations from measurements, and keep personal study budgets/career plans out of public lesson guidance.

## LLM Systems collection design contract

Applies only to the Learning LLM Systems collection (`labs/llm-systems/`, `labs/inference/`, `labs/attention/` and future member sites), not unrelated learning collections.

- Load `labs/llm-systems/course.css` and `course-shell.js` after topic styles. These own the shared header, module navigation, concept navigation, content width, mobile behavior, and Previous/Next pattern. Topic files own diagrams and calculations. Preserve existing URLs.
- Use Module 1’s one-concept-at-a-time flow with Module 2’s precise mathematics available in expandable technical details. Keep a brief intuition, the relevant inline illustration, and its consequence on the main path. Do not add slogans, decorative motion, dashboards, notes boxes or progression gates.
- Use the simple “The sky is” running example where appropriate. Label a wider-vector model or alternate mathematical example explicitly; do not silently change vector meanings or position numbering.
- Put optional input experiments at the start and share their state through all dependent main diagrams. Do not edit an intermediate Q or x locally as if it were an upstream embedding change. A calculator and its chart share one model configuration.
- For vector computation flows, prefer compact connected-node diagrams with visible dependency edges over stacked explanatory cards. Keep a model overview linked to the selected layer/head/token, support direct node inspection and operation stepping, and label schematic connections separately from measured weights. Use animation only to reveal active data flow; respect reduced motion.
- Show what the current token is, whether it is being processed or merely sampled, and which operation is active. Show newly created K/V separately from old cache rows and from attention output. Operation stepping reveals meaningful computation; it is not a claim about GPU scheduling.
- Keep numerical calculations at full precision; round only display. Use approximately-equal notation for displayed arithmetic. Distinguish tiny positive attention weights from exact causal-mask zeros.
- Retain shared accessible symbol help, without making every repeated occurrence a separate Tab stop. All controls and diagrams must work with keyboard, touch, narrow layouts, light/dark themes and reduced motion.
- Every collection, module overview and lesson page exposes the same module hierarchy. Nest lesson links under their parent module with visible indentation and semantic lists; mark the current page. Keep local concept navigation separate under “Concepts”, with consistent numbering, typography and spacing. Persist disclosure choices across collection pages; never let topic CSS override shared navigation or header sizing.
- Future collection members register their module/lesson names and routes in the shared shell, then reuse its layout and navigation rather than inventing another layout. Keep collection-specific rules here; private learner history stays outside this public repository.

- For numeric projections, score/softmax/value arithmetic, request/cache flow, head splitting/sharing, vocabulary projection and prefix validity, reuse `labs/llm-systems/learning-visuals.js` and its pure `visual-model.js`. Keep head/query inputs separate from cached K/V, propagate shared starting embeddings, and keep controls/layout stable during operation stepping. A scripted continuation must be identified as scripted; a numerical vocabulary demo must calculate logits from its stated final vector. Preserve essential inline diagrams and move retained implementation references into expandable details.

- Let the lesson column use the available screen width beside the sidebar. Constrain prose line length and diagram scale separately, rather than capping the entire desktop lesson at a narrow fixed width. Check phone, tablet and wide desktop layouts without page-level overflow.

- Computational diagrams must show the operation and its purpose, not just a weight-matrix name on an arrow. Separate input sharing, multiplication, product summation, score scaling/masking, normalization, weighted-value summation, concatenation and residual addition. Put component arithmetic inline at the relevant step; keep the model map compact or expandable. Reuse the stated numeric model and shared embeddings; never assign its numbers to an uncomputed schematic layer/head.
