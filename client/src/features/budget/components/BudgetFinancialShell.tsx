import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Bus,
  Calendar,
  ChevronsLeft,
  ChevronsRight,
  Clapperboard,
  Lightbulb,
  PiggyBank,
  Search,
  ShoppingCart,
  Pencil,
  Target,
  Utensils,
  Zap,
} from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  Button,
  Card,
  ErrorText,
  HeaderRow,
  Input,
  MutedText,
  SectionSubtitle,
  SectionTitle,
  UserMenu,
} from '../../../components/ui';
import { colors, radii, spacing } from '../../../styles/tokens';
import { formatCurrencyAmount } from '../../../format/currency';
import { expenseDateParts } from '../selectors';
import { toBudgetTopLevelCategory } from '../../expenses';
import type { Expense } from '../../../graphql/operationTypes';
import type { BudgetInsight } from '../budgetInsights';
import type { BudgetGoal } from '../goalsStorage';
import { BudgetForecastCharts } from './BudgetForecastCharts';
import {
  BUCKET_LABELS,
  bucketTotals503020,
  build503020CategoryBudgets,
  buildBudgetSetupDraftLimits,
  classifyBudget503020Bucket,
  formatShareOfMonthlyBudget,
  isBudgetSetupConfigured,
  rebalanceCategoryLimitsToIncome,
  savedBudgetLimitsAreCredible,
} from '../budget503020';
import { parseLocaleAmountInput } from '../../../format/parseAmountInput';
import type { BudgetMainTab, MonthReportBarRow } from '../useBudgetPageState';
import type { ForecastChartRow } from '../selectors';
import type { CategoryBudgetDisplayRow } from '../budgetPageTypes';

const CREATE_BUDGET_CATEGORY_OPTION = '__create_budget_category__';

const ShellHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${spacing.lg};
  margin-bottom: ${spacing.md};
`;

const TitleBlock = styled.div``;

const MonthNav = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.xs};
  padding: 6px 10px;
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  background: ${colors.surface};
`;

const MonthNavBtn = styled.button`
  border: 0;
  background: transparent;
  padding: 4px;
  cursor: pointer;
  color: ${colors.textMuted};
  border-radius: ${radii.sm};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  &:hover {
    background: ${colors.background};
    color: ${colors.textPrimary};
  }
`;

const TabRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing.lg};
  border-bottom: 1px solid ${colors.border};
  margin-bottom: ${spacing.xl};
`;

const TabBtn = styled.button<{ $active: boolean }>`
  border: 0;
  background: none;
  padding: 10px 2px;
  margin-bottom: -1px;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  color: ${({ $active }) => ($active ? colors.primary : colors.textMuted)};
  border-bottom: 2px solid ${({ $active }) => ($active ? colors.primary : 'transparent')};
  &:hover {
    color: ${colors.textPrimary};
  }
`;

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${spacing.md};
  margin-bottom: ${spacing.xl};

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const SummaryCard = styled(Card)`
  padding: ${spacing.lg};
  border-radius: ${radii.lg};
  border: 1px solid ${colors.border};
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
`;

const SummaryLabel = styled.div`
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: ${colors.textMuted};
  margin-bottom: ${spacing.sm};
`;

const SummaryValue = styled.div<{ $tone: 'income' | 'spent' | 'saved' }>`
  font-size: 1.5rem;
  font-weight: 700;
  color: ${({ $tone }) => {
    if ($tone === 'income') return colors.success;
    if ($tone === 'spent') return colors.danger;
    return colors.primary;
  }};
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SummaryHint = styled.div`
  margin-top: 6px;
  font-size: 0.8125rem;
  color: ${colors.textMuted};
`;

const TwoCol = styled.div`
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: ${spacing.lg};
  margin-bottom: ${spacing.lg};

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`;

const PanelCard = styled(Card)`
  padding: ${spacing.lg};
  border-radius: ${radii.lg};
  border: 1px solid ${colors.border};
`;

const PanelHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${spacing.md};
`;

const PanelTitle = styled.h3`
  margin: 0;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: ${colors.textMuted};
`;

const CategoryRow = styled.div`
  margin-bottom: ${spacing.md};
  &:last-child {
    margin-bottom: 0;
  }
`;

const CatLabel = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 6px;
  color: ${colors.textPrimary};
`;

const BarTrack = styled.div`
  height: 10px;
  border-radius: ${radii.full};
  background: #e5e7eb;
  overflow: hidden;
`;

const BarFill = styled.div<{ $pct: number; $color: string; $over: boolean }>`
  height: 100%;
  width: ${({ $pct }) => `${Math.min(100, $pct)}%`};
  border-radius: ${radii.full};
  background: ${({ $over, $color }) => ($over ? colors.danger : $color)};
  transition: width 160ms ease;
`;

const TxRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.sm};
  padding: 10px 0;
  border-bottom: 1px solid ${colors.border};
  font-size: 0.875rem;
  &:last-child {
    border-bottom: 0;
  }
`;

const TxIconWrap = styled.span`
  width: 36px;
  height: 36px;
  border-radius: ${radii.md};
  background: ${colors.background};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${colors.textMuted};
  flex-shrink: 0;
`;

const TxMain = styled.div`
  flex: 1;
  min-width: 0;
`;

const TxTitle = styled.div`
  font-weight: 600;
  color: ${colors.textPrimary};
`;

const TxMeta = styled.div`
  font-size: 0.75rem;
  color: ${colors.textMuted};
`;

const TxAmt = styled.div<{ $incoming: boolean }>`
  font-weight: 700;
  color: ${({ $incoming }) => ($incoming ? colors.success : colors.danger)};
  flex-shrink: 0;
`;

const InsightsCard = styled(PanelCard)`
  margin-top: ${spacing.lg};
`;

const SmartInsightsHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.sm};
  margin-bottom: ${spacing.lg};
  color: ${colors.textPrimary};

  svg {
    flex-shrink: 0;
    color: ${colors.textMuted};
  }
`;

const SmartInsightsTitle = styled.span`
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: ${colors.textPrimary};
`;

const InsightItem = styled.div`
  display: flex;
  gap: ${spacing.md};
  align-items: flex-start;
  padding: ${spacing.md} 0;

  &:first-of-type {
    padding-top: 0;
  }

  &:not(:last-of-type) {
    border-bottom: 1px solid ${colors.border};
  }
`;

const InsightBadge = styled.span<{ $variant: BudgetInsight['variant'] }>`
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: ${radii.md};
  flex-shrink: 0;
  line-height: 1.25;
  white-space: nowrap;
  background: ${({ $variant }) => {
    if ($variant === 'warning') return '#ffedd5';
    if ($variant === 'success') return '#dcfce7';
    if ($variant === 'opportunity') return '#e0f2fe';
    return '#dbeafe';
  }};
  color: ${({ $variant }) => {
    if ($variant === 'warning') return '#9a3412';
    if ($variant === 'success') return '#166534';
    if ($variant === 'opportunity') return '#075985';
    return '#1d4ed8';
  }};
`;

const InsightMessage = styled.p`
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.55;
  color: ${colors.textPrimary};
`;

