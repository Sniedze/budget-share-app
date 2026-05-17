import { getPublicAppBaseUrl, getResolvedSmtpSettings, isSmtpConfigured } from './smtpConfig.js';
import { buildEmailChangeConfirmationEmail } from './emailChangeTemplates.js';
import { getSmtpTransporter } from './smtpTransporter.js';
import { logEmailChangeConfirmationFailed, logEmailChangeConfirmationSent } from '../../logger.js';

const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback;
};

const SMTP_RETRY_MAX_ATTEMPTS = parsePositiveInt(process.env.SMTP_RETRY_MAX_ATTEMPTS, 3);
const SMTP_RETRY_BASE_DELAY_MS = parsePositiveInt(process.env.SMTP_RETRY_BASE_DELAY_MS, 300);

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const buildEmailChangeConfirmUrl = (token: string): string => {
  const baseUrl = getPublicAppBaseUrl();
  const params = new URLSearchParams({ token });
  return `${baseUrl}/confirm-email-change?${params.toString()}`;
};

export const sendEmailChangeConfirmation = async (params: {
  fullName: string;
  currentEmail: string;
  newEmail: string;
  token: string;
}): Promise<void> => {
  const confirmUrl = buildEmailChangeConfirmUrl(params.token);
  const isDevelopment = (process.env.NODE_ENV ?? 'development') === 'development';

  if (!isSmtpConfigured()) {
    if (isDevelopment) {
      console.info(`[dev] Email change confirmation link for ${params.newEmail}: ${confirmUrl}`);
      return;
    }
    throw new Error('SMTP is not configured. Cannot send email confirmation.');
  }

  const smtp = getResolvedSmtpSettings()!;
  const transporter = getSmtpTransporter(smtp);
  const emailContent = buildEmailChangeConfirmationEmail({
    fullName: params.fullName,
    currentEmail: params.currentEmail,
    newEmail: params.newEmail,
    confirmUrl,
  });

  let lastMessage = 'unknown_smtp_error';
  for (let attempt = 1; attempt <= SMTP_RETRY_MAX_ATTEMPTS; attempt += 1) {
    try {
      await transporter.sendMail({
        from: smtp.from,
        to: params.newEmail,
        ...emailContent,
      });
      logEmailChangeConfirmationSent({ to: params.newEmail, attempts: attempt });
      return;
    } catch (err) {
      lastMessage = err instanceof Error ? err.message : String(err);
      if (attempt < SMTP_RETRY_MAX_ATTEMPTS) {
        await sleep(SMTP_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }
  }

  logEmailChangeConfirmationFailed({ to: params.newEmail, message: lastMessage });
  throw new Error('Failed to send confirmation email. Try again later.');
};
