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

/** Loads repo-root `.env` before DB config is read (ESM imports run before other modules). */
export const loadRepoRootEnv = (): string | null => {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const envPath = resolve(repoRoot, '.env');
  if (!existsSync(envPath)) {
    return null;
  }

  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed || process.env[parsed.key] !== undefined) {
      continue;
    }
    process.env[parsed.key] = parsed.value;
  }

  return envPath;
};

const loadedEnvPath = loadRepoRootEnv();
if (loadedEnvPath && (process.env.NODE_ENV ?? 'development') === 'development') {
  console.log(`Loaded environment from ${loadedEnvPath}`);
}
