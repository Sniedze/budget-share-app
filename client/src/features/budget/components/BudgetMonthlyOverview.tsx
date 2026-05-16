import { MutedText } from '../../../components/ui';
import { formatAppCurrency } from '../../../format/currency';
import {
  MetricBlock,
  MetricLabel,
  MetricValue,
  MonthInput,
  OverviewCard,
  OverviewHeader,
  OverviewMetrics,
  OverviewTitle,
  ProgressFill,
  ProgressMeta,
  ProgressTrack,
} from '../budgetPageStyles';

type BudgetMonthlyOverviewProps = {
  viewYear: number;
  viewMonthIndex: number;
  monthPickerValue: string;
  onMonthPickerChange: (value: string) => void;
  totalBudgeted: number;
  totalSpentMonth: number;
  remainingBudget: number;
  usagePct: number;
};

export const BudgetMonthlyOverview = ({
  viewYear,
  viewMonthIndex,
  monthPickerValue,
  onMonthPickerChange,
  totalBudgeted,
  totalSpentMonth,
  remainingBudget,
  usagePct,
}: BudgetMonthlyOverviewProps): JSX.Element => {
  return (
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
  );
};
