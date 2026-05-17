import { formatAppCurrency } from '../../../format/currency';
import { colors } from '../../../styles/tokens';
import type { FormatBudgetAmount } from '../budgetPageTypes';
import { ytdRangeLabel } from '../selectors';
import { SummaryCard, SummaryGrid, SummaryHint, SummaryLabel, SummaryValue } from '../budgetPageStyles';

type BudgetSummaryCardsProps = {
  formatAmount?: FormatBudgetAmount;
  balanceNow: number;
  balanceDeltaYtd: number;
  projectedEnd: number;
  ytdIncCombined: number;
  ytdIncomingActual: number;
  ytdIncEstimate: number;
  ytdExp: number;
  now: Date;
};

export const BudgetSummaryCards = ({
  formatAmount = formatAppCurrency,
  balanceNow,
  balanceDeltaYtd,
  projectedEnd,
  ytdIncCombined,
  ytdIncomingActual,
  ytdIncEstimate,
  ytdExp,
  now,
}: BudgetSummaryCardsProps): JSX.Element => {
  return (
    <SummaryGrid>
      <SummaryCard $variant="accent">
        <SummaryLabel>Current balance</SummaryLabel>
        <SummaryValue>{formatAmount(balanceNow)}</SummaryValue>
        <SummaryHint>
          {balanceDeltaYtd >= 0 ? '+' : ''}
          {formatAmount(balanceDeltaYtd)} YTD cash flow
        </SummaryHint>
      </SummaryCard>
      <SummaryCard>
        <SummaryLabel>Projected (year end)</SummaryLabel>
        <SummaryValue>{formatAmount(projectedEnd)}</SummaryValue>
        <SummaryHint>Based on income estimate &amp; spend trend</SummaryHint>
      </SummaryCard>
      <SummaryCard>
        <SummaryLabel>YTD income</SummaryLabel>
        <SummaryValue style={{ color: colors.amountPositive }}>+{formatAmount(ytdIncCombined)}</SummaryValue>
        <SummaryHint>
          {ytdRangeLabel(now)} · imported {formatAmount(ytdIncomingActual)} + estimate{' '}
          {formatAmount(ytdIncEstimate)}
        </SummaryHint>
      </SummaryCard>
      <SummaryCard>
        <SummaryLabel>YTD expenses</SummaryLabel>
        <SummaryValue style={{ color: colors.amountNegative }}>-{formatAmount(ytdExp)}</SummaryValue>
        <SummaryHint>{ytdRangeLabel(now)}</SummaryHint>
      </SummaryCard>
    </SummaryGrid>
  );
};
