export type Expense = {
  id: string;
  title: string;
  amount: number;
  createdAt: string;
  transactionDate: string;
  category: string;
  split: string;
};

export type GetExpensesResponse = {
  expenses: Expense[];
};

export type AddExpenseInput = {
  title: string;
  amount: number;
  transactionDate: string;
  category: string;
  split: string;
};

export type UpdateExpenseInput = {
  id: string;
  title: string;
  amount: number;
  transactionDate: string;
  category: string;
  split: string;
};
