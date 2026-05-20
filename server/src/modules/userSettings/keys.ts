const YEAR_MONTH_PATTERN = /^\d{4}-\d{2}$/;

export const userSettingKeys = {
  budgetAssumptions: 'budget.assumptions',
  /** Recurring monthly category limits (same every month). */
  categoryBudgetDefaults: 'budget.category_budget_defaults',
  budgetCustomCategories: 'budget.custom_categories',
  budgetCategoryMappings: 'budget.category_mappings',
  importMerchantRules: 'import.merchant_rules',
  importColumnMappings: 'import.column_mappings',
  importCustomCategories: 'import.custom_categories',
  monthBudgets: (yearMonth: string): string => {
    if (!YEAR_MONTH_PATTERN.test(yearMonth)) {
      throw new Error(`Invalid yearMonth: ${yearMonth}`);
    }
    return `budget.month.${yearMonth}`;
  },
} as const;
