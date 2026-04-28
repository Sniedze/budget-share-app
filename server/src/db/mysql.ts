import mysql from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';

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
    amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    transaction_date DATE NOT NULL
  )
    `);
};

type ColumnCheckRow = {
  columnName: string;
} & RowDataPacket;

export const migrateSchema = async (): Promise<void> => {
  const [rows] = await db.query<ColumnCheckRow[]>(
    `
        SELECT COLUMN_NAME AS columnName
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'expenses'
          AND COLUMN_NAME IN ('created_at', 'transaction_date')
      `,
  );

  const existingColumns = new Set(rows.map((row) => row.columnName));

  if (!existingColumns.has('created_at')) {
    await db.execute(`
        ALTER TABLE expenses
        ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      `);
  }

  if (!existingColumns.has('transaction_date')) {
    await db.execute(`
        ALTER TABLE expenses
        ADD COLUMN transaction_date DATE NULL
      `);
    await db.execute(`
        UPDATE expenses
        SET transaction_date = DATE(created_at)
        WHERE transaction_date IS NULL
      `);
    await db.execute(`
        ALTER TABLE expenses
        MODIFY COLUMN transaction_date DATE NOT NULL
      `);
  }
};
