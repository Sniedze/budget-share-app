import type { FormatBudgetAmount } from './budgetPageTypes';

export type BudgetInsight = {
  id: string;
  variant: 'warning' | 'success' | 'info' | 'opportunity';
  badge: string;
  message: string;
};

type CategoryLike = {
  name: string;
  cap: number;
  spent: number;
  over: boolean;
  pct: number;
};

export const buildBudgetInsights = (
  categoryRows: CategoryLike[],
  opts: {
    formatAmount: FormatBudgetAmount;
    monthIncome: number;
    monthSaved: number;
    savingsRatePct: number;
    totalBudgeted: number;
    totalSpentMonth: number;
    viewYear: number;
    viewMonthIndex: number;
    now: Date;
  },
): BudgetInsight[] => {
  const { formatAmount, monthIncome, monthSaved, savingsRatePct, totalBudgeted, totalSpentMonth } = opts;
  const insights: BudgetInsight[] = [];

  const overs = categoryRows.filter((r) => r.cap > 0 && r.spent > r.cap).sort((a, b) => b.pct - a.pct);
  if (overs.length > 0) {
    const c = overs[0];
    const overAmt = c.spent - c.cap;
    const overPct = c.cap > 0 ? Math.round(((c.spent - c.cap) / c.cap) * 100) : 0;
    insights.push({
      id: `over-${c.name}`,
      variant: 'warning',
      badge: 'Over budget',
      message: `${c.name} is ${overPct}% over your monthly limit — you've spent ${formatAmount(overAmt)} more than planned. Consider trimming discretionary spending in this category.`,
    });
  }

  if (monthIncome > 0 && monthSaved > 0 && savingsRatePct >= 30) {
    insights.push({
      id: 'savings-strong',
      variant: 'success',
      badge: 'On track',
      message: `You're saving ${savingsRatePct.toFixed(0)}% of your income this month${savingsRatePct >= 30 ? ' — at or above a strong 30% target.' : '.'} Great work maintaining discipline.`,
    });
  } else if (monthIncome > 0 && monthSaved > 0 && savingsRatePct >= 15) {
    insights.push({
      id: 'savings-good',
      variant: 'success',
      badge: 'On track',
      message: `You're saving ${savingsRatePct.toFixed(0)}% of your income this month. Every bit counts toward your goals.`,
    });
  }

  if (totalBudgeted > 0) {
    const dim = opts.viewYear === opts.now.getFullYear() && opts.viewMonthIndex === opts.now.getMonth();
    if (dim) {
      const dimLast = new Date(opts.viewYear, opts.viewMonthIndex + 1, 0).getDate();
      const day = opts.now.getDate();
      if (day > 0 && day < dimLast) {
        const pace = totalSpentMonth / day;
        const projected = pace * dimLast;
        if (projected > totalBudgeted * 1.02) {
          insights.push({
            id: 'forecast-pace',
            variant: 'info',
            badge: 'Forecast',
            message: `At your current pace you may end the month around ${formatAmount(projected)} spent versus ${formatAmount(totalBudgeted)} budgeted.`,
          });
        }
      }
    }
  }

  const under = categoryRows.find((r) => r.cap > 0 && r.spent < r.cap * 0.7 && r.cap - r.spent > 50);
  if (under && monthSaved < monthIncome * 0.1) {
    const slack = under.cap - under.spent;
    insights.push({
      id: `opp-${under.name}`,
      variant: 'opportunity',
      badge: 'Opportunity',
      message: `${under.name} is under budget — about ${formatAmount(slack)} below the cap. You could redirect some of that slack toward savings or debt.`,
    });
  }

  return insights.slice(0, 4);
};
