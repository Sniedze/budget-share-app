import type { CreateExpenseInput, Expense } from './types.js';

const expenses: Expense[] = [
  { id: '1', title: 'Groceries', amount: 54.2 },
  { id: '2', title: 'Electricity', amount: 89.99 },
];

export const listExpenses = (): Expense[] => {
  return expenses;
};

export const createExpense = (input: CreateExpenseInput): Expense => {
  const newExpense: Expense = {
    id: String(expenses.length + 1),
    title: input.title,
    amount: input.amount,
  };

  expenses.push(newExpense);

  return newExpense;
};
