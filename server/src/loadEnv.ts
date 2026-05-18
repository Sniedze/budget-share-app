import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const parseEnvLine = (line: string): { key: string; value: string } | null => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }
  const separatorIndex = trimmed.indexOf('=');
  if (separatorIndex <= 0) {
    return null;
  }
  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
};

const applyEnvFile = (envPath: string, options: { override: boolean }): boolean => {
  if (!existsSync(envPath)) {
    return false;
  }
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }
    if (!options.override && process.env[parsed.key] !== undefined) {
      continue;
    }
    process.env[parsed.key] = parsed.value;
  }
  return true;
};

/** Loads repo-root `.env` and optional `.env.local` before DB config is read. */
export const loadRepoRootEnv = (): string[] => {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const loaded: string[] = [];
  const envPath = resolve(repoRoot, '.env');
  const localPath = resolve(repoRoot, '.env.local');
  if (applyEnvFile(envPath, { override: false })) {
    loaded.push(envPath);
  }
  if (applyEnvFile(localPath, { override: true })) {
    loaded.push(localPath);
  }
  return loaded;
};

const loadedEnvPaths = loadRepoRootEnv();
if (loadedEnvPaths.length > 0 && (process.env.NODE_ENV ?? 'development') === 'development') {
  console.log(`Loaded environment from ${loadedEnvPaths.join(', ')}`);
}
