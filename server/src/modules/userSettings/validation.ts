import { z } from 'zod';
import { parseWithSchema } from '../../lib/parseWithSchema.js';

const budgetAssumptionsSchema = z.object({
  startingBalance: z.number().finite(),
  monthlyIncomeEstimate: z.number().finite(),
});

const monthCategoryBudgetsSchema = z.record(z.string().min(1).max(64), z.number().finite().nonnegative());

const importMerchantRuleSchema = z.object({
  id: z.string().min(1).max(64),
  flow: z.enum(['out', 'in']),
  matchType: z.enum(['exact', 'contains']),
  pattern: z.string().min(1).max(255),
  category: z.string().min(1).max(64),
  split: z.string().max(32).optional(),
  groupId: z.string().max(64).optional(),
  expenseGroup: z.string().max(64).optional(),
  updatedAt: z.string().min(1).max(64),
});

const savedColumnMappingSchema = z.object({
  dateIndex: z.number().int().nonnegative(),
  merchantIndex: z.number().int().nonnegative(),
  amountIndex: z.number().int().nonnegative(),
  currencyIndex: z.number().int().nonnegative().optional(),
  descriptionIndex: z.number().int().nonnegative().optional(),
  dateHeaderKey: z.string().max(128).optional(),
  merchantHeaderKey: z.string().max(128).optional(),
  amountHeaderKey: z.string().max(128).optional(),
  currencyHeaderKey: z.string().max(128).optional(),
  descriptionHeaderKey: z.string().max(128).optional(),
});

const saveUserWorkspaceSettingsSchema = z
  .object({
    budgetAssumptions: budgetAssumptionsSchema.optional(),
    monthCategoryBudgets: z
      .object({
        yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
        budgets: monthCategoryBudgetsSchema,
      })
      .optional(),
    importMerchantRules: z.array(importMerchantRuleSchema).max(500).optional(),
    importColumnMappings: z.record(z.string().min(1).max(191), savedColumnMappingSchema).optional(),
    importCustomCategories: z.array(z.string().min(1).max(64)).max(200).optional(),
  })
  .refine(
    (value) =>
      value.budgetAssumptions !== undefined ||
      value.monthCategoryBudgets !== undefined ||
      value.importMerchantRules !== undefined ||
      value.importColumnMappings !== undefined ||
      value.importCustomCategories !== undefined,
    { message: 'At least one settings field must be provided.' },
  );

export const parseSaveUserWorkspaceSettingsInput = (value: unknown) =>
  parseWithSchema(saveUserWorkspaceSettingsSchema, value, 'saveUserWorkspaceSettings');

export const parseYearMonth = (value: string): string =>
  parseWithSchema(z.string().regex(/^\d{4}-\d{2}$/), value.trim(), 'yearMonth');
