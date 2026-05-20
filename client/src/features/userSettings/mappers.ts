import type { BudgetAssumptions, MonthCategoryBudgets } from '../budget/storage';
import type { BudgetCategoryMappings } from '../budget/budgetCategoryMappings';
import type { ImportMerchantRule, SavedColumnMapping } from '../import/types';

export type UserWorkspaceSettingsData = {
  budgetAssumptions: BudgetAssumptions;
  categoryBudgetDefaults: MonthCategoryBudgets;
  monthCategoryBudgets: MonthCategoryBudgets;
  budgetCustomCategories: string[];
  budgetCategoryMappings: BudgetCategoryMappings;
  importMerchantRules: ImportMerchantRule[];
  importColumnMappings: Record<string, SavedColumnMapping>;
  importCustomCategories: string[];
};

const entriesToMonthBudgets = (rows: Array<{ category: string; amount: number }>): MonthCategoryBudgets => {
  const monthCategoryBudgets: MonthCategoryBudgets = {};
  for (const row of rows) {
    if (row.category.trim()) {
      monthCategoryBudgets[row.category] = row.amount;
    }
  }
  return monthCategoryBudgets;
};

export const mapWorkspaceSettingsFromApi = (raw: {
  budgetAssumptions: BudgetAssumptions;
  categoryBudgetDefaults?: Array<{ category: string; amount: number }>;
  monthCategoryBudgets: Array<{ category: string; amount: number }>;
  budgetCustomCategories?: string[];
  budgetCategoryMappings?: Array<{ expenseCategory: string; budgetCategory: string }>;
  importMerchantRules: ImportMerchantRule[];
  importColumnMappings: Array<SavedColumnMapping & { signature: string }>;
  importCustomCategories: string[];
}): UserWorkspaceSettingsData => {
  const fromDefaults = entriesToMonthBudgets(raw.categoryBudgetDefaults ?? []);
  const fromMonth = entriesToMonthBudgets(raw.monthCategoryBudgets);
  const categoryBudgetDefaults =
    Object.keys(fromDefaults).length > 0 ? fromDefaults : fromMonth;
  const monthCategoryBudgets = categoryBudgetDefaults;

  const importColumnMappings: Record<string, SavedColumnMapping> = {};
  for (const row of raw.importColumnMappings) {
    const { signature, ...mapping } = row;
    importColumnMappings[signature] = mapping;
  }

  const budgetCategoryMappings: BudgetCategoryMappings = {};
  for (const row of raw.budgetCategoryMappings ?? []) {
    if (row.expenseCategory.trim() && row.budgetCategory.trim()) {
      budgetCategoryMappings[row.expenseCategory] = row.budgetCategory;
    }
  }

  return {
    budgetAssumptions: raw.budgetAssumptions,
    categoryBudgetDefaults,
    monthCategoryBudgets,
    budgetCustomCategories: raw.budgetCustomCategories ?? [],
    budgetCategoryMappings,
    importMerchantRules: raw.importMerchantRules.map((rule) => ({
      ...rule,
      flow: rule.flow === 'in' ? 'in' : 'out',
      matchType: rule.matchType === 'contains' ? 'contains' : 'exact',
    })),
    importColumnMappings,
    importCustomCategories: raw.importCustomCategories,
  };
};

export const monthBudgetsToInput = (yearMonth: string, budgets: MonthCategoryBudgets) => ({
  yearMonth,
  budgets: Object.entries(budgets).map(([category, amount]) => ({ category, amount })),
});

export const categoryBudgetDefaultsToInput = (budgets: MonthCategoryBudgets) =>
  Object.entries(budgets).map(([category, amount]) => ({ category, amount }));

export const categoryMappingsToInput = (mappings: BudgetCategoryMappings) =>
  Object.entries(mappings).map(([expenseCategory, budgetCategory]) => ({
    expenseCategory,
    budgetCategory,
  }));

export const columnMappingsToInput = (mappings: Record<string, SavedColumnMapping>) =>
  Object.entries(mappings).map(([signature, mapping]) => ({
    signature,
    ...mapping,
  }));
