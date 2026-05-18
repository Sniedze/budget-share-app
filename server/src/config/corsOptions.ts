import type { CorsOptions } from 'cors';

export const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const isDevelopment = (process.env.NODE_ENV ?? 'development') === 'development';

export const getAllowedOrigins = (): string[] => {
  const raw = process.env.ALLOWED_ORIGINS;
  const configured =
    raw && raw.trim().length > 0
      ? raw.split(',').map((entry) => entry.trim()).filter(Boolean)
      : [];
  if (isDevelopment) {
    return [...new Set([...DEFAULT_DEV_ORIGINS, ...configured])];
  }
  if (configured.length === 0) {
    throw new Error('ALLOWED_ORIGINS must be set when NODE_ENV is production.');
  }
  return configured;
};

/**
 * Parses ALLOWED_ORIGINS (comma-separated). When unset, uses local Vite/SPA dev URLs.
 * Requests without an Origin header (e.g. curl, server-to-server) are allowed so tooling still works.
 */
export const createCorsOptions = (): CorsOptions => {
  const allowed = new Set(getAllowedOrigins());

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowed.has(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  };
};
