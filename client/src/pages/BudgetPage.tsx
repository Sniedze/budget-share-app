import { useQuery } from '@apollo/client/react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, TrendingUp } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import styled from 'styled-components';
import { Sidebar } from '../components/sections/Sidebar';
import {
  AppLayout,
  Button,
  Card,
  HeaderRow,
  HeaderText,
  Input,
  MutedText,
  PageSurface,
  SectionSubtitle,
  SectionTitle,
  Table,
  TableWrapper,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  UserMenu,
} from '../components/ui';
import { useAuth } from '../features/auth';
import {
  buildForecastChartRows,
  categorySpendTrend,
  collectCategories,
  currentEstimatedBalance,
  expenseDateParts,
  filterExpensesInMonth,
  filterIncomingExpensesInMonth,
  filterOutgoingExpensesInMonth,
  loadAssumptions,
  loadMonthBudgets,
  monthlyActualTotals,
  projectedYearEndBalance,
  saveAssumptions,
  saveMonthBudgets,
  suggestMonthBudgetsFromPreviousMonth,
  sumByCategory,
  sumExpenseAmounts,
  toYearMonthKey,
  totalSpendByYear,
  yearsPresentInExpenses,
  ytdExpensesThrough,
  ytdIncomingThrough,
  ytdIncomeFromMonthlyEstimate,
  ytdRangeLabel,
} from '../features/budget';
import {
  BUDGET_TOP_LEVEL_CATEGORIES,
  GET_EXPENSES,
  toBudgetTopLevelCategory,
  type GetExpensesResponse,
} from '../features/expenses';
import { formatAppCurrency } from '../format/currency';
import { colors, radii, spacing } from '../styles/tokens';

const DEFAULT_CATEGORY_OPTIONS = [...BUDGET_TOP_LEVEL_CATEGORIES];

const CATEGORY_DOT_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#14b8a6', '#ec4899', '#64748b'];

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: ${spacing.md};
  margin-bottom: ${spacing.xl};

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`;

const SummaryCard = styled(Card)<{ $variant?: 'accent' }>`
  min-height: 96px;
  background: ${({ $variant }) =>
    $variant === 'accent' ? 'linear-gradient(135deg, #5b4ef4 0%, #4131d4 100%)' : colors.surface};
  color: ${({ $variant }) => ($variant === 'accent' ? '#ffffff' : colors.textPrimary)};
  border: 1px solid ${({ $variant }) => ($variant === 'accent' ? 'transparent' : colors.border)};
  box-shadow: ${({ $variant }) =>
    $variant === 'accent' ? '0 10px 24px rgba(67, 56, 202, 0.28)' : 'none'};
`;

const SummaryLabel = styled.div`
  font-size: 12px;
  font-weight: 600;
  opacity: 0.85;
  margin-bottom: 6px;
`;

const SummaryValue = styled.div`
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
`;

const SummaryHint = styled.div`
  margin-top: 6px;
  font-size: 12px;
  opacity: 0.8;
`;

const OverviewCard = styled(Card)`
  margin-bottom: ${spacing.lg};
`;

const OverviewHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${spacing.md};
  flex-wrap: wrap;
  margin-bottom: ${spacing.md};
`;

const OverviewTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  color: ${colors.textPrimary};
`;

const MonthInput = styled.input`
  font: inherit;
  padding: 8px 10px;
  border: 1px solid ${colors.border};
  border-radius: ${radii.sm};
  color: ${colors.textPrimary};
  background: ${colors.surface};
`;

const OverviewMetrics = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${spacing.md};
  margin-bottom: ${spacing.md};

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const MetricBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const MetricLabel = styled.span`
  font-size: 12px;
  color: ${colors.textMuted};
  font-weight: 600;
`;

const MetricValue = styled.span<{ $tone?: 'default' | 'blue' | 'green' | 'red' }>`
  font-size: 18px;
  font-weight: 700;
  color: ${({ $tone }) => {
    if ($tone === 'blue') return '#2563eb';
    if ($tone === 'green') return '#16a34a';
    if ($tone === 'red') return '#dc2626';
    return colors.textPrimary;
  }};
`;

const ProgressTrack = styled.div`
  height: 12px;
  border-radius: ${radii.full};
  background: #e5e7eb;
  overflow: hidden;
`;

const ProgressFill = styled.div<{ $pct: number; $over: boolean }>`
  height: 100%;
  width: ${({ $pct }) => `${Math.min(100, $pct)}%`};
  border-radius: ${radii.full};
  background: ${({ $over, $pct }) => ($over ? '#ef4444' : $pct > 90 ? '#f59e0b' : '#22c55e')};
  transition: width 180ms ease;
`;

const ProgressMeta = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 13px;
  color: ${colors.textMuted};
`;

const PillTabs = styled.div`
  display: inline-flex;
  gap: ${spacing.xs};
  padding: ${spacing.xs};
  border: 1px solid ${colors.border};
  border-radius: ${radii.full};
  background: ${colors.surface};
  flex-wrap: wrap;
`;

