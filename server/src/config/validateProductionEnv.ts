const isProduction = (): boolean => (process.env.NODE_ENV ?? 'development') === 'production';

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

const parseOrigins = (): string[] => {
  const raw = process.env.ALLOWED_ORIGINS;
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

/** Fail fast when production is misconfigured (call after loadEnv, before listening). */
export const validateProductionEnv = (): void => {
  if (!isProduction()) {
    return;
  }

  const origins = parseOrigins();
  if (origins.length === 0) {
    throw new Error(
      'ALLOWED_ORIGINS must be set in production (comma-separated public HTTPS origins, e.g. https://example.com).',
    );
  }
  if (origins.every((origin) => LOCAL_ORIGIN.test(origin))) {
    throw new Error(
      'ALLOWED_ORIGINS must include your public site URL, not only localhost origins.',
    );
  }

  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy !== '1' && trustProxy !== 'true') {
    throw new Error('TRUST_PROXY must be 1 or true in production when behind Caddy or another reverse proxy.');
  }
};
