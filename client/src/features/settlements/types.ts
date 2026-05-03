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

export type GetHouseholdSettlementsResponse = {
  householdSettlements: HouseholdSettlement[];
};
