import type { RowDataPacket } from 'mysql2';
import { db } from '../../db/mysql.js';
import { userSettingKeys } from './keys.js';
import type {
  BudgetAssumptions,
  ImportMerchantRule,
  BudgetCategoryMappings,
  MonthCategoryBudgets,
  SavedColumnMapping,
  SaveUserWorkspaceSettingsInput,
  UserWorkspaceSettings,
} from './types.js';

type SettingRow = {
  setting_key: string;
  setting_value: unknown;
} & RowDataPacket;

const DEFAULT_BUDGET_ASSUMPTIONS: BudgetAssumptions = {
  startingBalance: 0,
  monthlyIncomeEstimate: 0,
};

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
};

const readSetting = async (userId: number, key: string): Promise<unknown | null> => {
  const [rows] = await db.query<SettingRow[]>(
    'SELECT setting_key, setting_value FROM user_settings WHERE user_id = ? AND setting_key = ? LIMIT 1',
    [userId, key],
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  return parseJson(row.setting_value, null);
};

const writeSetting = async (userId: number, key: string, value: unknown): Promise<void> => {
  await db.execute(
    `
      INSERT INTO user_settings (user_id, setting_key, setting_value)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP
    `,
    [userId, key, JSON.stringify(value)],
  );
};

const readBudgetAssumptions = async (userId: number): Promise<BudgetAssumptions> => {
  const raw = await readSetting(userId, userSettingKeys.budgetAssumptions);
  const parsed = parseJson<Partial<BudgetAssumptions>>(raw, DEFAULT_BUDGET_ASSUMPTIONS);
  return {
    startingBalance: Number(parsed.startingBalance) || 0,
    monthlyIncomeEstimate: Number(parsed.monthlyIncomeEstimate) || 0,
  };
};

const parseCategoryBudgetRecord = (raw: unknown): MonthCategoryBudgets => {
  const parsed = parseJson<Record<string, unknown>>(raw, {});
  const out: MonthCategoryBudgets = {};
  for (const [category, value] of Object.entries(parsed)) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) {
      out[category] = n;
    }
  }
  return out;
};

const readMonthCategoryBudgets = async (userId: number, yearMonth: string): Promise<MonthCategoryBudgets> => {
  const raw = await readSetting(userId, userSettingKeys.monthBudgets(yearMonth));
  return parseCategoryBudgetRecord(raw);
};

const readCategoryBudgetDefaults = async (userId: number): Promise<MonthCategoryBudgets> => {
  const raw = await readSetting(userId, userSettingKeys.categoryBudgetDefaults);
  return parseCategoryBudgetRecord(raw);
};

const readImportMerchantRules = async (userId: number): Promise<ImportMerchantRule[]> => {
  const raw = await readSetting(userId, userSettingKeys.importMerchantRules);
  const parsed = parseJson<unknown>(raw, []);
  return Array.isArray(parsed) ? (parsed as ImportMerchantRule[]) : [];
};

const readImportColumnMappings = async (userId: number): Promise<Record<string, SavedColumnMapping>> => {
  const raw = await readSetting(userId, userSettingKeys.importColumnMappings);
  const parsed = parseJson<Record<string, SavedColumnMapping>>(raw, {});
  return parsed && typeof parsed === 'object' ? parsed : {};
};

const readImportCustomCategories = async (userId: number): Promise<string[]> => {
  const raw = await readSetting(userId, userSettingKeys.importCustomCategories);
  const parsed = parseJson<unknown>(raw, []);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
};

const readBudgetCategoryMappings = async (userId: number): Promise<BudgetCategoryMappings> => {
  const raw = await readSetting(userId, userSettingKeys.budgetCategoryMappings);
  const parsed = parseJson<Record<string, unknown>>(raw, {});
  const out: BudgetCategoryMappings = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof key === 'string' && typeof value === 'string' && key.trim() && value.trim()) {
      out[key.trim()] = value.trim();
    }
  }
  return out;
};