const GuidanceBanner = styled.div`
  display: flex;
  gap: ${spacing.md};
  padding: ${spacing.md} ${spacing.lg};
  border-radius: ${radii.md};
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e3a5f;
  font-size: 0.875rem;
  line-height: 1.5;
  margin-bottom: ${spacing.lg};
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
`;

const Th = styled.th`
  text-align: left;
  padding: 10px 8px;
  color: ${colors.textMuted};
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid ${colors.border};
`;

const Td = styled.td`
  padding: 12px 8px;
  border-bottom: 1px solid ${colors.border};
  vertical-align: middle;
`;

const CatPill = styled.span`
  display: inline-block;
  padding: 2px 10px;
  border-radius: ${radii.full};
  background: ${colors.background};
  font-size: 0.75rem;
  color: ${colors.textMuted};
`;

const GoalCard = styled(PanelCard)`
  margin-bottom: ${spacing.md};
`;

const GoalGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${spacing.sm};
  margin-top: ${spacing.md};

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const GoalStat = styled.div`
  background: ${colors.background};
  border-radius: ${radii.sm};
  padding: ${spacing.sm};
  text-align: center;
`;

const GoalStatLabel = styled.div`
  font-size: 0.65rem;
  font-weight: 600;
  color: ${colors.textMuted};
  text-transform: uppercase;
`;

const GoalStatValue = styled.div`
  font-size: 0.9375rem;
  font-weight: 700;
  margin-top: 4px;
`;

const iconForCategory = (category: string): JSX.Element => {
  const c = category.toLowerCase();
  if (c.includes('food') || c.includes('groc') || c.includes('living')) {
    return <ShoppingCart size={18} />;
  }
  if (c.includes('dining') || c.includes('restaurant')) {
    return <Utensils size={18} />;
  }
  if (c.includes('transport')) {
    return <Bus size={18} />;
  }
  if (c.includes('entertain')) {
    return <Clapperboard size={18} />;
  }
  if (c.includes('util') || c.includes('tech')) {
    return <Zap size={18} />;
  }
  return <ShoppingCart size={18} />;
};

const iconForExpense = (e: Expense): JSX.Element => {
  if (e.flow === 'Incoming') {
    return <Banknote size={18} />;
  }
  return iconForCategory(e.category);
};

const insightBadgeLabel = (variant: BudgetInsight['variant']): string => {
  switch (variant) {
    case 'warning':
      return 'Over Budget';
    case 'success':
      return 'On Track';
    case 'info':
      return 'Forecast';
    case 'opportunity':
      return 'Opportunity';
    default:
      return 'Insight';
  }
};

export type BudgetFinancialShellProps = {
  mainTab: BudgetMainTab;
  setMainTab: (t: BudgetMainTab) => void;
  shiftViewMonth: (delta: number) => void;
  monthPickerValue: string;
  onMonthPickerChange: (v: string) => void;
  formatAmount: (n: number) => string;
  budgetCurrency: string;
  monthIncomeDisplay: number;
  totalSpentMonth: number;
  totalBudgeted: number;
  monthSaved: number;
  savingsRatePct: number;
  categoryRows: CategoryBudgetDisplayRow[];
  sortedRecentTx: { expense: Expense }[];
  budgetInsights: BudgetInsight[];
  txSearch: string;
  setTxSearch: (s: string) => void;
  txCategoryFilter: string;
  setTxCategoryFilter: (s: string) => void;
  filteredTransactions: Expense[];
  categories: string[];
  budgetAssumptions: { startingBalance: number; monthlyIncomeEstimate: number };
  categoryBudgetLimits: Record<string, number>;
  draftAssumptions: { startingBalance: number; monthlyIncomeEstimate: number };
  setDraftAssumptions: React.Dispatch<
    React.SetStateAction<{ startingBalance: number; monthlyIncomeEstimate: number }>
  >;
  draftCategoryBudgets: Record<string, string>;
  setDraftCategoryBudgets: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSaveBudgets: (e: FormEvent) => Promise<boolean>;
  onResetBudgetSetup: () => Promise<boolean>;
  savingBudget: boolean;
  resettingBudget: boolean;
  budgetSaveFeedback: string | null;
  clearBudgetSaveFeedback: () => void;
  annualBudgetTotal: number;
  projectedEnd: number;
  balanceNow: number;
  chartTab: 'monthly' | 'yearly';
  setChartTab: (tab: 'monthly' | 'yearly') => void;
  chartRowsMonthly: ForecastChartRow[];
  yearTotals: Array<{ year: number; spent: number; budget: number }>;
  addBudgetCustomCategory: (name: string) => void;
  expenseCategoriesForMapping: string[];
  budgetLinesForMapping: string[];
  setExpenseCategoryMapping: (expenseLabel: string, budgetCategory: string) => void;
  getExpenseCategoryMappingValue: (expenseLabel: string) => string;
  resolveExpenseToBudgetCategory: (expenseCategory: string) => string;
  onSaveCategoryMappings: () => Promise<void>;
  savingCategoryMappings: boolean;
  categoryMappingsDirty: boolean;
  categoryMappingsFeedback: string | null;
  goals: BudgetGoal[];
  persistGoals: (g: BudgetGoal[]) => void;
  last6MonthsReport: MonthReportBarRow[];
  reportsAvgMonthlySpend: number;
  reportsAvgSavingsRate: number;
  reportsMostOverspent: { name: string; pct: number } | null;
  reportsTopCategories: CategoryBudgetDisplayRow[];
};

