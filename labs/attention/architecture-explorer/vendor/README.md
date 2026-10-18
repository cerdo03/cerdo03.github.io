# Three.js vendor provenance

Pinned npm package: `three@0.186.1` (MIT).

Files copied without modification from the official npm tarball:
- `build/three.module.js`
- `build/three.core.js`
- `LICENSE`

`examples/jsm/controls/OrbitControls.js` has one local integration change:
`from 'three'` → `from './three.module.js'`.

No runtime CDN, import map, framework or build step is required. The existing
Pages preparation script versions these relative imports with all other assets.
ESLint excludes upstream vendor files; application code remains checked.

To update: download an explicit three version with `npm pack`, replace these
files together, retain its license, repeat the single import adjustment, update
this record and run unit tests, lint, browser QA and prepared-bundle browser QA.
Do not mix core/renderer/controls releases. A newer Three release may change
WebGL support requirements; preserve the HTML component-navigation fallback.
