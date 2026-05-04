type LogLevel = 'warn' | 'error';

const write = (level: LogLevel, event: string, fields: Record<string, unknown>): void => {
  const payload = {
    level,
    event,
    time: new Date().toISOString(),
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
  } else {
    console.warn(line);
  }
};

export const logAuthzDenied = (reason: string, fields: Record<string, unknown> = {}): void => {
  write('warn', 'authz_denied', { reason, ...fields });
};
