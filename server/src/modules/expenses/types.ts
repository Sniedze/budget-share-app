export type Expense = {
  id: string;
  title: string;
  amount: number;
};

export type CreateExpenseInput = {
  title: string;
  amount: number;
};
