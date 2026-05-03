export type BudgetAssumptions = {
  startingBalance: number;
  monthlyIncomeEstimate: number;
};

export type MonthCategoryBudgets = Record<string, number>;

const assumptionsKey = (userId: string): string => `budgetShare.assumptions.v1.${userId}`;

const monthBudgetsKey = (userId: string, yearMonth: string): string =>
  `budgetShare.monthBudgets.v1.${userId}.${yearMonth}`;

export const loadAssumptions = (userId: string): BudgetAssumptions => {
  try {
    const raw = localStorage.getItem(assumptionsKey(userId));
    if (!raw) {
      return { startingBalance: 0, monthlyIncomeEstimate: 0 };
    }
    const parsed = JSON.parse(raw) as Partial<BudgetAssumptions>;
    return {
      startingBalance: Number(parsed.startingBalance) || 0,
      monthlyIncomeEstimate: Number(parsed.monthlyIncomeEstimate) || 0,
    };
  } catch {
    return { startingBalance: 0, monthlyIncomeEstimate: 0 };
  }
};

export const saveAssumptions = (userId: string, assumptions: BudgetAssumptions): void => {
  localStorage.setItem(assumptionsKey(userId), JSON.stringify(assumptions));
};

export const loadMonthBudgets = (userId: string, yearMonth: string): MonthCategoryBudgets => {
  try {
    const raw = localStorage.getItem(monthBudgetsKey(userId, yearMonth));
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: MonthCategoryBudgets = {};
    for (const [category, value] of Object.entries(parsed)) {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) {
        out[category] = n;
      }
    }
    return out;
  } catch {
    return {};
  }
};

export const saveMonthBudgets = (userId: string, yearMonth: string, budgets: MonthCategoryBudgets): void => {
  localStorage.setItem(monthBudgetsKey(userId, yearMonth), JSON.stringify(budgets));
};
