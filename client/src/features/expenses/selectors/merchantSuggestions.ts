import { isOutgoingExpense } from '../flow';
import type { Expense } from '../types';

export type MerchantSuggestion = {
  merchant: string;
  category: string;
  expenseGroup?: string;
};

export const buildMerchantSuggestions = (expenses: Expense[]): Map<string, MerchantSuggestion> => {
  const lookup = new Map<string, MerchantSuggestion>();
  [...expenses]
    .filter(isOutgoingExpense)
    .sort((left, right) => right.transactionDate.localeCompare(left.transactionDate))
    .forEach((expense) => {
      const merchant = expense.title.trim();
      const normalized = merchant.toLowerCase();
      if (!merchant || lookup.has(normalized)) {
        return;
      }
      lookup.set(normalized, {
        merchant,
        category: expense.category,
        expenseGroup: expense.expenseGroup ?? expense.category,
      });
    });
  return lookup;
};