const PillTab = styled.button<{ $active: boolean }>`
  border: 0;
  cursor: pointer;
  border-radius: ${radii.full};
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  color: ${({ $active }) => ($active ? '#ffffff' : colors.textMuted)};
  background: ${({ $active }) => ($active ? '#c7d2fe' : 'transparent')};
  color: ${({ $active }) => ($active ? '#3730a3' : colors.textMuted)};
  &:hover {
    background: ${({ $active }) => ($active ? '#c7d2fe' : colors.background)};
  }
`;

const ChartCard = styled(Card)`
  margin-bottom: ${spacing.lg};
`;

const ChartFrame = styled.div`
  height: 280px;
  width: 100%;
  margin-top: ${spacing.md};
`;

const Callout = styled.div`
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: ${spacing.md};
  border-radius: ${radii.md};
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e3a5f;
  font-size: 13px;
  line-height: 1.45;
  margin-top: ${spacing.md};
`;

const DetailedSection = styled(Card)`
  margin-bottom: ${spacing.xl};
`;

const SectionHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${spacing.md};
  flex-wrap: wrap;
  margin-bottom: ${spacing.md};
`;

const CategoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
`;

const CategoryCard = styled.div`
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  padding: ${spacing.md};
  background: ${colors.surface};
`;

const CategoryTop = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${spacing.md};
  flex-wrap: wrap;
  margin-bottom: 8px;
`;

const CategoryName = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  color: ${colors.textPrimary};
`;

const Dot = styled.span<{ $color: string }>`
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: ${({ $color }) => $color};
`;

const CategoryAmounts = styled.div`
  font-size: 14px;
  color: ${colors.textMuted};
  text-align: right;
`;

const CategoryFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 12px;
  color: ${colors.textMuted};
`;

const TrendTag = styled.span<{ $trend: 'up' | 'down' | 'stable' }>`
  font-weight: 600;
  color: ${({ $trend }) => ($trend === 'up' ? '#dc2626' : $trend === 'down' ? '#16a34a' : colors.textMuted)};
`;

const CategoryBar = styled.div<{ $pct: number; $color: string; $over: boolean }>`
  height: 8px;
  border-radius: ${radii.full};
  background: #e5e7eb;
  overflow: hidden;
  &::after {
    content: '';
    display: block;
    height: 100%;
    width: ${({ $pct }) => `${Math.min(100, $pct)}%`};
    border-radius: ${radii.full};
    background: ${({ $over, $color }) => ($over ? '#ef4444' : $color)};
  }
`;

const Pill = styled.span`
  display: inline-block;
  padding: 3px 10px;
  border-radius: ${radii.full};
  font-size: 12px;
  font-weight: 600;
  background: #dbeafe;
  color: #1e40af;
`;

const StatusPill = styled.span<{ $variant: 'under' | 'over' }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: ${radii.full};
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  background: ${({ $variant }) => ($variant === 'under' ? '#dcfce7' : '#fee2e2')};
  color: ${({ $variant }) => ($variant === 'under' ? '#166534' : '#b91c1c')};
`;

const MiniTrend = styled.span<{ $trend: 'up' | 'down' | 'stable' }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: ${({ $trend }) => ($trend === 'up' ? '#dc2626' : $trend === 'down' ? '#16a34a' : colors.textMuted)};
`;

const ModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: ${spacing.lg};
`;

const ModalPanel = styled.div`
  width: min(520px, 100%);
  max-height: min(88vh, 720px);
  overflow: auto;
  background: ${colors.surface};
  border-radius: ${radii.lg};
  padding: ${spacing.xl};
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.2);
`;

const ModalTitle = styled.h2`
  margin: 0 0 ${spacing.sm};
  font-size: 18px;
`;

const FormGrid = styled.div`
  display: grid;
  gap: ${spacing.md};
  margin-top: ${spacing.md};
`;

const CategoryBudgetRow = styled.label`
  display: grid;
  grid-template-columns: 1fr 120px;
  gap: ${spacing.sm};
  align-items: center;
  font-size: 13px;
  color: ${colors.textPrimary};
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${spacing.sm};
  margin-top: ${spacing.xl};
`;