export const BudgetFinancialShell = ({
  mainTab,
  setMainTab,
  shiftViewMonth,
  monthPickerValue,
  onMonthPickerChange,
  formatAmount,
  budgetCurrency,
  monthIncomeDisplay,
  totalSpentMonth,
  totalBudgeted,
  monthSaved,
  savingsRatePct,
  categoryRows,
  sortedRecentTx,
  budgetInsights,
  txSearch,
  setTxSearch,
  txCategoryFilter,
  setTxCategoryFilter,
  filteredTransactions,
  categories,
  budgetAssumptions,
  categoryBudgetLimits,
  draftAssumptions,
  setDraftAssumptions,
  draftCategoryBudgets,
  setDraftCategoryBudgets,
  onSaveBudgets,
  onResetBudgetSetup,
  savingBudget,
  resettingBudget,
  budgetSaveFeedback,
  clearBudgetSaveFeedback,
  annualBudgetTotal,
  projectedEnd,
  balanceNow,
  chartTab,
  setChartTab,
  chartRowsMonthly,
  yearTotals,
  addBudgetCustomCategory,
  expenseCategoriesForMapping,
  budgetLinesForMapping,
  setExpenseCategoryMapping,
  getExpenseCategoryMappingValue,
  resolveExpenseToBudgetCategory,
  onSaveCategoryMappings,
  savingCategoryMappings,
  categoryMappingsDirty,
  categoryMappingsFeedback,
  goals,
  persistGoals,
  last6MonthsReport,
  reportsAvgMonthlySpend,
  reportsAvgSavingsRate,
  reportsMostOverspent,
  reportsTopCategories,
}: BudgetFinancialShellProps): JSX.Element => {
  const [pendingNewBudgetCategory, setPendingNewBudgetCategory] = useState<string | null>(null);
  const [newBudgetCategoryName, setNewBudgetCategoryName] = useState('');
  const [budgetSetupEditing, setBudgetSetupEditing] = useState(false);
  const [showSavedBudgetSetupView, setShowSavedBudgetSetupView] = useState(false);
  const [manualLimitEdits, setManualLimitEdits] = useState<Set<string>>(() => new Set());
  const lastSuggestionIncomeRef = useRef<number | null>(null);

  useEffect(() => {
    if (mainTab !== 'budget_setup') {
      setBudgetSetupEditing(false);
    }
  }, [mainTab]);

  const savedBudgetRows = useMemo(() => {
    const names = new Set([...categories, ...Object.keys(categoryBudgetLimits)]);
    return Array.from(names)
      .map((name) => {
        const limit = categoryBudgetLimits[name] ?? 0;
        const bucket = classifyBudget503020Bucket(name);
        return {
          name,
          limit,
          bucket,
          bucketLabel: BUCKET_LABELS[bucket],
        };
      })
      .filter((row) => row.limit > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, categoryBudgetLimits]);

  const hasSavedBudgetSetup = isBudgetSetupConfigured(budgetAssumptions, categoryBudgetLimits);

  const hasSavedBudgetOnFile = hasSavedBudgetSetup || showSavedBudgetSetupView;
  const showBudgetSetupView = hasSavedBudgetOnFile && !budgetSetupEditing;

  const startBudgetSetupEdit = () => {
    clearBudgetSaveFeedback();
    setShowSavedBudgetSetupView(false);
    setDraftAssumptions({ ...budgetAssumptions });
    const income = Number(budgetAssumptions.monthlyIncomeEstimate) || 0;
    setDraftCategoryBudgets(buildBudgetSetupDraftLimits(categories, income, categoryBudgetLimits));
    clearLimitSuggestionTracking();
    lastSuggestionIncomeRef.current = income > 0 ? income : null;
    setBudgetSetupEditing(true);
  };

  const clearLimitSuggestionTracking = () => {
    setManualLimitEdits(new Set());
    lastSuggestionIncomeRef.current = null;
  };

  const emptyAllBudgetSetupFields = () => {
    setDraftAssumptions({ startingBalance: 0, monthlyIncomeEstimate: 0 });
    const cleared: Record<string, string> = {};
    for (const cat of categories) {
      cleared[cat] = '';
    }
    setDraftCategoryBudgets(cleared);
    clearLimitSuggestionTracking();
  };

  const handleCancelBudgetSetup = () => {
    clearBudgetSaveFeedback();
    setDraftAssumptions({
      startingBalance: budgetAssumptions.startingBalance ?? 0,
      monthlyIncomeEstimate: 0,
    });
    const cleared: Record<string, string> = {};
    for (const cat of categories) {
      cleared[cat] = '';
    }
    setDraftCategoryBudgets(cleared);
    clearLimitSuggestionTracking();
  };

  const handleEmptyAllBudgetSetupFields = () => {
    const confirmed = window.confirm(
      'Clear monthly income, starting balance, and all category limits on this form? Your saved budget is unchanged until you click Save budget.',
    );
    if (!confirmed) {
      return;
    }
    emptyAllBudgetSetupFields();
  };

  const handleSaveBudgetSetup = async () => {
    const configured = isBudgetSetupConfigured(
      draftAssumptions,
      amountsFromDraftLimits(draftCategoryBudgets),
    );
    const ok = await onSaveBudgets({ preventDefault: () => {} } as FormEvent);
    if (ok) {
      setBudgetSetupEditing(false);
      setShowSavedBudgetSetupView(configured);
      if (!configured) {
        emptyAllBudgetSetupFields();
      }
    }
  };

  const handleResetBudgetSetup = async () => {
    const confirmed = window.confirm(
      'Delete your saved monthly income, starting balance, and all category limits? Custom budget lines and expense mappings on the Categories tab are kept.',
    );
    if (!confirmed) {
      return;
    }
    const ok = await onResetBudgetSetup();
    if (ok) {
      setBudgetSetupEditing(false);
      setShowSavedBudgetSetupView(false);
    }
  };

  useEffect(() => {
    setShowSavedBudgetSetupView(hasSavedBudgetSetup);
  }, [hasSavedBudgetSetup]);

  const budgetFeedbackIsSuccess =
    budgetSaveFeedback != null &&
    (budgetSaveFeedback.startsWith('Budget saved') || budgetSaveFeedback.startsWith('Budget setup cleared'));

  const incomeForBudgetSetup = Number(draftAssumptions.monthlyIncomeEstimate) || 0;
  const trustSavedCategoryLimits = savedBudgetLimitsAreCredible(
    categoryBudgetLimits,
    incomeForBudgetSetup,
  );
  const bucketTotals = useMemo(
    () => (incomeForBudgetSetup > 0 ? bucketTotals503020(incomeForBudgetSetup) : null),
    [incomeForBudgetSetup],
  );
  const suggestedLimits = useMemo(
    () =>
      incomeForBudgetSetup > 0 ? build503020CategoryBudgets(categories, incomeForBudgetSetup) : {},
    [categories, incomeForBudgetSetup],
  );

  const amountsFromDraftLimits = useCallback(
    (drafts: Record<string, string>): Record<string, number> => {
      const amounts: Record<string, number> = {};
      for (const c of categories) {
        if (Object.prototype.hasOwnProperty.call(drafts, c)) {
          const raw = drafts[c]?.trim() ?? '';
          if (!raw) {
            continue;
          }
          const n = parseLocaleAmountInput(raw);
          if (Number.isFinite(n) && n > 0) {
            amounts[c] = n;
          }
          continue;
        }
        const suggested = suggestedLimits[c] ?? 0;
        if (suggested > 0) {
          amounts[c] = suggested;
        }
      }
      return amounts;
    },
    [categories, suggestedLimits],
  );

  const categoryLimitInputValue = (cat: string): string => {
    if (Object.prototype.hasOwnProperty.call(draftCategoryBudgets, cat)) {
      return draftCategoryBudgets[cat] ?? '';
    }
    const suggestion = suggestedLimits[cat];
    return suggestion ? String(suggestion) : '';
  };

  const applyRebalancedDraftLimits = useCallback(
    (drafts: Record<string, string>, fixed: ReadonlySet<string>): Record<string, string> => {
      if (incomeForBudgetSetup <= 0) {
        return drafts;
      }
      const amounts = amountsFromDraftLimits(drafts);
      const total = Object.values(amounts).reduce((sum, n) => sum + n, 0);
      if (total <= incomeForBudgetSetup) {
        return drafts;
      }
      const balanced = rebalanceCategoryLimitsToIncome(
        categories,
        amounts,
        incomeForBudgetSetup,
        fixed,
      );
      const out = { ...drafts };
      for (const c of categories) {
        if (balanced[c] != null && balanced[c] > 0) {
          out[c] = String(balanced[c]);
        } else if (!fixed.has(c)) {
          out[c] = '';
        }
      }
      return out;
    },
    [categories, incomeForBudgetSetup, amountsFromDraftLimits],
  );

  const handleCategoryLimitChange = useCallback(
    (cat: string, raw: string) => {
      const fixed = new Set(manualLimitEdits);
      fixed.add(cat);
      setManualLimitEdits(fixed);
      setDraftCategoryBudgets((prev) => {
        const withEdit = { ...prev, [cat]: raw };
        return applyRebalancedDraftLimits(withEdit, fixed);
      });
    },
    [manualLimitEdits, applyRebalancedDraftLimits, setDraftCategoryBudgets],
  );

  useEffect(() => {
    if (mainTab !== 'budget_setup') {
      lastSuggestionIncomeRef.current = null;
      return;
    }
    if (incomeForBudgetSetup <= 0) {
      lastSuggestionIncomeRef.current = null;
      return;
    }
    const prevIncome = lastSuggestionIncomeRef.current;
    const incomeChanged = prevIncome !== null && prevIncome !== incomeForBudgetSetup;
    const next = build503020CategoryBudgets(categories, incomeForBudgetSetup);
    setDraftCategoryBudgets((prev) => {
      let changed = false;
      const merged = { ...prev };
      for (const [cat, amount] of Object.entries(next)) {
        if (amount <= 0) {
          continue;
        }
        if (manualLimitEdits.has(cat)) {
          continue;
        }
        if (incomeChanged) {
          merged[cat] = String(amount);
          changed = true;
          continue;
        }
        if (trustSavedCategoryLimits && (categoryBudgetLimits[cat] ?? 0) > 0) {
          continue;
        }
        const raw = merged[cat]?.trim() ?? '';
        const parsed = raw ? parseLocaleAmountInput(raw) : NaN;
        const shouldFill =
          !raw ||
          !Number.isFinite(parsed) ||
          parsed <= 0 ||
          parsed < amount * 0.25;
        if (shouldFill) {
          merged[cat] = String(amount);
          changed = true;
        }
      }
      const balanced = applyRebalancedDraftLimits(merged, manualLimitEdits);
      return balanced !== prev || changed ? balanced : prev;
    });
    lastSuggestionIncomeRef.current = incomeForBudgetSetup;
  }, [
    mainTab,
    incomeForBudgetSetup,
    categories,
    categoryBudgetLimits,
    trustSavedCategoryLimits,
    manualLimitEdits,
    setDraftCategoryBudgets,
    applyRebalancedDraftLimits,
  ]);

  const draftLimitAmount = (cat: string): number => {
    if (Object.prototype.hasOwnProperty.call(draftCategoryBudgets, cat)) {
      const raw = draftCategoryBudgets[cat]?.trim() ?? '';
      if (!raw) {
        return 0;
      }
      const n = parseLocaleAmountInput(raw);
      return Number.isFinite(n) && n > 0 ? n : 0;
    }
    const n = suggestedLimits[cat] ?? 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const draftTotal = categories.reduce((s, cat) => s + draftLimitAmount(cat), 0);

  const pctSpentOfBudget = totalBudgeted > 0 ? Math.round((totalSpentMonth / totalBudgeted) * 100) : 0;

  const showMonthInHeader =
    mainTab === 'overview' || mainTab === 'transactions' || mainTab === 'reports';

  const formatTableAmount = (value: number) => formatCurrencyAmount(value, budgetCurrency);

  return (
    <>
      <HeaderRow style={{ marginBottom: spacing.md }}>
        <ShellHeader style={{ width: '100%', marginBottom: 0 }}>
          <TitleBlock>
            <SectionTitle>Financial Overview</SectionTitle>
            <SectionSubtitle>Professional budgeting and analysis</SectionSubtitle>
          </TitleBlock>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' }}>
            {showMonthInHeader ? (
              <MonthNav as="label" style={{ cursor: 'pointer' }}>
                <MonthNavBtn
                  type="button"
                  aria-label="Previous month"
                  onClick={(e) => {
                    e.preventDefault();
                    shiftViewMonth(-1);
                  }}
                >
                  <ChevronsLeft size={18} />
                </MonthNavBtn>
                <Calendar size={16} style={{ color: colors.textMuted }} aria-hidden />
                <input
                  type="month"
                  value={monthPickerValue}
                  onChange={(e) => onMonthPickerChange(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: 0,
                    background: 'transparent',
                    font: 'inherit',
                    fontWeight: 600,
                    color: colors.textPrimary,
                    cursor: 'pointer',
                  }}
                  aria-label="Select month"
                />
                <MonthNavBtn
                  type="button"
                  aria-label="Next month"
                  onClick={(e) => {
                    e.preventDefault();
                    shiftViewMonth(1);
                  }}
                >
                  <ChevronsRight size={18} />
                </MonthNavBtn>
              </MonthNav>
            ) : null}
            <UserMenu />
          </div>
        </ShellHeader>
      </HeaderRow>

      <TabRow>
        {(
          [
            ['overview', 'Overview'],
            ['transactions', 'Transactions'],
            ['categories', 'Categories'],
            ['budget_setup', 'Budget Setup'],
            ['goals', 'Goals'],
            ['reports', 'Reports'],
          ] as const
        ).map(([id, label]) => (
          <TabBtn key={id} type="button" $active={mainTab === id} onClick={() => setMainTab(id)}>
            {label}
          </TabBtn>
        ))}
      </TabRow>

      {mainTab === 'overview' ? (
        <>
          <SummaryGrid>
            <SummaryCard>
              <SummaryLabel>Income</SummaryLabel>
              <SummaryValue $tone="income">
                <ArrowDownRight size={22} aria-hidden />
                {formatAmount(monthIncomeDisplay)}
              </SummaryValue>
              <SummaryHint>This month</SummaryHint>
            </SummaryCard>
            <SummaryCard>
              <SummaryLabel>Spent</SummaryLabel>
              <SummaryValue $tone="spent">
                <ArrowUpRight size={22} aria-hidden />
                {formatAmount(totalSpentMonth)}
              </SummaryValue>
              <SummaryHint>
                of {formatAmount(totalBudgeted)} budget
                {totalBudgeted > 0 ? ` (${pctSpentOfBudget}%)` : null}
              </SummaryHint>
            </SummaryCard>
            <SummaryCard>
              <SummaryLabel>Saved</SummaryLabel>
              <SummaryValue $tone="saved">
                <PiggyBank size={22} aria-hidden />
                {formatAmount(monthSaved)}
              </SummaryValue>
              <SummaryHint>
                {monthIncomeDisplay > 0
                  ? `${savingsRatePct.toFixed(0)}% of income`
                  : 'Add income entries or a monthly estimate in Budget Setup'}
              </SummaryHint>
            </SummaryCard>
            <SummaryCard>
              <SummaryLabel>Year-end balance (est.)</SummaryLabel>
              <SummaryValue $tone="income">{formatAmount(projectedEnd)}</SummaryValue>
              <SummaryHint>From income estimate &amp; spend pace · see Reports</SummaryHint>
            </SummaryCard>
          </SummaryGrid>

          {annualBudgetTotal > 0 ? (
            <MutedText style={{ marginBottom: spacing.lg }}>
              Your saved monthly budget template totals {formatAmount(totalBudgeted)}/month (
              {formatAmount(annualBudgetTotal)}/year). The month picker only changes which month&apos;s spending you
              compare against it.
            </MutedText>
          ) : null}

          <TwoCol>
            <PanelCard>
              <PanelHead>
                <PanelTitle>Budget categories</PanelTitle>
                <Button type="button" $variant="secondary" $size="sm" onClick={() => setMainTab('budget_setup')}>
                  + Add
                </Button>
              </PanelHead>
              {categoryRows.length === 0 ? (
                <MutedText>No categories yet. Set budgets in Budget Setup.</MutedText>
              ) : (
                categoryRows.map((row) => (
                  <CategoryRow key={row.name}>
                    <CatLabel>
                      <span>
                        <span
                          style={{
                            display: 'inline-block',
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            background: row.dot,
                            marginRight: 8,
                            verticalAlign: 'middle',
                          }}
                        />
                        {row.name}
                      </span>
                      <span>
                        {formatAmount(row.spent)} / {row.cap > 0 ? formatAmount(row.cap) : '—'}
                      </span>
                    </CatLabel>
                    <BarTrack>
                      <BarFill
                        $pct={row.cap > 0 ? row.pct : row.spent > 0 ? 100 : 0}
                        $color={row.dot}
                        $over={row.over}
                      />
                    </BarTrack>
                  </CategoryRow>
                ))
              )}
            </PanelCard>

            <PanelCard>
              <PanelHead>
                <PanelTitle>Recent transactions</PanelTitle>
              </PanelHead>
              {sortedRecentTx.slice(0, 6).length === 0 ? (
                <MutedText>No transactions this month.</MutedText>
              ) : (
                sortedRecentTx.slice(0, 6).map(({ expense: e }) => {
                  const incoming = e.flow === 'Incoming';
                  const { year, monthIndex, day } = expenseDateParts(e.transactionDate);
                  const dlabel = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  return (
                    <TxRow key={e.id}>
                      <TxIconWrap>{iconForExpense(e)}</TxIconWrap>
                      <TxMain>
                        <TxTitle>{e.title}</TxTitle>
                        <TxMeta>
                          {dlabel} · {resolveExpenseToBudgetCategory(e.category)}
                        </TxMeta>
                      </TxMain>
                      <TxAmt $incoming={incoming}>
                        {incoming ? '+' : '−'}
                        {formatAmount(e.amount)}
                      </TxAmt>
                    </TxRow>
                  );
                })
              )}
            </PanelCard>
          </TwoCol>

          <PanelCard style={{ marginBottom: spacing.lg }}>
            <PanelTitle style={{ marginBottom: spacing.sm }}>Expense → budget mapping</PanelTitle>
            <MutedText style={{ margin: 0 }}>
              Choose how each expense category (Groceries, Dining Out, etc.) rolls up to a budget line. Custom
              budget lines are created from the Categories tab dropdowns.
            </MutedText>
            <Button
              type="button"
              $variant="secondary"
              $weight="semibold"
              style={{ marginTop: spacing.md }}
              onClick={() => setMainTab('categories')}
            >
              {categoryMappingsDirty ? 'Categories — unsaved changes' : 'Manage category mapping'}
            </Button>
          </PanelCard>

          <InsightsCard>
            <SmartInsightsHeader>
              <Lightbulb size={18} aria-hidden />
              <SmartInsightsTitle>Smart insights</SmartInsightsTitle>
            </SmartInsightsHeader>
            {budgetInsights.length === 0 ? (
              <MutedText style={{ margin: 0 }}>
                Add budgets and expenses to unlock personalized observations and forecasts.
              </MutedText>
            ) : (
              budgetInsights.map((ins) => (
                <InsightItem key={ins.id}>
                  <InsightBadge $variant={ins.variant}>{insightBadgeLabel(ins.variant)}</InsightBadge>
                  <InsightMessage>{ins.message}</InsightMessage>
                </InsightItem>
              ))
            )}
          </InsightsCard>
        </>
      ) : null}

      {mainTab === 'transactions' ? (
        <PanelCard>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.md }}>
            <div style={{ flex: '1 1 240px', position: 'relative' }}>
              <Search
                size={18}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: colors.textMuted,
                }}
                aria-hidden
              />
              <Input
                placeholder="Search transactions…"
                value={txSearch}
                onChange={(ev) => setTxSearch(ev.target.value)}
                style={{ paddingLeft: 40 }}
              />
            </div>
            <select
              value={txCategoryFilter}
              onChange={(ev) => setTxCategoryFilter(ev.target.value)}
              style={{
                font: 'inherit',
                padding: '10px 12px',
                borderRadius: radii.sm,
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                minWidth: 160,
              }}
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Merchant</Th>
                  <Th>Category</Th>
                  <Th style={{ textAlign: 'right' }}>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((e) => {
                  const incoming = e.flow === 'Incoming';
                  const { year, monthIndex, day } = expenseDateParts(e.transactionDate);
                  const dlabel = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const cat = resolveExpenseToBudgetCategory(e.category);
                  return (
                    <tr key={e.id}>
                      <Td>{dlabel}</Td>
                      <Td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {iconForExpense(e)}
                          {e.title}
                        </div>
                      </Td>
                      <Td>
                        <CatPill>{cat}</CatPill>
                      </Td>
                      <Td style={{ textAlign: 'right', fontWeight: 700, color: incoming ? colors.success : colors.danger }}>
                        {incoming ? '+' : '−'}
                        {formatAmount(e.amount)}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
          {filteredTransactions.length === 0 ? (
            <MutedText style={{ marginTop: spacing.md }}>No transactions match your filters.</MutedText>
          ) : null}
        </PanelCard>
      ) : null}

      {mainTab === 'categories' ? (
        <PanelCard>
          <PanelTitle style={{ marginBottom: spacing.sm }}>Map expense categories to budget lines</PanelTitle>
          <MutedText style={{ display: 'block', marginBottom: spacing.lg }}>
            Each expense you log uses a category (for example Groceries or Transport). Pick which budget
            category that spend should count toward. Labels marked (default) follow the app&apos;s built-in
            grouping until you change them. Choose <strong>Create new category…</strong> in a dropdown to add a
            custom budget line, then save.
          </MutedText>
          {pendingNewBudgetCategory ? (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: spacing.sm,
                alignItems: 'center',
                marginBottom: spacing.lg,
                padding: spacing.md,
                borderRadius: radii.sm,
                border: `1px solid ${colors.border}`,
                background: colors.background,
              }}
            >
              <MutedText style={{ margin: 0, flex: '1 1 100%' }}>
                New budget category for <strong>{pendingNewBudgetCategory}</strong>
              </MutedText>
              <Input
                type="text"
                placeholder="Category name"
                maxLength={64}
                value={newBudgetCategoryName}
                onChange={(e) => setNewBudgetCategoryName(e.target.value)}
                style={{ flex: '1 1 220px', minWidth: 160 }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setPendingNewBudgetCategory(null);
                    setNewBudgetCategoryName('');
                  }
                }}
              />
              <Button
                type="button"
                $variant="accent"
                $weight="semibold"
                disabled={!newBudgetCategoryName.trim()}
                onClick={() => {
                  const name = newBudgetCategoryName.trim();
                  if (!name) {
                    return;
                  }
                  addBudgetCustomCategory(name);
                  setExpenseCategoryMapping(pendingNewBudgetCategory, name);
                  setPendingNewBudgetCategory(null);
                  setNewBudgetCategoryName('');
                }}
              >
                Add & assign
              </Button>
              <Button
                type="button"
                $variant="secondary"
                onClick={() => {
                  setPendingNewBudgetCategory(null);
                  setNewBudgetCategoryName('');
                }}
              >
                Cancel
              </Button>
            </div>
          ) : null}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: spacing.sm,
              marginBottom: spacing.lg,
              fontSize: '0.75rem',
              fontWeight: 700,
              color: colors.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <span>Expense category</span>
            <span>Budget category</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, maxHeight: 'min(60vh, 520px)', overflowY: 'auto' }}>
            {expenseCategoriesForMapping.map((expenseCat) => {
              const builtInDefault = toBudgetTopLevelCategory(expenseCat);
              return (
                <label
                  key={expenseCat}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: spacing.md,
                    alignItems: 'center',
                    paddingBottom: spacing.sm,
                    borderBottom: `1px solid ${colors.border}`,
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{expenseCat}</span>
                  <select
                    value={getExpenseCategoryMappingValue(expenseCat)}
                    onChange={(ev) => {
                      const value = ev.target.value;
                      if (value === CREATE_BUDGET_CATEGORY_OPTION) {
                        setPendingNewBudgetCategory(expenseCat);
                        setNewBudgetCategoryName('');
                        return;
                      }
                      setExpenseCategoryMapping(expenseCat, value);
                    }}
                    style={{
                      font: 'inherit',
                      padding: '10px 12px',
                      borderRadius: radii.sm,
                      border: `1px solid ${colors.border}`,
                      background: colors.surface,
                    }}
                  >
                    {budgetLinesForMapping.map((budgetCat) => (
                      <option key={budgetCat} value={budgetCat}>
                        {budgetCat}
                        {budgetCat === builtInDefault ? ' (default)' : ''}
                      </option>
                    ))}
                    <option value={CREATE_BUDGET_CATEGORY_OPTION}>+ Create new category…</option>
                  </select>
                </label>
              );
            })}
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.md,
              marginTop: spacing.lg,
              paddingTop: spacing.lg,
              borderTop: `1px solid ${colors.border}`,
            }}
          >
            <div>
              {categoryMappingsFeedback ? (
                <MutedText style={{ margin: 0, color: colors.success }}>{categoryMappingsFeedback}</MutedText>
              ) : categoryMappingsDirty ? (
                <MutedText style={{ margin: 0 }}>You have unsaved mapping changes.</MutedText>
              ) : (
                <MutedText style={{ margin: 0 }}>Mappings are saved.</MutedText>
              )}
            </div>
            <Button
              type="button"
              $variant="accent"
              $weight="semibold"
              disabled={savingCategoryMappings || !categoryMappingsDirty}
              onClick={() => void onSaveCategoryMappings()}
            >
              {savingCategoryMappings ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </PanelCard>
      ) : null}

      {mainTab === 'budget_setup' ? (
        <>
          {showBudgetSetupView ? (
            <PanelCard>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: spacing.md,
                  marginBottom: spacing.lg,
                }}
              >
                <div>
                  <PanelTitle style={{ margin: 0 }}>Saved budget setup</PanelTitle>
                  <MutedText style={{ margin: `${spacing.sm}px 0 0` }}>
                    Recurring monthly template used on Overview and Reports.
                  </MutedText>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
                  <Button type="button" $variant="accent" $weight="semibold" onClick={startBudgetSetupEdit}>
                    <Pencil size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} aria-hidden />
                    {hasSavedBudgetOnFile ? 'Edit budget' : 'Set up budget'}
                  </Button>
                  {hasSavedBudgetOnFile ? (
                    <Button
                      type="button"
                      $variant="danger"
                      $weight="semibold"
                      disabled={resettingBudget || savingBudget}
                      onClick={() => void handleResetBudgetSetup()}
                    >
                      {resettingBudget ? 'Clearing…' : 'Delete & start over'}
                    </Button>
                  ) : null}
                </div>
              </div>

              {budgetSaveFeedback ? (
                <MutedText
                  style={{
                    display: 'block',
                    marginBottom: spacing.lg,
                    color: budgetFeedbackIsSuccess ? colors.success : colors.danger,
                  }}
                >
                  {budgetSaveFeedback}
                </MutedText>
              ) : null}

              <Table style={{ marginBottom: spacing.lg }}>
                <tbody>
                  <tr>
                    <Th scope="row" style={{ width: '40%', fontSize: '0.8125rem', textTransform: 'none' }}>
                      Monthly income estimate
                    </Th>
                    <Td style={{ fontWeight: 600 }}>
                      {budgetAssumptions.monthlyIncomeEstimate > 0
                        ? formatAmount(budgetAssumptions.monthlyIncomeEstimate)
                        : '—'}
                    </Td>
                  </tr>
                  <tr>
                    <Th scope="row" style={{ fontSize: '0.8125rem', textTransform: 'none' }}>
                      Starting balance
                    </Th>
                    <Td style={{ fontWeight: 600 }}>
                      {budgetAssumptions.startingBalance !== 0
                        ? formatAmount(budgetAssumptions.startingBalance)
                        : '—'}
                    </Td>
                  </tr>
                  <tr>
                    <Th scope="row" style={{ fontSize: '0.8125rem', textTransform: 'none' }}>
                      Monthly budget total
                    </Th>
                    <Td style={{ fontWeight: 600 }}>
                      {totalBudgeted > 0 ? (
                        <>
                          {formatAmount(totalBudgeted)}
                          <MutedText as="span" style={{ marginLeft: 8, fontWeight: 500 }}>
                            ({formatAmount(annualBudgetTotal)}/year)
                          </MutedText>
                        </>
                      ) : (
                        '—'
                      )}
                    </Td>
                  </tr>
                </tbody>
              </Table>

              {savedBudgetRows.length === 0 ? (
                <MutedText>No category limits saved yet. Use Edit to add your monthly template.</MutedText>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Category</Th>
                        <Th>50/30/20</Th>
                        <Th style={{ textAlign: 'right' }}>Monthly limit ({budgetCurrency})</Th>
                        <Th style={{ textAlign: 'right' }}>% of monthly total</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {savedBudgetRows.map((row, idx) => {
                        return (
                          <tr key={row.name}>
                            <Td>
                              <span style={{ fontWeight: 600 }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    width: 8,
                                    height: 8,
                                    borderRadius: 999,
                                    background: [
                                      '#22c55e',
                                      '#0891b2',
                                      '#f97316',
                                      '#a855f7',
                                      '#eab308',
                                      '#ec4899',
                                      '#06b6d4',
                                      '#64748b',
                                    ][idx % 8],
                                    marginRight: 8,
                                    verticalAlign: 'middle',
                                  }}
                                />
                                {row.name}
                              </span>
                            </Td>
                            <Td>
                              <CatPill>{row.bucketLabel}</CatPill>
                            </Td>
                            <Td style={{ textAlign: 'right', fontWeight: 600 }}>{formatTableAmount(row.limit)}</Td>
                            <Td style={{ textAlign: 'right', color: colors.textMuted }}>
                              {formatShareOfMonthlyBudget(row.limit, totalBudgeted)}
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              )}
            </PanelCard>
          ) : (
            <>
              <GuidanceBanner>
                <AlertCircle size={22} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
                <div>
                  {incomeForBudgetSetup > 0 ? (
                    <>
                      Based on your income of <strong>{formatAmount(incomeForBudgetSetup)}/month</strong>, the 50/30/20
                      guideline allocates about <strong>{formatAmount(bucketTotals!.needs)}</strong> to{' '}
                      {BUCKET_LABELS.needs} (50%), <strong>{formatAmount(bucketTotals!.wants)}</strong> to{' '}
                      {BUCKET_LABELS.wants} (30%), and <strong>{formatAmount(bucketTotals!.savings)}</strong> to{' '}
                      {BUCKET_LABELS.savings} (20%). Per-category suggestions split each pool across your lines.
                    </>
                  ) : (
                    <>
                      Set a <strong>monthly income estimate</strong> to see 50/30/20 guidance and suggested limits
                      per category.
                    </>
                  )}
                </div>
              </GuidanceBanner>

              <PanelCard>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                  }}
                >
                  <PanelTitle style={{ marginBottom: spacing.sm }}>
                    {hasSavedBudgetSetup ? 'Edit budget setup' : 'Set up your budget'}
                  </PanelTitle>
                  <MutedText style={{ display: 'block', marginBottom: spacing.md }}>
                    {hasSavedBudgetSetup
                      ? 'Income and category limits apply every month. Save when you are done, or use Cancel to clear the form and start over.'
                      : 'Add your monthly income and category limits. This template is used on Overview and Reports. Cancel clears the income field and limits so you can start fresh.'}
                  </MutedText>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: spacing.sm,
                      justifyContent: 'flex-end',
                      marginBottom: spacing.lg,
                    }}
                  >
                    <Button
                      type="button"
                      $variant="secondary"
                      disabled={savingBudget || resettingBudget}
                      onClick={handleEmptyAllBudgetSetupFields}
                    >
                      Empty all fields
                    </Button>
                    <Button
                      type="button"
                      $variant="secondary"
                      disabled={savingBudget || resettingBudget}
                      onClick={handleCancelBudgetSetup}
                    >
                      Cancel
                    </Button>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: spacing.md,
                      marginBottom: spacing.lg,
                    }}
                  >
                    <label>
                      <MutedText style={{ display: 'block', marginBottom: 4 }}>Monthly income estimate</MutedText>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={draftAssumptions.monthlyIncomeEstimate || ''}
                        onChange={(ev) =>
                          setDraftAssumptions((prev) => ({
                            ...prev,
                            monthlyIncomeEstimate:
                              parseLocaleAmountInput(ev.target.value) || 0,
                          }))
                        }
                      />
                    </label>
                    <label>
                      <MutedText style={{ display: 'block', marginBottom: 4 }}>Starting balance (optional)</MutedText>
                      <Input
                        type="number"
                        step="0.01"
                        value={draftAssumptions.startingBalance || ''}
                        onChange={(ev) =>
                          setDraftAssumptions((prev) => ({
                            ...prev,
                            startingBalance: parseLocaleAmountInput(ev.target.value) || 0,
                          }))
                        }
                      />
                    </label>
                  </div>

                  <PanelTitle style={{ margin: `0 0 ${spacing.sm}px` }}>Monthly category limits</PanelTitle>
                  <MutedText style={{ display: 'block', marginBottom: spacing.md, maxWidth: 640 }}>
                    {incomeForBudgetSetup > 0 ? (
                      <>
                        Monthly limits are <strong>prefilled with suggested amounts</strong> from the 50/30/20 split
                        (Needs, Wants, Savings) based on your income estimate. They update when you change the income
                        figure, unless you have edited a line yourself. If the total exceeds your income,{' '}
                        <strong>other lines you have not edited</strong> are adjusted to fit. Use{' '}
                        <strong>Empty all fields</strong> to clear the form.
                      </>
                    ) : (
                      <>
                        After you enter a <strong>monthly income estimate</strong>, each limit is prefilled with a
                        suggested share of the 50/30/20 split. You can change any amount before saving.
                      </>
                    )}
                  </MutedText>

                  <div style={{ overflowX: 'auto' }}>
                    <Table>
                      <thead>
                        <tr>
                          <Th>Category</Th>
                          <Th>50/30/20</Th>
                          <Th style={{ minWidth: 140 }}>Monthly limit ({budgetCurrency})</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {categories.map((cat, idx) => {
                          const bucket = classifyBudget503020Bucket(cat);
                          return (
                            <tr key={cat}>
                              <Td>
                                <span style={{ fontWeight: 600 }}>
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      width: 8,
                                      height: 8,
                                      borderRadius: 999,
                                      background: [
                                        '#22c55e',
                                        '#0891b2',
                                        '#f97316',
                                        '#a855f7',
                                        '#eab308',
                                        '#ec4899',
                                        '#06b6d4',
                                        '#64748b',
                                      ][idx % 8],
                                      marginRight: 8,
                                      verticalAlign: 'middle',
                                    }}
                                  />
                                  {cat}
                                </span>
                              </Td>
                              <Td>
                                <CatPill>{BUCKET_LABELS[bucket]}</CatPill>
                              </Td>
                              <Td>
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  placeholder="0"
                                  value={categoryLimitInputValue(cat)}
                                  onChange={(ev) => handleCategoryLimitChange(cat, ev.target.value)}
                                  style={{ width: '100%', maxWidth: 160 }}
                                />
                              </Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: spacing.xl,
                      flexWrap: 'wrap',
                      gap: spacing.md,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>
                        Monthly total: {draftTotal > 0 ? formatAmount(draftTotal) : '—'}
                        {draftTotal > 0 ? (
                          <MutedText as="span" style={{ marginLeft: 8, fontWeight: 500 }}>
                            ({formatAmount(draftTotal * 12)}/year)
                          </MutedText>
                        ) : null}
                      </div>
                      {budgetSaveFeedback ? (
                        <MutedText
                          style={{
                            margin: `${spacing.sm}px 0 0`,
                            color: budgetFeedbackIsSuccess ? colors.success : colors.danger,
                          }}
                        >
                          {budgetSaveFeedback}
                        </MutedText>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      $variant="accent"
                      disabled={savingBudget || resettingBudget}
                      onClick={() => void handleSaveBudgetSetup()}
                    >
                      {savingBudget ? 'Saving…' : 'Save budget'}
                    </Button>
                  </div>
                </form>
              </PanelCard>
            </>
          )}
        </>
      ) : null}

      {mainTab === 'goals' ? (
        <GoalsTabInner goals={goals} persistGoals={persistGoals} formatAmount={formatAmount} />
      ) : null}

      {mainTab === 'reports' ? (
        <>
          <div style={{ marginBottom: spacing.lg }}>
            <BudgetForecastCharts
              formatAmount={formatAmount}
              chartTab={chartTab}
              setChartTab={setChartTab}
              chartRowsMonthly={chartRowsMonthly}
              yearTotals={yearTotals}
            />
          </div>

          <SummaryGrid style={{ marginBottom: spacing.lg }}>
            <SummaryCard>
              <SummaryLabel>Estimated balance now</SummaryLabel>
              <SummaryValue $tone="saved">{formatAmount(balanceNow)}</SummaryValue>
            </SummaryCard>
            <SummaryCard>
              <SummaryLabel>Projected year-end</SummaryLabel>
              <SummaryValue $tone="income">{formatAmount(projectedEnd)}</SummaryValue>
            </SummaryCard>
            <SummaryCard>
              <SummaryLabel>Annual budget template</SummaryLabel>
              <SummaryValue $tone="spent">
                {annualBudgetTotal > 0 ? formatAmount(annualBudgetTotal) : '—'}
              </SummaryValue>
              <SummaryHint>
                {totalBudgeted > 0 ? `${formatAmount(totalBudgeted)}/month saved` : 'Set limits in Budget Setup'}
              </SummaryHint>
            </SummaryCard>
          </SummaryGrid>

          <PanelCard style={{ marginBottom: spacing.lg }}>
            <PanelTitle style={{ marginBottom: spacing.md }}>6-month spending trend</PanelTitle>
            <div style={{ height: 320, width: '100%' }}>
              <ResponsiveContainer>
                <BarChart data={last6MonthsReport} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => (v == null ? '—' : formatAmount(Number(v)))} />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill={colors.success} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="spent" name="Spent" fill={colors.danger} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="budget" name="Budget" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </PanelCard>

          <TwoCol>
            <PanelCard>
              <PanelTitle style={{ marginBottom: spacing.md }}>Category analysis</PanelTitle>
              {reportsTopCategories.length === 0 ? (
                <MutedText>No category spend this month.</MutedText>
              ) : (
                reportsTopCategories.map((row) => (
                  <div
                    key={row.name}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 0',
                      borderBottom: `1px solid ${colors.border}`,
                      fontSize: '0.875rem',
                    }}
                  >
                    <span>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: row.dot,
                          marginRight: 8,
                        }}
                      />
                      {row.name}
                    </span>
                    <strong>{formatAmount(row.spent)}</strong>
                  </div>
                ))
              )}
            </PanelCard>
            <PanelCard>
              <PanelTitle style={{ marginBottom: spacing.md }}>Key metrics</PanelTitle>
              <div style={{ marginBottom: spacing.lg }}>
                <MutedText style={{ fontSize: '0.75rem' }}>Average monthly spending (6 mo.)</MutedText>
                <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{formatAmount(reportsAvgMonthlySpend)}</div>
              </div>
              <div style={{ marginBottom: spacing.lg }}>
                <MutedText style={{ fontSize: '0.75rem' }}>Average savings rate</MutedText>
                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: colors.success }}>
                  {reportsAvgSavingsRate.toFixed(1)}%
                </div>
              </div>
              <div>
                <MutedText style={{ fontSize: '0.75rem' }}>Most overspent category (this month)</MutedText>
                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: colors.danger }}>
                  {reportsMostOverspent ? reportsMostOverspent.name : '—'}
                </div>
                {reportsMostOverspent ? (
                  <MutedText style={{ fontSize: '0.8125rem' }}>
                    +{reportsMostOverspent.pct.toFixed(0)}% over budget
                  </MutedText>
                ) : null}
              </div>
            </PanelCard>
          </TwoCol>
        </>
      ) : null}
    </>
  );
};

