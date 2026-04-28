export type Expense = {
  id: string;
  title: string;
  amount: number;
  createdAt: string;
  transactionDate: string;
};

export type GetExpensesResponse = {
  expenses: Expense[];
};

export type AddExpenseInput = {
  title: string;
  amount: number;
  transactionDate: string;
};

export type UpdateExpenseInput = {
  id: string;
  title: string;
  amount: number;
  transactionDate: string;
};
