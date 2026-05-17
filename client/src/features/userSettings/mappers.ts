import type { BudgetAssumptions, MonthCategoryBudgets } from '../budget/storage';
import type { ImportMerchantRule, SavedColumnMapping } from '../import/types';

export type UserWorkspaceSettingsData = {
  budgetAssumptions: BudgetAssumptions;
  monthCategoryBudgets: MonthCategoryBudgets;
  importMerchantRules: ImportMerchantRule[];
  importColumnMappings: Record<string, SavedColumnMapping>;
  importCustomCategories: string[];
};

export const mapWorkspaceSettingsFromApi = (raw: {
  budgetAssumptions: BudgetAssumptions;
  monthCategoryBudgets: Array<{ category: string; amount: number }>;
  importMerchantRules: ImportMerchantRule[];
  importColumnMappings: Array<SavedColumnMapping & { signature: string }>;
  importCustomCategories: string[];
}): UserWorkspaceSettingsData => {
  const monthCategoryBudgets: MonthCategoryBudgets = {};
  for (const row of raw.monthCategoryBudgets) {
    if (row.category.trim()) {
      monthCategoryBudgets[row.category] = row.amount;
    }
  }

  const importColumnMappings: Record<string, SavedColumnMapping> = {};
  for (const row of raw.importColumnMappings) {
    const { signature, ...mapping } = row;
    importColumnMappings[signature] = mapping;
  }

  return {
    budgetAssumptions: raw.budgetAssumptions,
    monthCategoryBudgets,
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

export const columnMappingsToInput = (mappings: Record<string, SavedColumnMapping>) =>
  Object.entries(mappings).map(([signature, mapping]) => ({
    signature,
    ...mapping,
  }));
