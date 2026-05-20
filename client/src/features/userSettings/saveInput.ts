import type { BudgetAssumptions, MonthCategoryBudgets } from '../budget/storage';
import type { ImportMerchantRule, SavedColumnMapping } from '../import/types';
import {
  categoryBudgetDefaultsToInput,
  categoryMappingsToInput,
  columnMappingsToInput,
  monthBudgetsToInput,
} from './mappers';
import type { BudgetCategoryMappings } from '../budget/budgetCategoryMappings';

export type SaveUserWorkspaceSettingsInput = {
  budgetAssumptions?: BudgetAssumptions;
  categoryBudgetDefaults?: MonthCategoryBudgets;
  monthCategoryBudgets?: { yearMonth: string; budgets: MonthCategoryBudgets };
  budgetCustomCategories?: string[];
  budgetCategoryMappings?: BudgetCategoryMappings;
  importMerchantRules?: ImportMerchantRule[];
  importColumnMappings?: Record<string, SavedColumnMapping>;
  importCustomCategories?: string[];
};

export const toGraphqlSaveInput = (patch: SaveUserWorkspaceSettingsInput) => ({
  budgetAssumptions: patch.budgetAssumptions,
  categoryBudgetDefaults: patch.categoryBudgetDefaults
    ? categoryBudgetDefaultsToInput(patch.categoryBudgetDefaults)
    : undefined,
  monthCategoryBudgets: patch.monthCategoryBudgets
    ? monthBudgetsToInput(patch.monthCategoryBudgets.yearMonth, patch.monthCategoryBudgets.budgets)
    : undefined,
  budgetCustomCategories: patch.budgetCustomCategories,
  budgetCategoryMappings: patch.budgetCategoryMappings
    ? categoryMappingsToInput(patch.budgetCategoryMappings)
    : undefined,
  importMerchantRules: patch.importMerchantRules,
  importColumnMappings: patch.importColumnMappings
    ? columnMappingsToInput(patch.importColumnMappings)
    : undefined,
  importCustomCategories: patch.importCustomCategories,
});
