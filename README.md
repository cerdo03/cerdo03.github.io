# Technical journal

A personal journal and directory of learning websites. Plain HTML and CSS; no build step or runtime dependencies.

## Preview

Run `python3 -m http.server 8000` from the repository root, then open http://localhost:8000.

## Publish with GitHub Pages

In repository Settings → Pages, choose **Deploy from a branch**, **main**, **/(root)**, then save. Pushes to main automatically publish the site at https://cerdo03.github.io/.

## Add a journal entry

Copy `journal/starting-this-journal.html` to a new file under `journal/`. Update its title, description, date and content. Add a linked entry to the Journal section of `index.html`.

## Add a learning site

Put static site files in a folder under `labs/` (for example `labs/my-experiment/index.html`). Add a link and description to the Learning sites section of `index.html`, replacing the empty-state message. Use relative asset paths so nested pages work. You can also link to separately hosted public sites.

## Checks

Run `npm ci`, then `npm run lint`. Node packages are development tools only; the deployed site has no runtime dependencies.

## Privacy

This repository is public. Keep credentials, private notes, internal company material and personal data out of the site and its Git history. Review staged files before pushing. Ask the owner before pushing any sensitive information.
