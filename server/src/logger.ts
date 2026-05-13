type LogLevel = 'info' | 'warn' | 'error';

type LogFields = Record<string, unknown>;

const write = (level: LogLevel, event: string, fields: LogFields): void => {
  const payload = {
    level,
    event,
    time: new Date().toISOString(),
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
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
}): void => {
  write('error', 'http_error', fields);
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