type MonthlyBreakdownRow = {
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

type MonthlyBreakdownTotals = {
  income: number;
  expenses: number;
  budget: number;
  savings: number;
};

type CategoryTrendRow = {
  cat: string;
  cap: number;
  monthAmounts: number[];
  ytd: number;
  avg: number;
  trend: 'up' | 'down' | 'stable';
  trendLabel: string;
};

export const BudgetPage = (): JSX.Element => {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const now = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonthIndex, setViewMonthIndex] = useState(now.getMonth());
  const [detailTab, setDetailTab] = useState<'recent' | 'months' | 'trends'>('recent');
  const [chartTab, setChartTab] = useState<'monthly' | 'yearly'>('monthly');
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  /** Bumps when month budgets or assumptions are saved so we re-read localStorage. */
  const [budgetStorageTick, setBudgetStorageTick] = useState(0);

  const [draftAssumptions, setDraftAssumptions] = useState(() => loadAssumptions(userId));
  const [draftCategoryBudgets, setDraftCategoryBudgets] = useState<Record<string, string>>({});

  const { data, loading, error } = useQuery<GetExpensesResponse>(GET_EXPENSES);
  const expenses = useMemo(() => data?.expenses ?? [], [data]);

  const categories = useMemo(
    () => collectCategories(expenses, DEFAULT_CATEGORY_OPTIONS),
    [expenses],
  );

  const assumptions = useMemo(() => {
    void budgetStorageTick;
    return loadAssumptions(userId);
  }, [userId, budgetStorageTick]);
  const monthKey = toYearMonthKey(viewYear, viewMonthIndex);
  const monthBudgets = useMemo(() => {
    void budgetStorageTick;
    return loadMonthBudgets(userId, monthKey);
  }, [userId, monthKey, budgetStorageTick]);

  const totalBudgeted = useMemo(
    () => Object.values(monthBudgets).reduce((s, n) => s + n, 0),
    [monthBudgets],
  );

  const monthOutgoingExpenses = useMemo(
    () => filterOutgoingExpensesInMonth(expenses, viewYear, viewMonthIndex),
    [expenses, viewYear, viewMonthIndex],
  );

  const totalSpentMonth = useMemo(() => sumExpenseAmounts(monthOutgoingExpenses), [monthOutgoingExpenses]);
  const remainingBudget = totalBudgeted - totalSpentMonth;
  const usagePct = totalBudgeted > 0 ? (totalSpentMonth / totalBudgeted) * 100 : 0;

  const ytdExp = useMemo(() => ytdExpensesThrough(expenses, now), [expenses, now]);
  const ytdIncomingActual = useMemo(() => ytdIncomingThrough(expenses, now), [expenses, now]);
  const ytdIncEstimate = useMemo(
    () => ytdIncomeFromMonthlyEstimate(assumptions.monthlyIncomeEstimate, now),
    [assumptions.monthlyIncomeEstimate, now],
  );
  const ytdIncCombined = ytdIncomingActual + ytdIncEstimate;

  const balanceNow = useMemo(
    () =>
      currentEstimatedBalance({
        startingBalance: assumptions.startingBalance,
        monthlyIncomeEstimate: assumptions.monthlyIncomeEstimate,
        ytdIncomingActual,
        ytdExpenses: ytdExp,
        now,
      }),
    [assumptions.startingBalance, assumptions.monthlyIncomeEstimate, ytdIncomingActual, ytdExp, now],
  );

  const projectedEnd = useMemo(
    () =>
      projectedYearEndBalance({
        startingBalance: assumptions.startingBalance,
        monthlyIncomeEstimate: assumptions.monthlyIncomeEstimate,
        ytdIncomingActual,
        ytdExpenses: ytdExp,
        now,
      }),
    [assumptions.startingBalance, assumptions.monthlyIncomeEstimate, ytdIncomingActual, ytdExp, now],
  );

  const balanceDeltaYtd = ytdIncCombined - ytdExp;

  const monthlyActual = useMemo(
    () => monthlyActualTotals(expenses, viewYear),
    [expenses, viewYear],
  );

  const chartRowsMonthly = useMemo(
    () => buildForecastChartRows(viewYear, monthlyActual, totalBudgeted || 0, now),
    [viewYear, monthlyActual, totalBudgeted, now],
  );

  const yearTotals = useMemo(() => {
    const map = totalSpendByYear(expenses);
    const years = yearsPresentInExpenses(expenses);
    if (years.length === 0) {
      return [{ year: now.getFullYear(), spent: 0, budget: totalBudgeted * 12 }];
    }
    return years.map((year) => ({
      year,
      spent: Number((map.get(year) ?? 0).toFixed(2)),
      budget: totalBudgeted * 12,
    }));
  }, [expenses, now, totalBudgeted]);

  const prevMonthExpenses = useMemo(() => {
    const py = viewMonthIndex === 0 ? viewYear - 1 : viewYear;
    const pm = viewMonthIndex === 0 ? 11 : viewMonthIndex - 1;
    return filterOutgoingExpensesInMonth(expenses, py, pm);
  }, [expenses, viewYear, viewMonthIndex]);

  const prevByCat = useMemo(() => sumByCategory(prevMonthExpenses), [prevMonthExpenses]);
  const currByCat = useMemo(() => sumByCategory(monthOutgoingExpenses), [monthOutgoingExpenses]);

  const categoryRows = useMemo(() => {
    const names = new Set([...categories, ...Object.keys(monthBudgets)]);
    return Array.from(names).map((name, i) => {
      const cap = monthBudgets[name] ?? 0;
      const spent = currByCat.get(name) ?? 0;
      const prevSpent = prevByCat.get(name) ?? 0;
      const pct = cap > 0 ? (spent / cap) * 100 : spent > 0 ? 100 : 0;
      const over = cap > 0 && spent > cap;
      const { trend, label } = categorySpendTrend(spent, prevSpent);
      const remaining = cap - spent;
      return {
        name,
        cap,
        spent,
        pct,
        over,
        trend,
        trendLabel: label,
        remaining,
        dot: CATEGORY_DOT_COLORS[i % CATEGORY_DOT_COLORS.length],
      };
    });
  }, [categories, monthBudgets, currByCat, prevByCat]);

  const sortedRecentTx = useMemo(() => {
    const monthAll = filterExpensesInMonth(expenses, viewYear, viewMonthIndex);
    const list = [...monthAll].sort((a, b) => {
      const ta = expenseDateParts(a.transactionDate).time;
      const tb = expenseDateParts(b.transactionDate).time;
      if (tb !== ta) {
        return tb - ta;
      }
      return Number(b.id) - Number(a.id);
    });
    const chronological = [...monthAll].sort((a, b) => {
      const ta = expenseDateParts(a.transactionDate).time;
      const tb = expenseDateParts(b.transactionDate).time;
      if (ta !== tb) {
        return ta - tb;
      }
      return Number(a.id) - Number(b.id);
    });
    const remainingAfter = new Map<string, number>();
    let running = totalBudgeted;
    for (const e of chronological) {
      if (e.flow !== 'Incoming') {
        running -= e.amount;
      }
      remainingAfter.set(e.id, running);
    }
    return list.map((e) => ({
      expense: e,
      remaining: remainingAfter.get(e.id) ?? 0,
    }));
  }, [expenses, viewYear, viewMonthIndex, totalBudgeted]);

  const monthlyBreakdownDetail = useMemo(() => {
    void budgetStorageTick;
    if (!userId) {
      return { rows: [] as MonthlyBreakdownRow[], totals: null as MonthlyBreakdownTotals | null };
    }
    const incomeEstimate = Number(assumptions.monthlyIncomeEstimate) || 0;
    const y = viewYear;
    const rows: MonthlyBreakdownRow[] = [];
    let sumIncome = 0;
    let sumExpenses = 0;
    let sumBudget = 0;
    let sumSavings = 0;
    let actualMonths = 0;

    for (let mi = 0; mi < 12; mi++) {
      const key = toYearMonthKey(y, mi);
      const budMap = loadMonthBudgets(userId, key);
      const budgeted = Object.values(budMap).reduce((s, n) => s + n, 0);
      const spent = sumExpenseAmounts(filterOutgoingExpensesInMonth(expenses, y, mi));
      const incomeActual = sumExpenseAmounts(filterIncomingExpensesInMonth(expenses, y, mi));
      const isProjected = y > now.getFullYear() || (y === now.getFullYear() && mi > now.getMonth());
      const incomeShown = isProjected ? incomeEstimate : incomeActual > 0 ? incomeActual : incomeEstimate;

      if (!isProjected) {
        sumIncome += incomeShown;
        sumExpenses += spent;
        sumBudget += budgeted;
        sumSavings += incomeShown - spent;
        actualMonths += 1;
      }

      const variance = !isProjected && budgeted > 0 ? budgeted - spent : null;
      const savings = !isProjected ? incomeShown - spent : null;
      let status: MonthlyBreakdownRow['status'] = 'na';
      if (!isProjected && budgeted > 0) {
        status = spent <= budgeted ? 'under' : 'over';
      }

      rows.push({
        key,
        label: new Date(y, mi, 1).toLocaleString('en-US', { month: 'short' }),
        income: incomeShown,
        expenses: isProjected ? null : spent,
        budget: budgeted,
        variance,
        savings,
        status,
        isProjected,
      });
    }

    const totals: MonthlyBreakdownTotals | null =
      actualMonths > 0
        ? {
            income: sumIncome,
            expenses: sumExpenses,
            budget: sumBudget,
            savings: sumSavings,
          }
        : null;

    return { rows, totals };
  }, [userId, viewYear, expenses, budgetStorageTick, assumptions.monthlyIncomeEstimate, now]);

  const categoryTrendsTable = useMemo(() => {
    const y = viewYear;
    const lastMi =
      y < now.getFullYear() ? 11 : y > now.getFullYear() ? -1 : now.getMonth();
    if (lastMi < 0) {
      return {
        monthIndices: [] as number[],
        labels: [] as string[],
        rows: [] as CategoryTrendRow[],
        columnTotals: [] as number[],
      };
    }
    const monthIndices = Array.from({ length: lastMi + 1 }, (_, i) => i);
    const labels = monthIndices.map((mi) =>
      new Date(y, mi, 1).toLocaleString('en-US', { month: 'short' }).toUpperCase(),
    );
    const catList = [...categories].sort((a, b) => a.localeCompare(b));
    const rows: CategoryTrendRow[] = catList.map((cat) => {
      const cap = monthBudgets[cat] ?? 0;
      const monthAmounts = monthIndices.map((mi) => {
        const inMonth = filterOutgoingExpensesInMonth(expenses, y, mi).filter(
          (e) => toBudgetTopLevelCategory(e.category) === cat,
        );
        return sumExpenseAmounts(inMonth);
      });
      const ytd = monthAmounts.reduce((a, b) => a + b, 0);
      const n = monthIndices.length;
      const avg = n > 0 ? ytd / n : 0;
      const prev = monthAmounts.length >= 2 ? monthAmounts[monthAmounts.length - 2] : 0;
      const last = monthAmounts.length >= 1 ? monthAmounts[monthAmounts.length - 1] : 0;
      const { trend, label } = categorySpendTrend(last, prev);
      return { cat, cap, monthAmounts, ytd, avg, trend, trendLabel: label };
    });
    const columnTotals = monthIndices.map((_, colIdx) =>
      Number(rows.reduce((s, r) => s + r.monthAmounts[colIdx], 0).toFixed(2)),
    );
    return { monthIndices, labels, rows, columnTotals };
  }, [viewYear, now, expenses, categories, monthBudgets]);

  const openBudgetModal = useCallback(() => {
    const loaded = loadAssumptions(userId);
    setDraftAssumptions(loaded);
    const existing = loadMonthBudgets(userId, monthKey);
    const suggested = suggestMonthBudgetsFromPreviousMonth(expenses, viewYear, viewMonthIndex, categories);
    const merged: Record<string, string> = {};
    for (const c of categories) {
      const v = existing[c] ?? suggested[c] ?? 0;
      merged[c] = v > 0 ? String(v) : '';
    }
    setDraftCategoryBudgets(merged);
    setBudgetModalOpen(true);
  }, [userId, monthKey, expenses, viewYear, viewMonthIndex, categories]);

  useEffect(() => {
    if (!budgetModalOpen || !userId) {
      return;
    }
    setDraftAssumptions(loadAssumptions(userId));
  }, [budgetModalOpen, userId]);

  const onSaveBudgets = (event: FormEvent) => {
    event.preventDefault();
    if (!userId) {
      return;
    }
    saveAssumptions(userId, {
      startingBalance: Number(draftAssumptions.startingBalance) || 0,
      monthlyIncomeEstimate: Number(draftAssumptions.monthlyIncomeEstimate) || 0,
    });
    const next: Record<string, number> = {};
    for (const [k, v] of Object.entries(draftCategoryBudgets)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) {
        next[k] = n;
      }
    }
    saveMonthBudgets(userId, monthKey, next);
    setBudgetStorageTick((t) => t + 1);
    setBudgetModalOpen(false);
  };

  const monthPickerValue = `${viewYear}-${pad2(viewMonthIndex + 1)}`;

  const onMonthPickerChange = (value: string) => {
    const [y, m] = value.split('-').map(Number);
    if (!y || !m) {
      return;
    }
    setViewYear(y);
    setViewMonthIndex(m - 1);
  };

  return (
    <AppLayout>
      <Sidebar />
      <PageSurface>
        <HeaderRow>
          <HeaderText>
            <SectionTitle>Budget &amp; Forecast</SectionTitle>
            <SectionSubtitle>Track your budget, monitor spending, and forecast future balance.</SectionSubtitle>
          </HeaderText>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' }}>
            <Button type="button" $variant="accent" $weight="semibold" $elevation="accent" onClick={openBudgetModal}>
              + Set budget
            </Button>
            <UserMenu />
          </div>
        </HeaderRow>

        {loading ? <MutedText>Loading…</MutedText> : null}
        {error ? <MutedText>Error: {error.message}</MutedText> : null}

        <SummaryGrid>
          <SummaryCard $variant="accent">
            <SummaryLabel>Current balance</SummaryLabel>
            <SummaryValue>{formatAppCurrency(balanceNow)}</SummaryValue>
            <SummaryHint>
              {balanceDeltaYtd >= 0 ? '+' : ''}
              {formatAppCurrency(balanceDeltaYtd)} YTD cash flow
            </SummaryHint>
          </SummaryCard>
          <SummaryCard>
            <SummaryLabel>Projected (year end)</SummaryLabel>
            <SummaryValue>{formatAppCurrency(projectedEnd)}</SummaryValue>
            <SummaryHint>Based on income estimate &amp; spend trend</SummaryHint>
          </SummaryCard>
          <SummaryCard>
            <SummaryLabel>YTD income</SummaryLabel>
            <SummaryValue style={{ color: '#16a34a' }}>
              +{formatAppCurrency(ytdIncCombined)}
            </SummaryValue>
            <SummaryHint>
              {ytdRangeLabel(now)} · imported {formatAppCurrency(ytdIncomingActual)} + estimate{' '}
              {formatAppCurrency(ytdIncEstimate)}
            </SummaryHint>
          </SummaryCard>
          <SummaryCard>
            <SummaryLabel>YTD expenses</SummaryLabel>
            <SummaryValue style={{ color: '#dc2626' }}>-{formatAppCurrency(ytdExp)}</SummaryValue>
            <SummaryHint>{ytdRangeLabel(now)}</SummaryHint>
          </SummaryCard>
        </SummaryGrid>

        <OverviewCard>
          <OverviewHeader>
            <div>
              <OverviewTitle>Monthly budget overview</OverviewTitle>
              <MutedText style={{ marginTop: 4 }}>
                {new Date(viewYear, viewMonthIndex, 1).toLocaleString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </MutedText>
            </div>
            <MonthInput type="month" value={monthPickerValue} onChange={(e) => onMonthPickerChange(e.target.value)} />
          </OverviewHeader>
          <OverviewMetrics>
            <MetricBlock>
              <MetricLabel>Total budgeted</MetricLabel>
              <MetricValue>{formatAppCurrency(totalBudgeted)}</MetricValue>
            </MetricBlock>
            <MetricBlock>
              <MetricLabel>Total spent</MetricLabel>
              <MetricValue $tone="blue">{formatAppCurrency(totalSpentMonth)}</MetricValue>
            </MetricBlock>
            <MetricBlock>
              <MetricLabel>Remaining</MetricLabel>
              <MetricValue $tone={remainingBudget >= 0 ? 'green' : 'red'}>{formatAppCurrency(remainingBudget)}</MetricValue>
            </MetricBlock>
          </OverviewMetrics>
          <ProgressTrack>
            <ProgressFill $pct={usagePct} $over={remainingBudget < 0} />
          </ProgressTrack>
          <ProgressMeta>
            <span>{totalBudgeted > 0 ? `${usagePct.toFixed(1)}%` : '—'} of budget used</span>
            <span>{totalBudgeted <= 0 ? 'Set category budgets to track usage' : null}</span>
          </ProgressMeta>
        </OverviewCard>

        <DetailedSection>
          <SectionHead>
            <OverviewTitle style={{ margin: 0 }}>Detailed views</OverviewTitle>
            <PillTabs>
              <PillTab type="button" $active={detailTab === 'recent'} onClick={() => setDetailTab('recent')}>
                Recent transactions
              </PillTab>
              <PillTab type="button" $active={detailTab === 'months'} onClick={() => setDetailTab('months')}>
                Monthly breakdown
              </PillTab>
              <PillTab type="button" $active={detailTab === 'trends'} onClick={() => setDetailTab('trends')}>
                Category trends
              </PillTab>
            </PillTabs>
          </SectionHead>

          {detailTab === 'recent' ? (
            <TableWrapper>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Date</Th>
                    <Th>Description</Th>
                    <Th>Flow</Th>
                    <Th>Category</Th>
                    <Th style={{ textAlign: 'right' }}>Amount</Th>
                    <Th style={{ textAlign: 'right' }}>Budget impact</Th>
                    <Th style={{ textAlign: 'right' }}>Remaining</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {sortedRecentTx.length === 0 ? (
                    <Tr>
                      <Td colSpan={7}>
                        <MutedText>No transactions in this month.</MutedText>
                      </Td>
                    </Tr>
                  ) : (
                    sortedRecentTx.map(({ expense, remaining }) => {
                      const isIn = expense.flow === 'Incoming';
                      return (
                        <Tr key={expense.id}>
                          <Td>{expense.transactionDate.slice(0, 10)}</Td>
                          <Td>{expense.title}</Td>
                          <Td>
                            <Pill>{isIn ? 'Incoming' : 'Outgoing'}</Pill>
                          </Td>
                          <Td>
                            <Pill>{expense.category}</Pill>
                          </Td>
                          <Td style={{ textAlign: 'right' }}>{formatAppCurrency(expense.amount)}</Td>
                          <Td
                            style={{
                              textAlign: 'right',
                              color: isIn ? '#16a34a' : '#dc2626',
                            }}
                          >
                            {isIn ? '+' : '-'}
                            {formatAppCurrency(expense.amount)}
                          </Td>
                          <Td
                            style={{
                              textAlign: 'right',
                              fontWeight: 600,
                              color: remaining >= 0 ? '#16a34a' : '#dc2626',
                            }}
                          >
                            {formatAppCurrency(remaining)}
                          </Td>
                        </Tr>
                      );
                    })
                  )}
                </Tbody>
              </Table>
            </TableWrapper>
          ) : null}

          {detailTab === 'months' ? (
            <TableWrapper>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Month</Th>
                    <Th style={{ textAlign: 'right' }}>Income</Th>
                    <Th style={{ textAlign: 'right' }}>Expenses</Th>
                    <Th style={{ textAlign: 'right' }}>Budget</Th>
                    <Th style={{ textAlign: 'right' }}>Variance</Th>
                    <Th style={{ textAlign: 'right' }}>Savings</Th>
                    <Th>Status</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {monthlyBreakdownDetail.rows.map((row) => (
                    <Tr key={row.key}>
                      <Td>
                        {row.label} {viewYear}
                        {row.isProjected ? (
                          <MutedText as="span" style={{ marginLeft: 6, fontSize: 11 }}>
                            (projected)
                          </MutedText>
                        ) : null}
                      </Td>
                      <Td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>
                        +{formatAppCurrency(row.income)}
                      </Td>
                      <Td style={{ textAlign: 'right' }}>
                        {row.expenses === null ? '—' : formatAppCurrency(row.expenses)}
                      </Td>
                      <Td style={{ textAlign: 'right' }}>
                        {row.budget > 0 ? formatAppCurrency(row.budget) : '—'}
                      </Td>
                      <Td style={{ textAlign: 'right' }}>
                        {row.variance === null ? (
                          '—'
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: 4,
                              fontWeight: 600,
                              color: row.variance >= 0 ? '#16a34a' : '#dc2626',
                            }}
                          >
                            {row.variance >= 0 ? (
                              <ArrowDownRight size={16} aria-hidden />
                            ) : (
                              <ArrowUpRight size={16} aria-hidden />
                            )}
                            {formatAppCurrency(Math.abs(row.variance))}
                          </span>
                        )}
                      </Td>
                      <Td style={{ textAlign: 'right' }}>
                        {row.savings === null ? '—' : formatAppCurrency(row.savings)}
                      </Td>
                      <Td>
                        {row.status === 'under' ? (
                          <StatusPill $variant="under">Under budget</StatusPill>
                        ) : row.status === 'over' ? (
                          <StatusPill $variant="over">Over budget</StatusPill>
                        ) : (
                          <MutedText as="span">—</MutedText>
                        )}
                      </Td>
                    </Tr>
                  ))}
                  {monthlyBreakdownDetail.totals ? (
                    <Tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                      <Td>Total (actual)</Td>
                      <Td style={{ textAlign: 'right', color: '#16a34a' }}>
                        +{formatAppCurrency(monthlyBreakdownDetail.totals.income)}
                      </Td>
                      <Td style={{ textAlign: 'right' }}>
                        {formatAppCurrency(monthlyBreakdownDetail.totals.expenses)}
                      </Td>
                      <Td style={{ textAlign: 'right' }}>
                        {formatAppCurrency(monthlyBreakdownDetail.totals.budget)}
                      </Td>
                      <Td>—</Td>
                      <Td style={{ textAlign: 'right' }}>{formatAppCurrency(monthlyBreakdownDetail.totals.savings)}</Td>
                      <Td>—</Td>
                    </Tr>
                  ) : null}
                </Tbody>
              </Table>
            </TableWrapper>
          ) : null}

          {detailTab === 'trends' ? (
            categoryTrendsTable.rows.length === 0 ? (
              <MutedText>Add outgoing expenses to see category trends for {viewYear}.</MutedText>
            ) : (
              <TableWrapper>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Category</Th>
                      {categoryTrendsTable.labels.map((lab) => (
                        <Th key={lab} style={{ textAlign: 'right' }}>
                          {lab}
                        </Th>
                      ))}
                      <Th style={{ textAlign: 'right' }}>Budget</Th>
                      <Th style={{ textAlign: 'right' }}>YTD total</Th>
                      <Th style={{ textAlign: 'right' }}>Avg / month</Th>
                      <Th>Trend</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {categoryTrendsTable.rows.map((r, idx) => (
                      <Tr key={r.cat}>
                        <Td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <Dot $color={CATEGORY_DOT_COLORS[idx % CATEGORY_DOT_COLORS.length]} aria-hidden />
                            {r.cat}
                          </span>
                        </Td>
                        {r.monthAmounts.map((amt, i) => (
                          <Td key={`${r.cat}-${categoryTrendsTable.monthIndices[i]}`} style={{ textAlign: 'right' }}>
                            {formatAppCurrency(amt)}
                          </Td>
                        ))}
                        <Td style={{ textAlign: 'right' }}>
                          {r.cap > 0 ? formatAppCurrency(r.cap) : '—'}
                        </Td>
                        <Td style={{ textAlign: 'right', color: '#2563eb', fontWeight: 600 }}>
                          {formatAppCurrency(r.ytd)}
                        </Td>
                        <Td
                          style={{
                            textAlign: 'right',
                            fontWeight: 600,
                            color: r.cap > 0 && r.avg > r.cap ? '#dc2626' : '#16a34a',
                          }}
                        >
                          {formatAppCurrency(r.avg)}
                        </Td>
                        <Td>
                          <MiniTrend $trend={r.trend}>
                            {r.trend === 'up' ? <TrendingUp size={14} aria-hidden /> : null}
                            {r.trend === 'up' ? 'Rising' : r.trend === 'down' ? 'Falling' : 'Stable'}
                          </MiniTrend>
                        </Td>
                      </Tr>
                    ))}
                    <Tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                      <Td>Total</Td>
                      {categoryTrendsTable.columnTotals.map((t, i) => (
                        <Td key={`tot-${categoryTrendsTable.monthIndices[i]}`} style={{ textAlign: 'right' }}>
                          {formatAppCurrency(t)}
                        </Td>
                      ))}
                      <Td>—</Td>
                      <Td style={{ textAlign: 'right', color: '#2563eb' }}>
                        {formatAppCurrency(categoryTrendsTable.rows.reduce((s, r) => s + r.ytd, 0))}
                      </Td>
                      <Td>—</Td>
                      <Td>—</Td>
                    </Tr>
                  </Tbody>
                </Table>
              </TableWrapper>
            )
          ) : null}
        </DetailedSection>

        <ChartCard>
          <SectionHead>
            <OverviewTitle style={{ margin: 0 }}>Spending forecast &amp; trends</OverviewTitle>
            <PillTabs>
              <PillTab type="button" $active={chartTab === 'monthly'} onClick={() => setChartTab('monthly')}>
                Monthly view
              </PillTab>
              <PillTab type="button" $active={chartTab === 'yearly'} onClick={() => setChartTab('yearly')}>
                Yearly projection
              </PillTab>
            </PillTabs>
          </SectionHead>

          {chartTab === 'monthly' ? (
            <>
              <ChartFrame>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartRowsMonthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => (value == null ? '—' : formatAppCurrency(Number(value)))} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="budget"
                      name="Budget"
                      stroke="#93c5fd"
                      fill="#dbeafe"
                      fillOpacity={0.5}
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="actual"
                      name="Actual"
                      stroke="#1d4ed8"
                      fill="#c7d2fe"
                      fillOpacity={0.35}
                      strokeWidth={2}
                      connectNulls
                    />
                    <Area
                      type="monotone"
                      dataKey="forecast"
                      name="Forecast"
                      stroke="#f97316"
                      fill="#ffedd5"
                      fillOpacity={0.3}
                      strokeWidth={2}
                      connectNulls
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartFrame>
              <Callout>
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
                <div>
                  <strong>Forecast methodology.</strong> Projections use your average spend in months so far this
                  year; actual results may vary. Set a monthly income estimate in &quot;Set budget&quot; to improve
                  balance projections.
                </div>
              </Callout>
            </>
          ) : (
            <>
              <ChartFrame>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={yearTotals}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => formatAppCurrency(Number(value ?? 0))} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="spent"
                      name="Total spent"
                      stroke="#4f46e5"
                      fill="#ddd6fe"
                      fillOpacity={0.45}
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="budget"
                      name="Annual budget (12× current month)"
                      stroke="#94a3b8"
                      fill="#e2e8f0"
                      fillOpacity={0.25}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartFrame>
              <Callout>
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
                <div>
                  Annual budget line uses twelve times your <strong>currently selected month&apos;s</strong> total
                  category budget as a rough yardstick—not a full year of stored budgets per month.
                </div>
              </Callout>
            </>
          )}
        </ChartCard>

        <OverviewTitle style={{ marginBottom: spacing.md }}>Budget by category</OverviewTitle>
        <CategoryList>
          {categoryRows.length === 0 ? (
            <MutedText>No categories yet. Add expenses or open Set budget.</MutedText>
          ) : (
            categoryRows.map((row) => (
              <CategoryCard key={row.name}>
                <CategoryTop>
                  <CategoryName>
                    <Dot $color={row.dot} aria-hidden />
                    {row.name}
                  </CategoryName>
                  <CategoryAmounts>
                    {formatAppCurrency(row.spent)}
                    {row.cap > 0 ? ` / ${formatAppCurrency(row.cap)}` : ' · no cap'}
                  </CategoryAmounts>
                </CategoryTop>
                <CategoryBar $pct={row.pct} $color={row.dot} $over={row.over} />
                <CategoryFooter>
                  <span>{row.cap > 0 ? `${Math.min(999, row.pct).toFixed(1)}% used` : '—'}</span>
                  <span>
                    {row.cap > 0 ? (
                      <>
                        {row.remaining >= 0 ? (
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>{formatAppCurrency(row.remaining)} left</span>
                        ) : (
                          <span style={{ color: '#dc2626', fontWeight: 600 }}>
                            +{formatAppCurrency(Math.abs(row.remaining))} over
                          </span>
                        )}
                        {' · '}
                        <TrendTag $trend={row.trend}>{row.trendLabel}</TrendTag>
                      </>
                    ) : (
                      <TrendTag $trend={row.trend}>{row.trendLabel}</TrendTag>
                    )}
                  </span>
                </CategoryFooter>
              </CategoryCard>
            ))
          )}
        </CategoryList>

        {budgetModalOpen ? (
          <ModalBackdrop role="presentation" onMouseDown={() => setBudgetModalOpen(false)}>
            <ModalPanel
              role="dialog"
              aria-modal="true"
              aria-labelledby="budget-modal-title"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <ModalTitle id="budget-modal-title">Budget &amp; cashflow</ModalTitle>
              <MutedText>
                Values are stored in this browser for your account. Income uses a steady monthly estimate for YTD and
                projections.
              </MutedText>
              <form onSubmit={onSaveBudgets}>
                <FormGrid>
                  <label>
                    <MutedText as="span" style={{ display: 'block', marginBottom: 4 }}>
                      Starting balance (Jan 1)
                    </MutedText>
                    <Input
                      type="number"
                      step="0.01"
                      value={draftAssumptions.startingBalance}
                      onChange={(e) =>
                        setDraftAssumptions((p) => ({ ...p, startingBalance: Number(e.target.value) }))
                      }
                    />
                  </label>
                  <label>
                    <MutedText as="span" style={{ display: 'block', marginBottom: 4 }}>
                      Monthly income estimate
                    </MutedText>
                    <Input
                      type="number"
                      step="0.01"
                      value={draftAssumptions.monthlyIncomeEstimate}
                      onChange={(e) =>
                        setDraftAssumptions((p) => ({ ...p, monthlyIncomeEstimate: Number(e.target.value) }))
                      }
                    />
                  </label>
                </FormGrid>
                <OverviewTitle style={{ marginTop: spacing.xl, fontSize: 15 }}>
                  Category budgets · {monthKey}
                </OverviewTitle>
                <MutedText style={{ marginTop: 4 }}>Leave blank to omit a cap for that category.</MutedText>
                <FormGrid>
                  {categories.map((c) => (
                    <CategoryBudgetRow key={c}>
                      <span>{c}</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0"
                        value={draftCategoryBudgets[c] ?? ''}
                        onChange={(e) => setDraftCategoryBudgets((p) => ({ ...p, [c]: e.target.value }))}
                      />
                    </CategoryBudgetRow>
                  ))}
                </FormGrid>
                <ModalActions>
                  <Button type="button" $variant="secondary" onClick={() => setBudgetModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" $variant="accent" $weight="semibold">
                    Save
                  </Button>
                </ModalActions>
              </form>
            </ModalPanel>
          </ModalBackdrop>
        ) : null}
      </PageSurface>
    </AppLayout>
  );
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
