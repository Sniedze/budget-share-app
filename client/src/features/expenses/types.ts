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
  expenseGroup?: string;
  split: SplitType;
  splitDetails: SplitAllocation[];
  groupId?: string;
  createdByUserId?: string;
  paidByUserId?: string;
};

export type GetExpensesResponse = {
  expenses: Expense[];
};

export type AddExpenseInput = {
  title: string;
  amount: number;
  transactionDate: string;
  category: string;
  expenseGroup?: string;
  split: SplitType;
  splitDetails?: SplitAllocationInput[];
  groupId?: string;
  paidByUserId?: string;
};

export type UpdateExpenseInput = {
  id: string;
  title: string;
  amount: number;
  transactionDate: string;
  category: string;
  expenseGroup?: string;
  split: SplitType;
  splitDetails?: SplitAllocationInput[];
  groupId?: string;
  paidByUserId?: string;
};
