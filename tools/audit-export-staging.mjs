import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = execFileSync('git', ['ls-files', '--cached', '-z'], {cwd: root}).toString('utf8').split('\0').filter(Boolean);
const forbidden = /(^|\/)(node_modules|dist|windows|release|\.git|\.runtime|\.transfer|\.qa-work|saves|user-data|userData)(\/|$)|(^|\/)\.env(?:\.|$)|signing-private|\.(pem|key|p12|pfx|jks|keystore|db|sqlite\w*|zip)$/i;
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/,
  /\bsk-[A-Za-z0-9_-]{30,}\b/,
  /[?&](?:X-Amz-Signature|access_token|api_key)=[A-Za-z0-9%+/_=-]{16,}/i,
];
const findings = [];
let bytes = 0, textFilesScanned = 0, largestFile = null;
for (const file of files) {
  if (forbidden.test(file)) findings.push({file, reason: 'excluded path'});
  const filename = path.join(root, file), stat = await fs.lstat(filename);
  if (stat.isSymbolicLink() || !stat.isFile()) {findings.push({file, reason: 'non-regular file'}); continue;}
  bytes += stat.size;
  if (!largestFile || stat.size > largestFile.bytes) largestFile = {file, bytes: stat.size};
  if (stat.size >= 90 * 1024 * 1024) findings.push({file, reason: 'oversized file'});
  if (/\.(?:js|mjs|cjs|json|md|txt|log|html|css|toml|yml|yaml|sh|ps1|cmd)$/i.test(file) || /^\.(?:gitignore|gitattributes)$/.test(file)) {
    textFilesScanned++;
    const contents = await fs.readFile(filename, 'utf8');
    if (secretPatterns.some(pattern => pattern.test(contents))) findings.push({file, reason: 'possible credential pattern'});
  }
}
const report = {at: new Date().toISOString(), scope: 'Git staged paths and current working-file bytes; pattern scan is not a guarantee of all secret formats', files: files.length, bytes, textFilesScanned, largestFile, findings};
await fs.writeFile(path.join(root, 'qa/GITHUB_STAGING_AUDIT.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (findings.length) process.exitCode = 1;