const readBudgetCustomCategories = async (userId: number): Promise<string[]> => {
  const raw = await readSetting(userId, userSettingKeys.budgetCustomCategories);
  const parsed = parseJson<unknown>(raw, []);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
};

export const listAllUserSettings = async (userId: number): Promise<Record<string, unknown>> => {
  const [rows] = await db.query<SettingRow[]>(
    'SELECT setting_key, setting_value FROM user_settings WHERE user_id = ? ORDER BY setting_key ASC',
    [userId],
  );
  const settings: Record<string, unknown> = {};
  for (const row of rows) {
    settings[row.setting_key] = parseJson(row.setting_value, null);
  }
  return settings;
};

export const getUserWorkspaceSettings = async (
  userId: number,
  yearMonth: string,
): Promise<UserWorkspaceSettings> => {
  const [
    budgetAssumptions,
    categoryBudgetDefaultsRaw,
    monthCategoryBudgetsForMonth,
    budgetCustomCategories,
    budgetCategoryMappings,
    importMerchantRules,
    importColumnMappings,
    importCustomCategories,
  ] = await Promise.all([
    readBudgetAssumptions(userId),
    readCategoryBudgetDefaults(userId),
    readMonthCategoryBudgets(userId, yearMonth),
    readBudgetCustomCategories(userId),
    readBudgetCategoryMappings(userId),
    readImportMerchantRules(userId),
    readImportColumnMappings(userId),
    readImportCustomCategories(userId),
  ]);

  const categoryBudgetDefaults =
    Object.keys(categoryBudgetDefaultsRaw).length > 0
      ? categoryBudgetDefaultsRaw
      : monthCategoryBudgetsForMonth;

  return {
    budgetAssumptions,
    categoryBudgetDefaults,
    monthCategoryBudgets: categoryBudgetDefaults,
    budgetCustomCategories,
    budgetCategoryMappings,
    importMerchantRules,
    importColumnMappings,
    importCustomCategories,
  };
};

export const saveUserWorkspaceSettings = async (
  userId: number,
  input: SaveUserWorkspaceSettingsInput,
): Promise<UserWorkspaceSettings> => {
  const writes: Promise<void>[] = [];

  if (input.budgetAssumptions) {
    writes.push(writeSetting(userId, userSettingKeys.budgetAssumptions, input.budgetAssumptions));
  }
  if (input.categoryBudgetDefaults) {
    writes.push(
      writeSetting(userId, userSettingKeys.categoryBudgetDefaults, input.categoryBudgetDefaults),
    );
  }
  if (input.monthCategoryBudgets) {
    writes.push(
      writeSetting(
        userId,
        userSettingKeys.monthBudgets(input.monthCategoryBudgets.yearMonth),
        input.monthCategoryBudgets.budgets,
      ),
    );
    if (!input.categoryBudgetDefaults) {
      writes.push(
        writeSetting(userId, userSettingKeys.categoryBudgetDefaults, input.monthCategoryBudgets.budgets),
      );
    }
  }
  if (input.budgetCustomCategories !== undefined) {
    writes.push(writeSetting(userId, userSettingKeys.budgetCustomCategories, input.budgetCustomCategories));
  }
  if (input.budgetCategoryMappings !== undefined) {
    writes.push(writeSetting(userId, userSettingKeys.budgetCategoryMappings, input.budgetCategoryMappings));
  }
  if (input.importMerchantRules) {
    writes.push(writeSetting(userId, userSettingKeys.importMerchantRules, input.importMerchantRules));
  }
  if (input.importColumnMappings) {
    writes.push(writeSetting(userId, userSettingKeys.importColumnMappings, input.importColumnMappings));
  }
  if (input.importCustomCategories) {
    writes.push(writeSetting(userId, userSettingKeys.importCustomCategories, input.importCustomCategories));
  }

  await Promise.all(writes);

  const yearMonth = input.monthCategoryBudgets?.yearMonth ?? new Date().toISOString().slice(0, 7);
  return getUserWorkspaceSettings(userId, yearMonth);
};
