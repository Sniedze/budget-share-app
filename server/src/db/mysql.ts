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
    transaction_date DATE NOT NULL,
    category VARCHAR(64) NOT NULL DEFAULT 'General',
    split_type VARCHAR(16) NOT NULL DEFAULT 'Personal',
    split_details JSON NULL
  )
    `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
    `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS group_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    ratio DECIMAL(6, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_group_member_email (group_id, email),
    CONSTRAINT fk_group_members_group
      FOREIGN KEY (group_id) REFERENCES groups(id)
      ON DELETE CASCADE
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
          AND COLUMN_NAME IN ('created_at', 'transaction_date', 'category', 'split_type', 'split_details')
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

  if (!existingColumns.has('category')) {
    await db.execute(`
        ALTER TABLE expenses
        ADD COLUMN category VARCHAR(64) NULL
      `);
    await db.execute(`
        UPDATE expenses
        SET category = 'General'
        WHERE category IS NULL OR category = ''
      `);
    await db.execute(`
        ALTER TABLE expenses
        MODIFY COLUMN category VARCHAR(64) NOT NULL
      `);
  }

  if (!existingColumns.has('split_type')) {
    await db.execute(`
        ALTER TABLE expenses
        ADD COLUMN split_type VARCHAR(16) NULL
      `);
    await db.execute(`
        UPDATE expenses
        SET split_type = 'Personal'
        WHERE split_type IS NULL OR split_type = ''
      `);
    await db.execute(`
        ALTER TABLE expenses
        MODIFY COLUMN split_type VARCHAR(16) NOT NULL
      `);
  }

  if (!existingColumns.has('split_details')) {
    await db.execute(`
        ALTER TABLE expenses
        ADD COLUMN split_details JSON NULL
      `);
  }
};
