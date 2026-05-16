import { isOutgoingExpense } from '../flow';
import type { Expense, SplitAllocationInput, SplitType } from '../types';

export type MerchantSuggestion = {
  merchant: string;
  category: string;
  split: SplitType;
  groupId?: string;
  expenseGroup?: string;
  isPrivate: boolean;
  splitDetails: SplitAllocationInput[];
};

const toSplitDetails = (expense: Expense): SplitAllocationInput[] =>
  expense.splitDetails.map((detail) => ({
    participant: detail.participant,
    ratio: detail.ratio,
  }));

const toSuggestionFromExpense = (expense: Expense): MerchantSuggestion => ({
  merchant: expense.title.trim(),
  category: expense.category,
  split: expense.split,
  groupId: expense.groupId,
  expenseGroup: expense.split === 'Shared' ? (expense.expenseGroup ?? expense.category) : undefined,
  isPrivate: expense.isPrivate ?? false,
  splitDetails: toSplitDetails(expense),
});

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
      lookup.set(normalized, toSuggestionFromExpense(expense));
    });
  return lookup;
};

export type MerchantFormDefaults = {
  defaultSplitDetails: SplitAllocationInput[];
};

export type MerchantFormSuggestionPatch = {
  category: string;
  split: SplitType;
  groupId: string;
  expenseGroup: string;
  isPrivate: boolean;
  splitDetails: SplitAllocationInput[];
};

export const getMerchantSuggestionPatch = (
  suggestion: MerchantSuggestion | undefined,
  defaults: MerchantFormDefaults,
): Partial<MerchantFormSuggestionPatch> => {
  if (!suggestion) {
    return {};
  }

  if (suggestion.split === 'Shared') {
    return {
      category: suggestion.category,
      split: suggestion.split,
      groupId: suggestion.groupId ?? '',
      expenseGroup: suggestion.expenseGroup ?? '',
      isPrivate: suggestion.isPrivate,
      splitDetails: defaults.defaultSplitDetails.map((detail) => ({ ...detail })),
    };
  }

  if (suggestion.split === 'Custom') {
    const splitDetails =
      suggestion.splitDetails.length > 0
        ? suggestion.splitDetails.map((detail) => ({ ...detail }))
        : defaults.defaultSplitDetails.map((detail) => ({ ...detail }));
    return {
      category: suggestion.category,
      split: suggestion.split,
      groupId: '',
      expenseGroup: '',
      isPrivate: false,
      splitDetails,
    };
  }

  return {
    category: suggestion.category,
    split: suggestion.split,
    groupId: '',
    expenseGroup: '',
    isPrivate: false,
    splitDetails: defaults.defaultSplitDetails.map((detail) => ({ ...detail })),
  };
};

export const resolveExpenseGroupFromSuggestion = (
  suggestion: MerchantSuggestion,
  expenseGroupOptions: string[],
): string | undefined => {
  const preferred = (suggestion.expenseGroup ?? suggestion.category).trim();
  if (!preferred) {
    return undefined;
  }
  return expenseGroupOptions.find((option) => option.toLowerCase() === preferred.toLowerCase());
};
