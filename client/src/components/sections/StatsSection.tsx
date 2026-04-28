import styled from 'styled-components';
import type { DashboardStat } from '../../features/expenses';
import { spacing } from '../../styles/tokens';
import { StatsCard } from '../ui';

const StatsRow = styled.section`
  display: flex;
  gap: ${spacing.md};
  margin-bottom: ${spacing.xl};
  flex-wrap: wrap;
`;

type StatsSectionProps = {
  stats: DashboardStat[];
};

export const StatsSection = ({ stats }: StatsSectionProps): JSX.Element => {
  return (
    <StatsRow>
      {stats.map((stat) => (
        <StatsCard key={stat.label} label={stat.label} value={stat.value} hint={stat.hint} />
      ))}
    </StatsRow>
  );
};
