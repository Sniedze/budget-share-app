export type GroupMember = {
  name: string;
  email: string;
  ratio: number;
};

export type GroupExpense = {
  date: string;
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
