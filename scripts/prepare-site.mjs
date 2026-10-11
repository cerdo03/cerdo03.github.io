import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [output, revision] = process.argv.slice(2);
if (!output || !/^[a-zA-Z0-9-]+$/.test(revision || '')) throw new Error('Output path and revision required');
mkdirSync(output, { recursive: true });
for (const name of ['index.html', 'styles.css', 'assets', 'journal', 'labs']) {
  cpSync(name, join(output, name), { recursive: true });
}

function versionAssets(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Deployment assets cannot contain symlinks');
    if (entry.isDirectory()) { versionAssets(path); continue; }
    if (!/\.(html|js)$/.test(entry.name)) continue;
    let source = readFileSync(path, 'utf8');
    if (entry.name.endsWith('.html')) {
      source = source.replace(/(href|src)=(['"])([^'"?#]+\.(?:css|js))(?:\?[^'"#]*)?\2/g,
        (match, attribute, quote, url) => /^(?:https?:|\/\/)/.test(url) ? match : `${attribute}=${quote}${url}?v=${revision}${quote}`);
    } else {
      source = source.replace(/(from\s+['"])(\.\.?\/[^'"?]+\.js)(?:\?[^'"]*)?(['"])/g,
        (_, prefix, url, quote) => `${prefix}${url}?v=${revision}${quote}`);
    }
    writeFileSync(path, source);
  }
}
versionAssets(output);
