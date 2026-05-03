export type SplitAllocation = {
  participant: string;
  ratio: number;
  amount: number;
};

export type SplitType = 'Personal' | 'Shared' | 'Custom';

export type ExpenseFlow = 'Outgoing' | 'Incoming';

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

export type CreateExpenseInput = {
  title: string;
  amount: number;
  transactionDate: string;
  category: string;
  expenseGroup?: string;
  split: SplitType;
  splitDetails?: Array<{
    participant: string;
    ratio: number;
  }>;
  groupId?: string;
  paidByUserId?: string;
  isPrivate?: boolean;
  /** ISO 4217 code; only DKK is accepted. */
  currency?: string;
  flow?: ExpenseFlow;
};

export type DeleteExpenseInput = {
  id: string;
};

export type UpdateExpenseInput = {
  id: string;
  title: string;
  amount: number;
  transactionDate: string;
  category: string;
  expenseGroup?: string;
  split: SplitType;
  splitDetails?: Array<{
    participant: string;
    ratio: number;
  }>;
  groupId?: string;
  paidByUserId?: string;
  isPrivate?: boolean;
  currency?: string;
  flow?: ExpenseFlow;
};
