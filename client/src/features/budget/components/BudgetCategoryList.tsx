import { MutedText } from '../../../components/ui';
import { formatAppCurrency } from '../../../format/currency';
import { spacing } from '../../../styles/tokens';
import type { CategoryBudgetDisplayRow } from '../budgetPageTypes';
import {
  CategoryAmounts,
  CategoryBar,
  CategoryCard,
  CategoryFooter,
  CategoryList,
  CategoryName,
  CategoryTop,
  Dot,
  OverviewTitle,
  TrendTag,
} from '../budgetPageStyles';

type BudgetCategoryListProps = {
  categoryRows: CategoryBudgetDisplayRow[];
};

export const BudgetCategoryList = ({ categoryRows }: BudgetCategoryListProps): JSX.Element => {
  return (
  <>
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
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>
                        {formatAppCurrency(row.remaining)} left
                      </span>
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
  </>
  );
};
