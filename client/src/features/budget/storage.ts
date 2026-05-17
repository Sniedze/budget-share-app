import { readJsonFromStorage, writeJsonToStorage } from '../../lib/localStorageJson';
import { budgetAssumptionsKey, budgetMonthBudgetsKey } from '../userSettings/workspaceStorageKeys';

export type BudgetAssumptions = {
  startingBalance: number;
  monthlyIncomeEstimate: number;
};

export type MonthCategoryBudgets = Record<string, number>;

export const loadAssumptions = (userId: string): BudgetAssumptions => {
  const parsed = readJsonFromStorage<Partial<BudgetAssumptions>>(budgetAssumptionsKey(userId), {});
  return {
    startingBalance: Number(parsed.startingBalance) || 0,
    monthlyIncomeEstimate: Number(parsed.monthlyIncomeEstimate) || 0,
  };
};

export const saveAssumptions = (userId: string, assumptions: BudgetAssumptions): void => {
  writeJsonToStorage(budgetAssumptionsKey(userId), assumptions);
};

export const loadMonthBudgets = (userId: string, yearMonth: string): MonthCategoryBudgets => {
  const parsed = readJsonFromStorage<Record<string, unknown>>(budgetMonthBudgetsKey(userId, yearMonth), {});
  const out: MonthCategoryBudgets = {};
  for (const [category, value] of Object.entries(parsed)) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) {
      out[category] = n;
    }
  }
  return out;
};

export const saveMonthBudgets = (userId: string, yearMonth: string, budgets: MonthCategoryBudgets): void => {
  writeJsonToStorage(budgetMonthBudgetsKey(userId, yearMonth), budgets);
};
