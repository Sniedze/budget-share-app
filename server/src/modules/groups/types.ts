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

export type Group = {
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

export type UpdateGroupInput = {
  id: string;
  name: string;
  description?: string;
  members: GroupMember[];
};

export type GroupInvitationStatus = 'Pending' | 'Accepted';

export type GroupInvitation = {
  id: string;
  groupId: string;
  groupName: string;
  email: string;
  status: GroupInvitationStatus;
  invitedAt: string;
  acceptedAt?: string;
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

export type UpsertSplitTemplateInput = {
  groupId: string;
  category: string;
  templateName: string;
  splitDetails: Array<{
    participant: string;
    ratio: number;
  }>;
};

export type SettlementBalance = {
  memberName: string;
  amount: number;
};

export type SettlementTransfer = {
  fromMember: string;
  toMember: string;
  amount: number;
};

export type ExpenseGroupSettlement = {
  expenseGroup: string;
  totalExpenses: number;
  balances: SettlementBalance[];
  transfers: SettlementTransfer[];
};

export type SettlementPayment = {
  id: string;
  groupId: string;
  expenseGroup?: string;
  fromMember: string;
  toMember: string;
  amount: number;
  note?: string;
  settledAt: string;
};

export type HouseholdSettlement = {
  groupId: string;
  groupName: string;
  balances: SettlementBalance[];
  transfers: SettlementTransfer[];
  expenseGroups: ExpenseGroupSettlement[];
  payments: SettlementPayment[];
};

export type RecordSettlementPaymentInput = {
  groupId: string;
  expenseGroup?: string;
  fromMember: string;
  toMember: string;
  amount: number;
  note?: string;
  settledAt: string;
};
