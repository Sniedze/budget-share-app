import { APP_CURRENCY_CODE, normalizeStatementCurrency } from '../../format/currency';
import type { SplitType } from '../expenses';
import { categoryHistoryKey } from './columnMapping';
import type { ImportedRow } from './types';

export const rowNeedsManualAdjustment = (row: ImportedRow): boolean => {
  if (!row.transactionDate || !row.category || Number(row.amount) <= 0) {
    return true;
  }
  if (row.duplicateType !== 'none') {
    return true;
  }
  if (normalizeStatementCurrency(row.currency) !== APP_CURRENCY_CODE) {
    return true;
  }
  if (row.flow === 'out' && row.split === 'Shared' && (!row.groupId || !row.expenseGroup)) {
    return true;
  }
  return false;
};

export const sortRowsForInitialReview = (inputRows: ImportedRow[]): ImportedRow[] =>
  inputRows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftNeeds = rowNeedsManualAdjustment(left.row);
      const rightNeeds = rowNeedsManualAdjustment(right.row);
      if (leftNeeds !== rightNeeds) {
        return leftNeeds ? -1 : 1;
      }
      const leftConfidence =
        left.row.confidence === 'low' ? 0 : left.row.confidence === 'medium' ? 1 : 2;
      const rightConfidence =
        right.row.confidence === 'low' ? 0 : right.row.confidence === 'medium' ? 1 : 2;
      if (leftConfidence !== rightConfidence) {
        return leftConfidence - rightConfidence;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.row);

export type SharedCategoryHistory = Map<string, { groupId: string; expenseGroup: string }>;

export const createApplySharedCategoryDefaults = (
  sharedCategoryHistory: SharedCategoryHistory,
  expenseGroupByHousehold: Map<string, string[]>,
) => {
  return (row: ImportedRow): ImportedRow => {
    if (row.flow === 'in') {
      return { ...row, split: 'Personal', groupId: '', expenseGroup: '' };
    }
    if (row.split !== 'Shared') {
      return row;
    }
    const categoryKey = categoryHistoryKey(row.category);
    const history = sharedCategoryHistory.get(categoryKey);
    let nextGroupId = row.groupId;
    let nextExpenseGroup = row.expenseGroup;

    if (!nextGroupId && history?.groupId) {
      nextGroupId = history.groupId;
    }

    const groupOptions = nextGroupId ? expenseGroupByHousehold.get(nextGroupId) ?? [] : [];
    const matchedByCategory = groupOptions.find(
      (option) => option.trim().toLowerCase() === categoryKey,
    );
    if (!nextExpenseGroup && matchedByCategory) {
      nextExpenseGroup = matchedByCategory;
    }

    if (!nextExpenseGroup && history && history.groupId === nextGroupId) {
      const matchedByHistory = groupOptions.find(
        (option) => option.trim().toLowerCase() === history.expenseGroup.trim().toLowerCase(),
      );
      if (matchedByHistory) {
        nextExpenseGroup = matchedByHistory;
      }
    }

    if (nextGroupId === row.groupId && nextExpenseGroup === row.expenseGroup) {
      return row;
    }

    return {
      ...row,
      groupId: nextGroupId,
      expenseGroup: nextExpenseGroup,
    };
  };
};

export type MerchantHistoryEntry = {
  category: string;
  split: SplitType;
  groupId: string;
  expenseGroup: string;
  transactionDate: string;
};
