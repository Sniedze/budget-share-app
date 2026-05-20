import { loadAssumptions, loadMonthBudgets, type BudgetAssumptions, type MonthCategoryBudgets } from '../budget/storage';
import { loadCustomImportCategories, loadMerchantRules, loadSavedMappings } from '../import/importStorage';
import type { ImportMerchantRule, SavedColumnMapping } from '../import/types';
import {
  budgetAssumptionsKey,
  budgetMonthBudgetsKey,
  IMPORT_COLUMN_MAPPING_STORAGE_KEY,
  IMPORT_CUSTOM_CATEGORIES_STORAGE_KEY,
  IMPORT_MERCHANT_RULES_STORAGE_KEY,
} from './workspaceStorageKeys';
import { removeFromStorage } from '../../lib/localStorageJson';
import type { SaveUserWorkspaceSettingsInput } from './saveInput';

export type LocalWorkspaceSnapshot = {
  budgetAssumptions: BudgetAssumptions;
  monthCategoryBudgets: MonthCategoryBudgets;
  budgetCustomCategories: string[];
  budgetCategoryMappings: Record<string, string>;
  importMerchantRules: ImportMerchantRule[];
  importColumnMappings: Record<string, SavedColumnMapping>;
  importCustomCategories: string[];
};

export const readLocalWorkspaceSnapshot = (userId: string, yearMonth: string): LocalWorkspaceSnapshot => ({
  budgetAssumptions: loadAssumptions(userId),
  monthCategoryBudgets: loadMonthBudgets(userId, yearMonth),
  budgetCustomCategories: [],
  budgetCategoryMappings: {},
  importMerchantRules: loadMerchantRules(),
  importColumnMappings: loadSavedMappings(),
  importCustomCategories: loadCustomImportCategories(),
});

export const buildMigrateLocalWorkspaceInput = (
  snapshot: LocalWorkspaceSnapshot,
  yearMonth: string,
): SaveUserWorkspaceSettingsInput => ({
  budgetAssumptions: snapshot.budgetAssumptions,
  monthCategoryBudgets: {
    yearMonth,
    budgets: snapshot.monthCategoryBudgets,
  },
  budgetCustomCategories: snapshot.budgetCustomCategories,
  budgetCategoryMappings: snapshot.budgetCategoryMappings,
  importMerchantRules: snapshot.importMerchantRules,
  importColumnMappings: snapshot.importColumnMappings,
  importCustomCategories: snapshot.importCustomCategories,
});

export const clearLocalWorkspaceStorage = (userId: string, yearMonth: string): void => {
  removeFromStorage(budgetAssumptionsKey(userId));
  removeFromStorage(budgetMonthBudgetsKey(userId, yearMonth));
  removeFromStorage(IMPORT_MERCHANT_RULES_STORAGE_KEY);
  removeFromStorage(IMPORT_COLUMN_MAPPING_STORAGE_KEY);
  removeFromStorage(IMPORT_CUSTOM_CATEGORIES_STORAGE_KEY);
};

export const isWorkspaceSettingsEmpty = (settings: {
  budgetAssumptions: BudgetAssumptions;
  monthCategoryBudgets: MonthCategoryBudgets;
  budgetCustomCategories: string[];
  budgetCategoryMappings: Record<string, string>;
  importMerchantRules: ImportMerchantRule[];
  importColumnMappings: Record<string, SavedColumnMapping>;
  importCustomCategories: string[];
}): boolean => {
  const assumptionsDefault =
    settings.budgetAssumptions.startingBalance === 0 &&
    settings.budgetAssumptions.monthlyIncomeEstimate === 0;
  return (
    assumptionsDefault &&
    Object.keys(settings.monthCategoryBudgets).length === 0 &&
    settings.budgetCustomCategories.length === 0 &&
    Object.keys(settings.budgetCategoryMappings).length === 0 &&
    settings.importMerchantRules.length === 0 &&
    Object.keys(settings.importColumnMappings).length === 0 &&
    settings.importCustomCategories.length === 0
  );
};
