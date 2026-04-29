export type GroupMember = {
  name: string;
  email: string;
  ratio: number;
};

export type GroupExpense = {
  date: string;
  expenseGroup?: string;
  category: string;
  description: string;
  paidBy: string;
  total: number;
  yourShare: number;
};

export type GroupSummary = {
  id: string;
  name: string;
  description?: string;
  members: GroupMember[];
  totalSpent: number;
  yourShare: number;
  expenses: GroupExpense[];
};

export type CreateGroupInput = {
  name: string;
  description?: string;
  members: GroupMember[];
};

export type SplitTemplate = {
  id: string;
  groupId: string;
  category: string;
  templateName: string;
  splitDetails: Array<{
    participant: string;
    ratio: number;
  }>;
};
