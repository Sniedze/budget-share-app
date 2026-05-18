import type { RowDataPacket } from 'mysql2';
import { db } from '../../db/mysql.js';
import { userSettingKeys } from './keys.js';
import type {
  BudgetAssumptions,
  ImportMerchantRule,
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

const readMonthCategoryBudgets = async (userId: number, yearMonth: string): Promise<MonthCategoryBudgets> => {
  const raw = await readSetting(userId, userSettingKeys.monthBudgets(yearMonth));
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
    monthCategoryBudgets,
    importMerchantRules,
    importColumnMappings,
    importCustomCategories,
  ] = await Promise.all([
    readBudgetAssumptions(userId),
    readMonthCategoryBudgets(userId, yearMonth),
    readImportMerchantRules(userId),
    readImportColumnMappings(userId),
    readImportCustomCategories(userId),
  ]);

  return {
    budgetAssumptions,
    monthCategoryBudgets,
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
  if (input.monthCategoryBudgets) {
    writes.push(
      writeSetting(
        userId,
        userSettingKeys.monthBudgets(input.monthCategoryBudgets.yearMonth),
        input.monthCategoryBudgets.budgets,
      ),
    );
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
