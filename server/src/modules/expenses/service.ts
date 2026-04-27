import type { CreateExpenseInput, Expense, UpdateExpenseInput } from './types.js';
import { db } from '../../db/mysql.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

type ExpenseRow = {
  id: number;
  title: string;
  amount: string;
  created_at: Date;
} & RowDataPacket;

export const listExpenses = async (): Promise<Expense[]> => {
  const [rows] = await db.query<ExpenseRow[]>(
    'SELECT id, title, amount, created_at FROM expenses ORDER BY created_at DESC, id DESC',
  );

  return rows.map((row) => ({
    id: String(row.id),
    title: row.title,
    amount: Number(row.amount),
    createdAt: row.created_at.toISOString(),
  }));
};

export const createExpense = async (input: CreateExpenseInput): Promise<Expense> => {
  const [result] = await db.execute<ResultSetHeader>(
    'INSERT INTO expenses (title, amount) VALUES (?, ?)',
    [input.title, input.amount],
  );

  return {
    id: String(result.insertId),
    title: input.title,
    amount: input.amount,
    createdAt: new Date().toISOString(),
  };
};

export const deleteExpense = async (id: string): Promise<boolean> => {
  const [result] = await db.execute<ResultSetHeader>('DELETE FROM expenses WHERE id = ?', [id]);

  return result.affectedRows > 0;
};

export const updateExpense = async (input: UpdateExpenseInput): Promise<Expense | null> => {
  const [updateResult] = await db.execute<ResultSetHeader>(
    'UPDATE expenses SET title = ?, amount = ? WHERE id = ?',
    [input.title, input.amount, input.id],
  );

  if (updateResult.affectedRows === 0) {
    return null;
  }

  const [rows] = await db.query<ExpenseRow[]>(
    'SELECT id, title, amount, created_at FROM expenses WHERE id = ? LIMIT 1',
    [input.id],
  );

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    title: row.title,
    amount: Number(row.amount),
    createdAt: row.created_at.toISOString(),
  };
};
