import type { CreateExpenseInput, Expense } from './types.js';
import { db } from '../../db/mysql.js';
import type { ResultSetHeader } from 'mysql2';

type ExpenseRow = {
  id: number;
  title: string;
  amount: string;
};

const expenses: Expense[] = [
  { id: '1', title: 'Groceries', amount: 54.2 },
  { id: '2', title: 'Electricity', amount: 89.99 },
];

export const listExpenses = async (): Promise<Expense[]> => {
  const [rows] = await db.query<ExpenseRow[]>(
    'SELECT id, title, amount FROM expenses ORDER BY id ASC',
  );

  return rows.map((row) => ({
    id: String(row.id),
    title: row.title,
    amount: Number(row.amount),
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
  };
};
