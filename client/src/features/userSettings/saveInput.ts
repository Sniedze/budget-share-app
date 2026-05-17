import type { BudgetAssumptions, MonthCategoryBudgets } from '../budget/storage';
import type { ImportMerchantRule, SavedColumnMapping } from '../import/types';
import { columnMappingsToInput, monthBudgetsToInput } from './mappers';

export type SaveUserWorkspaceSettingsInput = {
  budgetAssumptions?: BudgetAssumptions;
  monthCategoryBudgets?: { yearMonth: string; budgets: MonthCategoryBudgets };
  importMerchantRules?: ImportMerchantRule[];
  importColumnMappings?: Record<string, SavedColumnMapping>;
  importCustomCategories?: string[];
};

export const toGraphqlSaveInput = (patch: SaveUserWorkspaceSettingsInput) => ({
  budgetAssumptions: patch.budgetAssumptions,
  monthCategoryBudgets: patch.monthCategoryBudgets
    ? monthBudgetsToInput(patch.monthCategoryBudgets.yearMonth, patch.monthCategoryBudgets.budgets)
    : undefined,
  importMerchantRules: patch.importMerchantRules,
  importColumnMappings: patch.importColumnMappings
    ? columnMappingsToInput(patch.importColumnMappings)
    : undefined,
  importCustomCategories: patch.importCustomCategories,
});
