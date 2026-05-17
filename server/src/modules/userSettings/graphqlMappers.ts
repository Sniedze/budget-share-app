import type {
  ImportMerchantRule,
  MonthCategoryBudgets,
  SavedColumnMapping,
  SaveUserWorkspaceSettingsInput,
  UserWorkspaceSettings,
} from './types.js';

export type GraphqlUserWorkspaceSettings = {
  budgetAssumptions: UserWorkspaceSettings['budgetAssumptions'];
  monthCategoryBudgets: Array<{ category: string; amount: number }>;
  importMerchantRules: ImportMerchantRule[];
  importColumnMappings: Array<SavedColumnMapping & { signature: string }>;
  importCustomCategories: string[];
};

export const toGraphqlUserWorkspaceSettings = (
  settings: UserWorkspaceSettings,
): GraphqlUserWorkspaceSettings => ({
  budgetAssumptions: settings.budgetAssumptions,
  monthCategoryBudgets: Object.entries(settings.monthCategoryBudgets).map(([category, amount]) => ({
    category,
    amount,
  })),
  importMerchantRules: settings.importMerchantRules,
  importColumnMappings: Object.entries(settings.importColumnMappings).map(([signature, mapping]) => ({
    signature,
    ...mapping,
  })),
  importCustomCategories: settings.importCustomCategories,
});

type GraphqlSaveInput = {
  budgetAssumptions?: UserWorkspaceSettings['budgetAssumptions'];
  monthCategoryBudgets?: {
    yearMonth: string;
    budgets: Array<{ category: string; amount: number }>;
  };
  importMerchantRules?: ImportMerchantRule[];
  importColumnMappings?: Array<SavedColumnMapping & { signature: string }>;
  importCustomCategories?: string[];
};

export const fromGraphqlSaveInput = (input: GraphqlSaveInput): SaveUserWorkspaceSettingsInput => {
  const monthCategoryBudgets = input.monthCategoryBudgets
    ? {
        yearMonth: input.monthCategoryBudgets.yearMonth,
        budgets: input.monthCategoryBudgets.budgets.reduce<MonthCategoryBudgets>((acc, row) => {
          acc[row.category] = row.amount;
          return acc;
        }, {}),
      }
    : undefined;

  const importColumnMappings = input.importColumnMappings
    ? input.importColumnMappings.reduce<Record<string, SavedColumnMapping>>((acc, row) => {
        const { signature, ...mapping } = row;
        acc[signature] = mapping;
        return acc;
      }, {})
    : undefined;

  return {
    budgetAssumptions: input.budgetAssumptions,
    monthCategoryBudgets,
    importMerchantRules: input.importMerchantRules,
    importColumnMappings,
    importCustomCategories: input.importCustomCategories,
  };
};
