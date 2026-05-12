const trim = (value: string | undefined): string | undefined => {
  const t = value?.trim();
  return t && t.length > 0 ? t : undefined;
};

/** Public web app URL for links in invitation emails (no trailing slash). */
export const getPublicAppBaseUrl = (): string => {
  const explicit = trim(process.env.APP_PUBLIC_URL);
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }
  const firstAllowed = trim(process.env.ALLOWED_ORIGINS?.split(',')[0]);
  if (firstAllowed) {
    return firstAllowed.replace(/\/$/, '');
  }
  return 'http://localhost:5173';
};

export type ResolvedSmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

export const getResolvedSmtpSettings = (): ResolvedSmtpSettings | null => {
  const host = trim(process.env.SMTP_HOST);
  const user = trim(process.env.SMTP_USER);
  const pass = trim(process.env.SMTP_PASS);
  const from = trim(process.env.SMTP_FROM);
  if (!host || !user || !pass || !from) {
    return null;
  }
  const portRaw = trim(process.env.SMTP_PORT);
  const port = portRaw ? Number(portRaw) : 587;
  if (!Number.isFinite(port) || port <= 0) {
    return null;
  }
  const secure =
    process.env.SMTP_SECURE === '1' ||
    process.env.SMTP_SECURE === 'true' ||
    port === 465;
  return { host, port, secure, user, pass, from };
};

export const isSmtpConfigured = (): boolean => getResolvedSmtpSettings() !== null;
