export type Expense = {
  id: string;
  title: string;
  amount: number;
  createdAt: string;
  transactionDate: string;
};

export type CreateExpenseInput = {
  title: string;
  amount: number;
  transactionDate: string;
};

export type DeleteExpenseInput = {
  id: string;
};

export type UpdateExpenseInput = {
  id: string;
  title: string;
  amount: number;
  transactionDate: string;
};
