import type { CorsOptions } from 'cors';

export const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

export const getAllowedOrigins = (): string[] => {
  const raw = process.env.ALLOWED_ORIGINS;
  return raw && raw.trim().length > 0
    ? raw.split(',').map((entry) => entry.trim()).filter(Boolean)
    : DEFAULT_DEV_ORIGINS;
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
