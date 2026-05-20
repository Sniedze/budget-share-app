export type BudgetAssumptions = {
  startingBalance: number;
  monthlyIncomeEstimate: number;
};

export type MonthCategoryBudgets = Record<string, number>;

/** Keys are normalized expense category labels; values are budget line names. */
export type BudgetCategoryMappings = Record<string, string>;

export type ImportMerchantRule = {
  id: string;
  flow: 'out' | 'in';
  matchType: 'exact' | 'contains';
  pattern: string;
  category: string;
  split?: string;
  groupId?: string;
  expenseGroup?: string;
  updatedAt: string;
};

export type SavedColumnMapping = {
  dateIndex: number;
  merchantIndex: number;
  amountIndex: number;
  currencyIndex?: number;
  descriptionIndex?: number;
  dateHeaderKey?: string;
  merchantHeaderKey?: string;
  amountHeaderKey?: string;
  currencyHeaderKey?: string;
  descriptionHeaderKey?: string;
};

export type UserWorkspaceSettings = {
  budgetAssumptions: BudgetAssumptions;
  /** Recurring monthly category limits applied to every month. */
  categoryBudgetDefaults: MonthCategoryBudgets;
  monthCategoryBudgets: MonthCategoryBudgets;
  budgetCustomCategories: string[];
  budgetCategoryMappings: BudgetCategoryMappings;
  importMerchantRules: ImportMerchantRule[];
  importColumnMappings: Record<string, SavedColumnMapping>;
  importCustomCategories: string[];
};

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
