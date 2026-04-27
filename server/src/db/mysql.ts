import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'budget_user',
  password: process.env.DB_PASSWORD || 'budget_password',
  database: process.env.DB_NAME || 'budget_app',
  waitForConnections: true,
  connectionLimit: 10,
});

export const db = pool;

export const checkDbConnection = async (): Promise<void> => {
  const connection = await db.getConnection();
  connection.release();
};

export const ensureSchema = async (): Promise<void> => {
  await db.execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL
      )
    `);
};
