import {
  IMPORT_COLUMN_MAPPING_STORAGE_KEY,
  IMPORT_CUSTOM_CATEGORIES_STORAGE_KEY,
  IMPORT_MERCHANT_RULES_STORAGE_KEY,
} from '../import/constants';

export {
  IMPORT_COLUMN_MAPPING_STORAGE_KEY,
  IMPORT_CUSTOM_CATEGORIES_STORAGE_KEY,
  IMPORT_MERCHANT_RULES_STORAGE_KEY,
};

export const budgetAssumptionsKey = (userId: string): string => `budgetShare.assumptions.v1.${userId}`;

export const budgetMonthBudgetsKey = (userId: string, yearMonth: string): string =>
  `budgetShare.monthBudgets.v1.${userId}.${yearMonth}`;

export const legacyAuthTokenKeys = [
  'budgetshare.accessToken',
  'budgetshare.refreshToken',
  'budgetshare.rememberMe',
] as const;
