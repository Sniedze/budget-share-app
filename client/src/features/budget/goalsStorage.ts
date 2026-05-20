export type BudgetGoal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  /** YYYY-MM-DD */
  targetDateIso: string;
};

const keyFor = (userId: string): string => `budgetshare.budgetGoals.${userId}`;

export const loadBudgetGoals = (userId: string): BudgetGoal[] => {
  if (!userId || typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((row): BudgetGoal | null => {
        if (!row || typeof row !== 'object') {
          return null;
        }
        const r = row as Record<string, unknown>;
        const id = typeof r.id === 'string' ? r.id : '';
        const name = typeof r.name === 'string' ? r.name.trim() : '';
        const targetAmount = Number(r.targetAmount);
        const currentAmount = Number(r.currentAmount);
        const targetDateIso = typeof r.targetDateIso === 'string' ? r.targetDateIso.trim() : '';
        if (!id || !name || !Number.isFinite(targetAmount) || targetAmount <= 0 || !targetDateIso) {
          return null;
        }
        return {
          id,
          name,
          targetAmount,
          currentAmount: Number.isFinite(currentAmount) && currentAmount >= 0 ? currentAmount : 0,
          targetDateIso,
        };
      })
      .filter((g): g is BudgetGoal => g !== null);
  } catch {
    return [];
  }
};

export const saveBudgetGoals = (userId: string, goals: BudgetGoal[]): void => {
  if (!userId || typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(keyFor(userId), JSON.stringify(goals));
};
