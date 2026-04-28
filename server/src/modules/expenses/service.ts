import type { CreateExpenseInput, Expense, UpdateExpenseInput } from './types.js';
import { db } from '../../db/mysql.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

type ExpenseRow = {
  id: number;
  title: string;
  amount: string;
  created_at: Date | string;
  transaction_date: Date | string;
} & RowDataPacket;

const toIsoString = (value: Date | string): string => {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

export const listExpenses = async (): Promise<Expense[]> => {
  const [rows] = await db.query<ExpenseRow[]>(
    'SELECT id, title, amount, created_at, transaction_date FROM expenses ORDER BY transaction_date DESC, id DESC',
  );

  return rows.map((row) => ({
    id: String(row.id),
    title: row.title,
    amount: Number(row.amount),
    createdAt: toIsoString(row.created_at),
    transactionDate: toIsoString(row.transaction_date),
  }));
};

export const createExpense = async (input: CreateExpenseInput): Promise<Expense> => {
  const [result] = await db.execute<ResultSetHeader>(
    'INSERT INTO expenses (title, amount, transaction_date) VALUES (?, ?, ?)',
    [input.title, input.amount, input.transactionDate],
  );

  const [rows] = await db.query<ExpenseRow[]>(
    'SELECT id, title, amount, created_at, transaction_date FROM expenses WHERE id = ? LIMIT 1',
    [result.insertId],
  );

  const row = rows[0];

  if (!row) {
    return {
      id: String(result.insertId),
      title: input.title,
      amount: input.amount,
      createdAt: new Date().toISOString(),
      transactionDate: new Date(input.transactionDate).toISOString(),
    };
  }

  return {
    id: String(row.id),
    title: row.title,
    amount: Number(row.amount),
    createdAt: toIsoString(row.created_at),
    transactionDate: toIsoString(row.transaction_date),
  };
};

export const deleteExpense = async (id: string): Promise<boolean> => {
  const [result] = await db.execute<ResultSetHeader>('DELETE FROM expenses WHERE id = ?', [id]);

  return result.affectedRows > 0;
};

export const updateExpense = async (input: UpdateExpenseInput): Promise<Expense | null> => {
  const [updateResult] = await db.execute<ResultSetHeader>(
    'UPDATE expenses SET title = ?, amount = ?, transaction_date = ? WHERE id = ?',
    [input.title, input.amount, input.transactionDate, input.id],
  );

  if (updateResult.affectedRows === 0) {
    return null;
  }

  const [rows] = await db.query<ExpenseRow[]>(
    'SELECT id, title, amount, created_at, transaction_date FROM expenses WHERE id = ? LIMIT 1',
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
    createdAt: toIsoString(row.created_at),
    transactionDate: toIsoString(row.transaction_date),
  };
};
