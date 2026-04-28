export type SplitAllocation = {
  participant: string;
  ratio: number;
  amount: number;
};

export type SplitType = 'Personal' | 'Shared' | 'Custom';

export type Expense = {
  id: string;
  title: string;
  amount: number;
  createdAt: string;
  transactionDate: string;
  category: string;
  split: SplitType;
  splitDetails: SplitAllocation[];
  groupId?: string;
  createdByUserId?: string;
  paidByUserId?: string;
};

export type CreateExpenseInput = {
  title: string;
  amount: number;
  transactionDate: string;
  category: string;
  split: SplitType;
  splitDetails?: Array<{
    participant: string;
    ratio: number;
  }>;
  groupId?: string;
  paidByUserId?: string;
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
  split: SplitType;
  splitDetails?: Array<{
    participant: string;
    ratio: number;
  }>;
  groupId?: string;
  paidByUserId?: string;
};
