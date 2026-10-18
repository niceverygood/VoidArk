import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'qa/EXPORT_MANIFEST.json'), 'utf8'));
const overrides = new Map((manifest.exportOverrides || []).map(item => [item.path, item]));
const mismatches = [];
let checked = 0;
let productSources = 0;
let productSourcesMatched = 0;
for (const item of manifest.sourceFiles) {
  const relative = item.path.replaceAll('\\', '/');
  const filename = path.resolve(root, relative);
  if (!filename.startsWith(root + path.sep)) throw new Error('Manifest path outside checkout');
  const bytes = await fs.readFile(filename);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const expected = overrides.get(relative)?.sha256 || item.sha256;
  checked++;
  if (relative.startsWith('src/')) {
    productSources++;
    if (sha256 === item.sha256) productSourcesMatched++;
  }
  if (sha256 !== expected) mismatches.push(relative);
}
const report = {checked, productSources, productSourcesMatched, exportOverrides: [...overrides.keys()], mismatches};
console.log(JSON.stringify(report, null, 2));
if (mismatches.length || productSourcesMatched !== productSources) process.exitCode = 1;
