import styled from 'styled-components';
import { colors, gradients, radii, spacing } from '../../styles/tokens';

export const SummaryGrid = styled.section`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: ${spacing.md};
  margin-bottom: ${spacing.xl};

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

export const SummaryCard = styled.article<{ $featured?: boolean }>`
  position: relative;
  border-radius: ${radii.lg};
  border: 1px solid ${({ $featured }) => ($featured ? 'transparent' : colors.border)};
  background: ${({ $featured }) => ($featured ? gradients.primary : colors.surface)};
  color: ${({ $featured }) => ($featured ? '#ffffff' : colors.textPrimary)};
  padding: ${spacing.lg};
  min-height: 118px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: ${({ $featured }) =>
    $featured ? `0 12px 24px ${colors.primaryShadowStrong}` : '0 1px 2px rgba(15, 23, 42, 0.04)'};
`;

export const SummaryCardTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${spacing.sm};
`;

export const SummaryLabel = styled.p<{ $featured?: boolean }>`
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  color: ${({ $featured }) => ($featured ? 'rgba(255,255,255,0.88)' : colors.textMuted)};
`;

export const SummaryValue = styled.p<{ $tone?: 'positive' | 'negative' | 'neutral'; $featured?: boolean }>`
  margin: ${spacing.sm} 0 0;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.1;
  color: ${({ $featured, $tone }) => {
    if ($featured) {
      return '#ffffff';
    }
    if ($tone === 'positive') {
      return colors.success;
    }
    if ($tone === 'negative') {
      return colors.danger;
    }
    return colors.textPrimary;
  }};
`;

export const SummaryHint = styled.p<{ $featured?: boolean }>`
  margin: 6px 0 0;
  font-size: 12px;
  color: ${({ $featured }) => ($featured ? 'rgba(255,255,255,0.78)' : colors.textSubtle)};
`;

export const IconBadge = styled.span<{ $featured?: boolean; $tone?: 'green' | 'red' | 'amber' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: ${radii.md};
  background: ${({ $featured, $tone }) => {
    if ($featured) {
      return 'rgba(255,255,255,0.18)';
    }
    if ($tone === 'green') {
      return '#dcfce7';
    }
    if ($tone === 'red') {
      return '#fee2e2';
    }
    if ($tone === 'amber') {
      return '#ffedd5';
    }
    return '#f3f4f6';
  }};
  color: ${({ $featured, $tone }) => {
    if ($featured) {
      return '#ffffff';
    }
    if ($tone === 'green') {
      return '#16a34a';
    }
    if ($tone === 'red') {
      return colors.danger;
    }
    if ($tone === 'amber') {
      return '#ea580c';
    }
    return colors.textMuted;
  }};
`;

export const Panel = styled.section`
  border: 1px solid ${colors.border};
  border-radius: ${radii.lg};
  background: ${colors.surface};
  padding: ${spacing.lg};
  margin-bottom: ${spacing.xl};
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
`;

export const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing.md};
  margin-bottom: ${spacing.lg};
  flex-wrap: wrap;
`;

export const PanelTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: ${colors.textPrimary};
`;

export const TabGroup = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: ${radii.full};
  background: ${colors.background};
`;

export const TabButton = styled.button<{ $active: boolean }>`
  border: 0;
  cursor: pointer;
  border-radius: ${radii.full};
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  color: ${({ $active }) => ($active ? colors.primaryLightText : colors.textMuted)};
  background: ${({ $active }) => ($active ? colors.primaryLightBg : 'transparent')};
  box-shadow: ${({ $active }) => ($active ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none')};
`;

export const BalanceList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: ${spacing.md};
`;

export const BalanceRow = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing.md};
  padding: ${spacing.md} 0;
  border-bottom: 1px solid ${colors.border};

  &:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }

  &:first-child {
    padding-top: 0;
  }
`;

export const BalanceIdentity = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.md};
  min-width: 0;
`;

export const Avatar = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: ${radii.full};
  background: ${colors.primaryLighterBg};
  color: ${colors.primaryLighterText};
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
`;

export const BalanceName = styled.p`
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: ${colors.textPrimary};
`;

export const BalanceStatus = styled.p`
  margin: 2px 0 0;
  font-size: 13px;
  color: ${colors.textMuted};
`;

export const BalanceAmount = styled.span<{ $tone: 'positive' | 'negative' }>`
  font-size: 15px;
  font-weight: 600;
  color: ${({ $tone }) => ($tone === 'positive' ? colors.success : colors.danger)};
  white-space: nowrap;
`;

export const ToolbarRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing.md};
  align-items: end;
  margin-bottom: ${spacing.lg};
`;

export const ToolbarField = styled.label`
  display: grid;
  gap: 6px;
  font-size: 13px;
  color: ${colors.textMuted};
  min-width: 160px;
`;

export const ToolbarSelect = styled.select`
  font: inherit;
  padding: 10px 12px;
  border: 1px solid ${colors.border};
  border-radius: ${radii.sm};
  background: ${colors.surface};
`;

export const ActionCell = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing.sm};
  align-items: center;
`;

export const StatusPill = styled.span<{ $variant: 'pending' | 'paid' | 'overdue' }>`
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: ${radii.full};
  font-size: 12px;
  font-weight: 600;
  background: ${({ $variant }) => {
    if ($variant === 'paid') {
      return '#dcfce7';
    }
    if ($variant === 'overdue') {
      return '#fee2e2';
    }
    return '#fef3c7';
  }};
  color: ${({ $variant }) => {
    if ($variant === 'paid') {
      return '#15803d';
    }
    if ($variant === 'overdue') {
      return '#b91c1c';
    }
    return '#b45309';
  }};
`;

export const RecordPanel = styled.div`
  margin-top: ${spacing.lg};
  padding-top: ${spacing.lg};
  border-top: 1px solid ${colors.border};
`;

export const RecordFormGrid = styled.form`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${spacing.md};
  align-items: end;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

export const MonthlyGroup = styled.div`
  margin-bottom: ${spacing.lg};

  &:last-child {
    margin-bottom: 0;
  }
`;

export const MonthlyGroupTitle = styled.h3`
  margin: 0 0 ${spacing.sm};
  font-size: 14px;
  font-weight: 600;
  color: ${colors.textMuted};
`;
