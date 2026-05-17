import { loadAssumptions, loadMonthBudgets, type BudgetAssumptions, type MonthCategoryBudgets } from '../budget/storage';
import {
  IMPORT_COLUMN_MAPPING_STORAGE_KEY,
  IMPORT_CUSTOM_CATEGORIES_STORAGE_KEY,
  IMPORT_MERCHANT_RULES_STORAGE_KEY,
} from '../import/constants';
import { loadMerchantRules, loadSavedMappings } from '../import/importStorage';
import type { ImportMerchantRule, SavedColumnMapping } from '../import/types';
import type { SaveUserWorkspaceSettingsInput } from './saveInput';

export type LocalWorkspaceSnapshot = {
  budgetAssumptions: BudgetAssumptions;
  monthCategoryBudgets: MonthCategoryBudgets;
  importMerchantRules: ImportMerchantRule[];
  importColumnMappings: Record<string, SavedColumnMapping>;
  importCustomCategories: string[];
};

export const readLocalWorkspaceSnapshot = (userId: string, yearMonth: string): LocalWorkspaceSnapshot => ({
  budgetAssumptions: loadAssumptions(userId),
  monthCategoryBudgets: loadMonthBudgets(userId, yearMonth),
  importMerchantRules: loadMerchantRules(),
  importColumnMappings: loadSavedMappings(),
  importCustomCategories: (() => {
    try {
      const raw = localStorage.getItem(IMPORT_CUSTOM_CATEGORIES_STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed)
        ? parsed.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  })(),
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
  importMerchantRules: snapshot.importMerchantRules,
  importColumnMappings: snapshot.importColumnMappings,
  importCustomCategories: snapshot.importCustomCategories,
});

export const clearLocalWorkspaceStorage = (userId: string, yearMonth: string): void => {
  try {
    localStorage.removeItem(`budgetShare.assumptions.v1.${userId}`);
    localStorage.removeItem(`budgetShare.monthBudgets.v1.${userId}.${yearMonth}`);
    localStorage.removeItem(IMPORT_MERCHANT_RULES_STORAGE_KEY);
    localStorage.removeItem(IMPORT_COLUMN_MAPPING_STORAGE_KEY);
    localStorage.removeItem(IMPORT_CUSTOM_CATEGORIES_STORAGE_KEY);
  } catch {
    // Ignore quota / privacy errors.
  }
};

export const isWorkspaceSettingsEmpty = (settings: {
  budgetAssumptions: BudgetAssumptions;
  monthCategoryBudgets: MonthCategoryBudgets;
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
    settings.importMerchantRules.length === 0 &&
    Object.keys(settings.importColumnMappings).length === 0 &&
    settings.importCustomCategories.length === 0
  );
};
