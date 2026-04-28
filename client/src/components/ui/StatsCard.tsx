import styled from 'styled-components';
import { colors } from '../../styles/tokens';
import { Card } from './Card';

type StatsCardProps = {
  label: string;
  value: string;
  hint: string;
};

const StatsCardContainer = styled(Card)`
  flex: 1 1 180px;
  min-width: 180px;
`;

const Label = styled.p`
  margin: 0 0 6px;
  color: ${colors.textMuted};
  font-size: 12px;
`;

const Value = styled.p`
  margin: 0;
  color: ${colors.textPrimary};
  font-size: 28px;
  font-weight: 700;
  line-height: 1.1;
`;

const Hint = styled.p`
  margin: 6px 0 0;
  color: ${colors.textSubtle};
  font-size: 12px;
`;

export const StatsCard = ({ label, value, hint }: StatsCardProps): JSX.Element => {
  return (
    <StatsCardContainer>
      <Label>{label}</Label>
      <Value>{value}</Value>
      <Hint>{hint}</Hint>
    </StatsCardContainer>
  );
};
