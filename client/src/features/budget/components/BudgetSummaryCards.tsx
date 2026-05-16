import { formatAppCurrency } from '../../../format/currency';
import { ytdRangeLabel } from '../selectors';
import { SummaryCard, SummaryGrid, SummaryHint, SummaryLabel, SummaryValue } from '../budgetPageStyles';

type BudgetSummaryCardsProps = {
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
        <SummaryValue style={{ color: '#16a34a' }}>+{formatAppCurrency(ytdIncCombined)}</SummaryValue>
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
  );
};
