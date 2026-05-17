export type BudgetAssumptions = {
  startingBalance: number;
  monthlyIncomeEstimate: number;
};

export type MonthCategoryBudgets = Record<string, number>;

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
  monthCategoryBudgets: MonthCategoryBudgets;
  importMerchantRules: ImportMerchantRule[];
  importColumnMappings: Record<string, SavedColumnMapping>;
  importCustomCategories: string[];
};

export type SaveUserWorkspaceSettingsInput = {
  budgetAssumptions?: BudgetAssumptions;
  monthCategoryBudgets?: { yearMonth: string; budgets: MonthCategoryBudgets };
  importMerchantRules?: ImportMerchantRule[];
  importColumnMappings?: Record<string, SavedColumnMapping>;
  importCustomCategories?: string[];
};
