import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const srcDir = join(root, 'src');

/** @param {string} dir @param {string[]} out */
const collectTestFiles = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTestFiles(full, out);
    } else if (entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
};

const files = collectTestFiles(srcDir).sort();
if (files.length === 0) {
  console.error('No test files found under', srcDir);
  process.exit(1);
}

const tsxCandidates = [
  join(root, 'node_modules/tsx/dist/cli.mjs'),
  join(root, '..', 'server/node_modules/tsx/dist/cli.mjs'),
];
const tsxPath = tsxCandidates.find((candidate) => existsSync(candidate));
if (!tsxPath) {
  console.error('tsx not found; run npm install in client/');
  process.exit(1);
}

const result = spawnSync(process.execPath, [tsxPath, '--test', ...files], {
  cwd: root,
  stdio: 'inherit',
});

process.exit(result.status === null ? 1 : result.status);
