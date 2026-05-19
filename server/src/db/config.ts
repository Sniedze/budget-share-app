const isDevelopment = (process.env.NODE_ENV ?? 'development') === 'development';

const firstEnv = (...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
};

const requireDbEnv = (label: string, ...keys: string[]): string => {
  const value = firstEnv(...keys);
  if (value) {
    return value;
  }
  throw new Error(`${label} must be set`);
};

export const resolveDbConfig = (): {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
} => {
  const user = firstEnv('DB_USER', 'MYSQL_USER');
  const password = firstEnv('DB_PASSWORD', 'MYSQL_PASSWORD');
  const database = firstEnv('DB_NAME', 'MYSQL_DATABASE');

  if (isDevelopment) {
    return {
      host: process.env.DB_HOST?.trim() || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: user || 'budget_user',
      password: password || 'budget_password',
      database: database || 'budget_app',
    };
  }

  return {
    host: process.env.DB_HOST?.trim() || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: requireDbEnv('DB_USER', 'DB_USER', 'MYSQL_USER'),
    password: requireDbEnv('DB_PASSWORD', 'DB_PASSWORD', 'MYSQL_PASSWORD'),
    database: requireDbEnv('DB_NAME', 'DB_NAME', 'MYSQL_DATABASE'),
  };
};
