import { isOutgoingExpense, type Expense } from '../expenses';
import { categoryHistoryKey, merchantHistoryKey } from './columnMapping';
import { getDateSignatureVariants } from './dateParse';
import { normalizeAmountValue } from './amountParse';
import { sanitizeCellText } from './csvParse';
import type { MerchantHistoryEntry, SharedCategoryHistory } from './importRowReview';

export const buildMerchantHistory = (expenses: Expense[]): Map<string, MerchantHistoryEntry> => {
  const map = new Map<string, MerchantHistoryEntry>();
  expenses
    .slice()
    .sort((left, right) => right.transactionDate.localeCompare(left.transactionDate))
    .forEach((expense) => {
      const flow: 'out' | 'in' = isOutgoingExpense(expense) ? 'out' : 'in';
      const historyKey = merchantHistoryKey(expense.title, flow);
      if (!expense.title.trim() || map.has(historyKey)) {
        return;
      }
      map.set(historyKey, {
        category: expense.category,
        split: flow === 'out' && expense.split === 'Shared' ? 'Shared' : 'Personal',
        groupId: flow === 'out' ? expense.groupId ?? '' : '',
        expenseGroup: flow === 'out' ? expense.expenseGroup ?? '' : '',
        transactionDate: expense.transactionDate,
      });
    });
  return map;
};

export const buildSharedCategoryHistory = (expenses: Expense[]): SharedCategoryHistory => {
  const map: SharedCategoryHistory = new Map();
  expenses
    .filter((expense) => isOutgoingExpense(expense) && expense.split === 'Shared')
    .slice()
    .sort((left, right) => right.transactionDate.localeCompare(left.transactionDate))
    .forEach((expense) => {
      const key = categoryHistoryKey(expense.category);
      const groupId = (expense.groupId ?? '').trim();
      const expenseGroup = (expense.expenseGroup ?? '').trim();
      if (!key || !groupId || !expenseGroup || map.has(key)) {
        return;
      }
      map.set(key, { groupId, expenseGroup });
    });
  return map;
};

export const buildExistingExpenseSignatures = (expenses: Expense[]): Set<string> => {
  const signatures = new Set<string>();
  expenses.filter(isOutgoingExpense).forEach((expense) => {
    const merchant = sanitizeCellText(expense.title).toLowerCase();
    const amount = normalizeAmountValue(String(expense.amount)).toFixed(2);
    const dateVariants = getDateSignatureVariants(expense.transactionDate);
    if (dateVariants.length === 0) {
      signatures.add(`${merchant}||${amount}`);
      return;
    }
    dateVariants.forEach((dateVariant) => {
      signatures.add(`${merchant}|${dateVariant}|${amount}`);
    });
  });
  return signatures;
};
