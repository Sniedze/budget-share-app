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
    expense_group VARCHAR(64) NULL,
    split_type VARCHAR(16) NOT NULL DEFAULT 'Personal',
    split_details JSON NULL,
    group_id INT NULL,
    created_by_user_id INT NULL,
    paid_by_user_id INT NULL,
    transaction_dedup_hash CHAR(64) NULL,
    UNIQUE KEY uniq_expense_creator_dedup (created_by_user_id, transaction_dedup_hash)
  )
    `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS \`groups\` (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
    `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
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
      FOREIGN KEY (group_id) REFERENCES \`groups\`(id)
      ON DELETE CASCADE
  )
    `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS group_invitations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id INT NOT NULL,
    email VARCHAR(255) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'Pending',
    invited_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP NULL,
    UNIQUE KEY uniq_group_invitation_email (group_id, email),
    CONSTRAINT fk_group_invitations_group
      FOREIGN KEY (group_id) REFERENCES \`groups\`(id)
      ON DELETE CASCADE
  )
    `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS group_split_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id INT NOT NULL,
    category VARCHAR(64) NOT NULL,
    template_name VARCHAR(128) NOT NULL,
    split_details JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_group_template_category (group_id, category),
    CONSTRAINT fk_group_split_templates_group
      FOREIGN KEY (group_id) REFERENCES \`groups\`(id)
      ON DELETE CASCADE
  )
    `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settlement_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id INT NOT NULL,
    expense_group VARCHAR(64) NULL,
    from_member VARCHAR(255) NOT NULL,
    to_member VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    note VARCHAR(500) NULL,
    settled_at DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_settlement_payments_group
      FOREIGN KEY (group_id) REFERENCES \`groups\`(id)
      ON DELETE CASCADE
  )
    `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    actor_user_id INT NULL,
    actor_email VARCHAR(255) NOT NULL,
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    before_state JSON NULL,
    after_state JSON NULL,
    metadata JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
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
          AND COLUMN_NAME IN ('created_at', 'transaction_date', 'category', 'expense_group', 'split_type', 'split_details', 'group_id', 'created_by_user_id', 'paid_by_user_id', 'transaction_dedup_hash')
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

  if (!existingColumns.has('expense_group')) {
    await db.execute(`
        ALTER TABLE expenses
        ADD COLUMN expense_group VARCHAR(64) NULL
      `);
    await db.execute(`
        UPDATE expenses
        SET expense_group = category
        WHERE group_id IS NOT NULL
          AND (expense_group IS NULL OR expense_group = '')
      `);
  }

  if (!existingColumns.has('split_details')) {
    await db.execute(`
        ALTER TABLE expenses
        ADD COLUMN split_details JSON NULL
      `);
  }

  if (!existingColumns.has('group_id')) {
    await db.execute(`
        ALTER TABLE expenses
        ADD COLUMN group_id INT NULL
      `);
  }

  if (!existingColumns.has('created_by_user_id')) {
    await db.execute(`
        ALTER TABLE expenses
        ADD COLUMN created_by_user_id INT NULL
      `);
  }

  if (!existingColumns.has('paid_by_user_id')) {
    await db.execute(`
        ALTER TABLE expenses
        ADD COLUMN paid_by_user_id INT NULL
      `);
  }

  if (!existingColumns.has('transaction_dedup_hash')) {
    await db.execute(`
        ALTER TABLE expenses
        ADD COLUMN transaction_dedup_hash CHAR(64) NULL
      `);
  }

  const [indexRows] = await db.query<RowDataPacket[]>(
    `
      SELECT INDEX_NAME AS indexName
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'expenses'
        AND INDEX_NAME = 'uniq_expense_creator_dedup'
      LIMIT 1
    `,
  );
  if (indexRows.length === 0) {
    await db.execute(`
        ALTER TABLE expenses
        ADD UNIQUE KEY uniq_expense_creator_dedup (created_by_user_id, transaction_dedup_hash)
      `);
  }
};
