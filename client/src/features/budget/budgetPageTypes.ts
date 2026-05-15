export type MonthlyBreakdownRow = {
  key: string;
  label: string;
  income: number;
  expenses: number | null;
  budget: number;
  variance: number | null;
  savings: number | null;
  status: 'under' | 'over' | 'na';
  isProjected: boolean;
};

export type MonthlyBreakdownTotals = {
  income: number;
  expenses: number;
  budget: number;
  savings: number;
};

export type CategoryTrendRow = {
  cat: string;
  cap: number;
  monthAmounts: number[];
  ytd: number;
  avg: number;
  trend: 'up' | 'down' | 'stable';
  trendLabel: string;
};
