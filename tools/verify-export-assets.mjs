import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateGLB} from './validate-assets.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'public');
const manifest = JSON.parse(fs.readFileSync(path.join(publicRoot, 'assets/meshy/manifest.json'), 'utf8'));
const entries = [];
for (const [id, asset] of Object.entries(manifest.assets)) {
  if (typeof asset.url !== 'string' || !asset.url.startsWith('/assets/')) throw new Error('Unexpected model URL for ' + id);
  const filename = path.resolve(publicRoot, '.' + asset.url);
  if (!filename.startsWith(publicRoot + path.sep)) throw new Error('Model path outside public');
  entries.push({id, ...validateGLB(fs.readFileSync(filename))});
}
const report = {at: new Date().toISOString(), basis: 'Every model in the shipped public manifest; no generation plan or API call required', models: entries.length, bytes: entries.reduce((sum, item) => sum + item.bytes, 0), maxTriangles: Math.max(...entries.map(item => item.triangles)), entries};
fs.writeFileSync(path.join(root, 'qa/GITHUB_ASSET_INTEGRITY.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({...report, entries: undefined}));
