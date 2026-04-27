import type { CreateExpenseInput, Expense } from './types.js';
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
