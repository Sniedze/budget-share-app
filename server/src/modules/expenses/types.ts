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
};
