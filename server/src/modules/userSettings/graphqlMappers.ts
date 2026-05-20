import type {
  BudgetCategoryMappings,
  ImportMerchantRule,
  MonthCategoryBudgets,
  SavedColumnMapping,
  SaveUserWorkspaceSettingsInput,
  UserWorkspaceSettings,
} from './types.js';

const categoryBudgetsToEntries = (budgets: MonthCategoryBudgets) =>
  Object.entries(budgets).map(([category, amount]) => ({ category, amount }));

export type GraphqlUserWorkspaceSettings = {
  budgetAssumptions: UserWorkspaceSettings['budgetAssumptions'];
  categoryBudgetDefaults: Array<{ category: string; amount: number }>;
  monthCategoryBudgets: Array<{ category: string; amount: number }>;
  budgetCustomCategories: string[];
  budgetCategoryMappings: Array<{ expenseCategory: string; budgetCategory: string }>;
  importMerchantRules: ImportMerchantRule[];
  importColumnMappings: Array<SavedColumnMapping & { signature: string }>;
  importCustomCategories: string[];
};

export const toGraphqlUserWorkspaceSettings = (
  settings: UserWorkspaceSettings,
): GraphqlUserWorkspaceSettings => ({
  budgetAssumptions: settings.budgetAssumptions,
  categoryBudgetDefaults: categoryBudgetsToEntries(settings.categoryBudgetDefaults),
  monthCategoryBudgets: categoryBudgetsToEntries(settings.monthCategoryBudgets),
  budgetCustomCategories: settings.budgetCustomCategories,
  budgetCategoryMappings: Object.entries(settings.budgetCategoryMappings).map(
    ([expenseCategory, budgetCategory]) => ({
      expenseCategory,
      budgetCategory,
    }),
  ),
  importMerchantRules: settings.importMerchantRules,
  importColumnMappings: Object.entries(settings.importColumnMappings).map(([signature, mapping]) => ({
    signature,
    ...mapping,
  })),
  importCustomCategories: settings.importCustomCategories,
});

type GraphqlSaveInput = {
  budgetAssumptions?: UserWorkspaceSettings['budgetAssumptions'];
  categoryBudgetDefaults?: Array<{ category: string; amount: number }>;
  monthCategoryBudgets?: {
    yearMonth: string;
    budgets: Array<{ category: string; amount: number }>;
  };
  budgetCustomCategories?: string[];
  budgetCategoryMappings?: Array<{ expenseCategory: string; budgetCategory: string }>;
  importMerchantRules?: ImportMerchantRule[];
  importColumnMappings?: Array<SavedColumnMapping & { signature: string }>;
  importCustomCategories?: string[];
};

export const fromGraphqlSaveInput = (input: GraphqlSaveInput): SaveUserWorkspaceSettingsInput => {
  const categoryBudgetDefaults = input.categoryBudgetDefaults
    ? input.categoryBudgetDefaults.reduce<MonthCategoryBudgets>((acc, row) => {
        acc[row.category] = row.amount;
        return acc;
      }, {})
    : undefined;

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

  const budgetCategoryMappings = input.budgetCategoryMappings
    ? input.budgetCategoryMappings.reduce<BudgetCategoryMappings>((acc, row) => {
        acc[row.expenseCategory] = row.budgetCategory;
        return acc;
      }, {})
    : undefined;

  return {
    budgetAssumptions: input.budgetAssumptions,
    categoryBudgetDefaults,
    monthCategoryBudgets,
    budgetCustomCategories: input.budgetCustomCategories,
    budgetCategoryMappings,
    importMerchantRules: input.importMerchantRules,
    importColumnMappings,
    importCustomCategories: input.importCustomCategories,
  };
};
