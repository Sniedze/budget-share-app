export type SplitType = 'Personal' | 'Shared' | 'Custom';

export type SplitAllocation = {
  participant: string;
  ratio: number;
  amount: number;
};

export type SplitAllocationInput = {
  participant: string;
  ratio: number;
};

export type Expense = {
  id: string;
  title: string;
  amount: number;
  createdAt: string;
  transactionDate: string;
  category: string;
  split: SplitType;
  splitDetails: SplitAllocation[];
};

export type GetExpensesResponse = {
  expenses: Expense[];
};

export type AddExpenseInput = {
  title: string;
  amount: number;
  transactionDate: string;
  category: string;
  split: SplitType;
  splitDetails?: SplitAllocationInput[];
};

export type UpdateExpenseInput = {
  id: string;
  title: string;
  amount: number;
  transactionDate: string;
  category: string;
  split: SplitType;
  splitDetails?: SplitAllocationInput[];
};
