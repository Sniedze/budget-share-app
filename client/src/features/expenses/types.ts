export type SplitType = 'Personal' | 'Shared' | 'Custom';

export type ExpenseFlow = 'Outgoing' | 'Incoming';

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
  currency: string;
  createdAt: string;
  transactionDate: string;
  category: string;
  expenseGroup?: string;
  split: SplitType;
  splitDetails: SplitAllocation[];
  groupId?: string;
  createdByUserId?: string;
  paidByUserId?: string;
  isPrivate: boolean;
  flow: ExpenseFlow;
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
  isPrivate?: boolean;
  currency?: string;
  flow?: ExpenseFlow;
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
  isPrivate?: boolean;
  currency?: string;
  flow?: ExpenseFlow;
};
