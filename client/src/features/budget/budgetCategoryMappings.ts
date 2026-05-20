import { buildExpenseCategoryOptions, toBudgetTopLevelCategory } from '../expenses/categories';
import type { Expense } from '../../graphql/operationTypes';

/** Normalized key for an expense category label (matches mapping storage). */
export const expenseCategoryMappingKey = (expenseCategory: string): string =>
  expenseCategory
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export type BudgetCategoryMappings = Record<string, string>;

/** Resolve which budget line an expense category counts toward. */
export const resolveBudgetCategory = (
  expenseCategory: string,
  userMappings: BudgetCategoryMappings = {},
): string => {
  const key = expenseCategoryMappingKey(expenseCategory);
  const mapped = userMappings[key]?.trim();
  if (mapped) {
    return mapped;
  }
  return toBudgetTopLevelCategory(expenseCategory);
};

/** Every default expense label, saved customs, and any category already used on outgoing expenses. */
export const collectAllExpenseCategoriesForMapping = (
  expenses: Expense[],
  extraLabels: readonly string[] = [],
): string[] => buildExpenseCategoryOptions(expenses, extraLabels);

/** @deprecated Use collectAllExpenseCategoriesForMapping */
export const collectExpenseCategoriesForMapping = collectAllExpenseCategoriesForMapping;

/** Drop empty entries and mappings that match the built-in default. */
export const sanitizeBudgetCategoryMappings = (
  draft: BudgetCategoryMappings,
): BudgetCategoryMappings => {
  const out: BudgetCategoryMappings = {};
  for (const [key, rawBudget] of Object.entries(draft)) {
    const budget = rawBudget.trim();
    if (!key || !budget || budget.length > 64) {
      continue;
    }
    const defaultBudget = toBudgetTopLevelCategory(key);
    if (budget !== defaultBudget) {
      out[key] = budget;
    }
  }
  return out;
};

export const mappingsFromExpenseLabels = (
  labels: string[],
  getBudgetForLabel: (expenseLabel: string) => string,
): BudgetCategoryMappings => {
  const out: BudgetCategoryMappings = {};
  for (const label of labels) {
    const key = expenseCategoryMappingKey(label);
    const budget = getBudgetForLabel(label).trim();
    if (budget) {
      out[key] = budget;
    }
  }
  return sanitizeBudgetCategoryMappings(out);
};
