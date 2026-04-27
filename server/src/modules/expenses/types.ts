export type Expense = {
  id: string;
  title: string;
  amount: number;
  createdAt: string;
};

export type CreateExpenseInput = {
  title: string;
  amount: number;
};

export type DeleteExpenseInput = {
  id: string;
};
