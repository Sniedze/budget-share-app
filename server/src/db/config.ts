const isDevelopment = (process.env.NODE_ENV ?? 'development') === 'development';

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be set`);
  }
  return value;
};

export const resolveDbConfig = (): {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
} => ({
  host: process.env.DB_HOST?.trim() || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: isDevelopment ? (process.env.DB_USER?.trim() || 'budget_user') : requiredEnv('DB_USER'),
  password: isDevelopment
    ? (process.env.DB_PASSWORD?.trim() || 'budget_password')
    : requiredEnv('DB_PASSWORD'),
  database: isDevelopment ? (process.env.DB_NAME?.trim() || 'budget_app') : requiredEnv('DB_NAME'),
});