const GoalFormCard = styled(PanelCard)`
  margin-bottom: ${spacing.lg};
`;

function GoalsTabInner({
  goals,
  persistGoals,
  formatAmount,
}: {
  goals: BudgetGoal[];
  persistGoals: (g: BudgetGoal[]) => void;
  formatAmount: (n: number) => string;
}): JSX.Element {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const addGoal = (ev: FormEvent) => {
    ev.preventDefault();
    setErr(null);
    const t = Number(target);
    const c = Number(current);
    if (!name.trim() || !Number.isFinite(t) || t <= 0 || !targetDate) {
      setErr('Enter a name, positive target amount, and target date.');
      return;
    }
    const g: BudgetGoal = {
      id: `${Date.now()}`,
      name: name.trim(),
      targetAmount: t,
      currentAmount: Number.isFinite(c) && c >= 0 ? c : 0,
      targetDateIso: targetDate,
    };
    persistGoals([...goals, g]);
    setName('');
    setTarget('');
    setCurrent('');
    setTargetDate('');
  };

  const today = new Date();
  return (
    <>
      <GoalFormCard>
        <PanelTitle style={{ marginBottom: spacing.md }}>Add a savings goal</PanelTitle>
        <form onSubmit={addGoal} style={{ display: 'grid', gap: spacing.md }}>
          <Input placeholder="Goal name (e.g. Emergency fund)" value={name} onChange={(e) => setName(e.target.value)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
            <Input type="number" placeholder="Target amount" value={target} onChange={(e) => setTarget(e.target.value)} />
            <Input
              type="number"
              placeholder="Saved so far (optional)"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          {err ? <ErrorText>{err}</ErrorText> : null}
          <Button type="submit" $variant="accent">
            Add goal
          </Button>
        </form>
      </GoalFormCard>

      {goals.length === 0 ? (
        <MutedText>No goals yet. Create one above — progress is saved on this device.</MutedText>
      ) : (
        goals.map((g) => {
          const targetD = new Date(g.targetDateIso);
          const monthsLeft = Math.max(
            1,
            (targetD.getFullYear() - today.getFullYear()) * 12 + (targetD.getMonth() - today.getMonth()),
          );
          const remaining = Math.max(0, g.targetAmount - g.currentAmount);
          const monthlyNeed = remaining / monthsLeft;
          const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0;
          return (
            <GoalCard key={g.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{g.name}</div>
                  <MutedText style={{ fontSize: '0.8125rem' }}>Target: {g.targetDateIso}</MutedText>
                </div>
                <Target size={22} color={colors.primary} aria-hidden />
              </div>
              <div style={{ marginTop: spacing.md, display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span>Progress</span>
                <strong>
                  {formatAmount(g.currentAmount)} / {formatAmount(g.targetAmount)}
                </strong>
              </div>
              <div style={{ marginTop: 6, height: 10, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: colors.primary,
                    transition: 'width 200ms ease',
                  }}
                />
              </div>
              <GoalGrid>
                <GoalStat>
                  <GoalStatLabel>Remaining</GoalStatLabel>
                  <GoalStatValue>{formatAmount(remaining)}</GoalStatValue>
                </GoalStat>
                <GoalStat>
                  <GoalStatLabel>Months left</GoalStatLabel>
                  <GoalStatValue>{monthsLeft}</GoalStatValue>
                </GoalStat>
                <GoalStat>
                  <GoalStatLabel>Monthly need</GoalStatLabel>
                  <GoalStatValue>{formatAmount(monthlyNeed)}</GoalStatValue>
                </GoalStat>
              </GoalGrid>
              <Button
                type="button"
                $variant="secondary"
                $size="sm"
                style={{ marginTop: spacing.md }}
                onClick={() => persistGoals(goals.filter((x) => x.id !== g.id))}
              >
                Remove goal
              </Button>
            </GoalCard>
          );
        })
      )}
    </>
  );
}
