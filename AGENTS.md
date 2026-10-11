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

## Shared themes: one global source

- All pages load `assets/theme.css` and `assets/theme.js` using correct relative paths, including journal posts and every learning site.
- Owner default lives in `assets/theme-config.js`: `defaultTheme` is `paper`, `midnight` or `contrast`. Changing it and deploying changes the design everywhere for all visitors.
- Paper: warm beige background, near-black text, white surfaces and restrained brown accents. Midnight: dark neutral background and light green accent. High contrast: black/white with yellow accents.
- Colors must use shared semantic CSS variables. Never add page-specific palettes, hardcoded colors, font families or local theme implementations. Page-specific layouts and interactive diagrams are encouraged.
- Prefer shared `--paper`, `--ink`, `--muted`, `--line`, `--card`, `--surface-alt`, `--accent`, `--on-accent`, `--accent-soft`, `--success-soft`, `--danger-soft` and diagram tokens. Typography uses `--body-font` and `--heading-font`.
- Theme control belongs to the owner only. Do not expose theme selectors, design menus or visitor overrides. Every visitor sees the global owner setting; ignore any legacy browser preference.
- New palettes, fonts and global visual decisions belong in shared assets, not copied page CSS. Test all themes after adding a component.
- This synchronizes sites hosted under this journal origin; separately hosted external sites need their own integration.

## Deployment

- GitHub Actions deploys an allowlisted static bundle: `index.html`, `styles.css`, `assets/`, `journal/`, `labs/`.
- Keep `CLAUDE.md`, `AGENTS.md`, tests, development dependencies and private state out of the deployment artifact. Git supports the tracked symlink; Pages artifacts must contain no symlinks.
- Main pushes automatically publish after checks. Verify successful deployment and live pages before claiming publication complete.

- Deployment versions all local CSS/JS URLs and module imports with the commit SHA. Keep this automatic cache invalidation when changing the deployment process; never require visitors to clear cache after design updates.
