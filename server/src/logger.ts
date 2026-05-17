import pino from 'pino';
import { ErrorCode } from './graphql/appError.js';

type LogFields = Record<string, unknown>;

const parseLevel = (): pino.Level => {
  const raw = process.env.LOG_LEVEL?.trim().toLowerCase();
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') {
    return raw;
  }
  return 'info';
};

const rootLogger = pino({
  level: parseLevel(),
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
});

const write = (level: pino.Level, event: string, fields: LogFields): void => {
  rootLogger[level]({ event, ...fields });
};

export const logRequestCompleted = (fields: {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
}): void => {
  write('info', 'http_request', fields);
};

export const logServerError = (fields: {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  message: string;
  code?: string;
}): void => {
  write('error', 'http_error', fields);
};

export const logGraphqlResolverError = (fields: {
  requestId: string;
  message: string;
  code?: string;
  path?: ReadonlyArray<string | number>;
}): void => {
  if (fields.code === ErrorCode.UNAUTHENTICATED) {
    return;
  }
  const isClientError =
    fields.code !== undefined &&
    fields.code !== ErrorCode.INTERNAL_SERVER_ERROR &&
    fields.code !== 'INTERNAL_SERVER_ERROR';
  write(isClientError ? 'warn' : 'error', 'graphql_resolver_error', {
    method: 'POST',
    path: '/graphql',
    ...fields,
  });
};

export const logAuthzDenied = (reason: string, fields: LogFields = {}): void => {
  write('warn', 'authz_denied', { reason, ...fields });
};

export const logInvitationEmailSkipped = (fields: LogFields): void => {
  write('info', 'invitation_email_skipped', fields);
};

export const logInvitationEmailSent = (fields: LogFields): void => {
  write('info', 'invitation_email_sent', fields);
};

export const logInvitationEmailFailed = (fields: LogFields): void => {
  write('warn', 'invitation_email_failed', fields);
};
