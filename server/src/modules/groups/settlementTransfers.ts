import { roundCents } from '../../lib/money.js';

export type SettlementBalance = {
  memberName: string;
  amount: number;
};

export type SettlementTransfer = {
  fromMember: string;
  toMember: string;
  amount: number;
};

/** Greedy minimum-transfers settlement from net balances. */
export const buildOptimizedTransfers = (balances: SettlementBalance[]): SettlementTransfer[] => {
  const creditors = balances
    .filter((entry) => entry.amount > 0.01)
    .map((entry) => ({ ...entry }));
  const debtors = balances
    .filter((entry) => entry.amount < -0.01)
    .map((entry) => ({ memberName: entry.memberName, amount: Math.abs(entry.amount) }));
  const transfers: SettlementTransfer[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = roundCents(Math.min(creditor.amount, debtor.amount));
    if (amount <= 0) {
      break;
    }
    transfers.push({
      fromMember: debtor.memberName,
      toMember: creditor.memberName,
      amount,
    });
    creditor.amount = roundCents(creditor.amount - amount);
    debtor.amount = roundCents(debtor.amount - amount);
    if (creditor.amount <= 0.01) {
      creditorIndex += 1;
    }
    if (debtor.amount <= 0.01) {
      debtorIndex += 1;
    }
  }

  return transfers;
};
