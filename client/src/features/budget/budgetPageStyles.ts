import styled from 'styled-components';
import { Card } from '../../components/ui';
import { colors, gradients, radii, spacing } from '../../styles/tokens';
import { BUDGET_TOP_LEVEL_CATEGORIES } from '../expenses';

export const DEFAULT_CATEGORY_OPTIONS = [...BUDGET_TOP_LEVEL_CATEGORIES];

export const CATEGORY_DOT_COLORS = [
  '#22c55e',
  '#0891b2',
  '#f97316',
  '#a855f7',
  '#06b6d4',
  '#ec4899',
  '#64748b',
];

export const SummaryGrid = styled.div`
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

export const SummaryCard = styled(Card)<{ $variant?: 'accent' }>`
  min-height: 96px;
  background: ${({ $variant }) => ($variant === 'accent' ? gradients.primary : colors.surface)};
  color: ${({ $variant }) => ($variant === 'accent' ? '#ffffff' : colors.textPrimary)};
  border: 1px solid ${({ $variant }) => ($variant === 'accent' ? 'transparent' : colors.border)};
  box-shadow: ${({ $variant }) => ($variant === 'accent' ? `0 10px 24px ${colors.primaryShadowStrong}` : 'none')};
`;

export const SummaryLabel = styled.div`
  font-size: 12px;
  font-weight: 600;
  opacity: 0.85;
  margin-bottom: 6px;
`;

export const SummaryValue = styled.div`
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
`;

export const SummaryHint = styled.div`
  margin-top: 6px;
  font-size: 12px;
  opacity: 0.8;
`;

export const OverviewCard = styled(Card)`
  margin-bottom: ${spacing.lg};
`;

export const OverviewHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${spacing.md};
  flex-wrap: wrap;
  margin-bottom: ${spacing.md};
`;

export const OverviewTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  color: ${colors.textPrimary};
`;

export const MonthInput = styled.input`
  font: inherit;
  padding: 8px 10px;
  border: 1px solid ${colors.border};
  border-radius: ${radii.sm};
  color: ${colors.textPrimary};
  background: ${colors.surface};
`;

export const OverviewMetrics = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${spacing.md};
  margin-bottom: ${spacing.md};

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

export const MetricBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

export const MetricLabel = styled.span`
  font-size: 12px;
  color: ${colors.textMuted};
  font-weight: 600;
`;

export const MetricValue = styled.span<{ $tone?: 'default' | 'blue' | 'green' | 'red' }>`
  font-size: 18px;
  font-weight: 700;
  color: ${({ $tone }) => {
    if ($tone === 'blue') return colors.primary;
    if ($tone === 'green') return colors.success;
    if ($tone === 'red') return colors.danger;
    return colors.textPrimary;
  }};
`;

export const ProgressTrack = styled.div`
  height: 12px;
  border-radius: ${radii.full};
  background: #e5e7eb;
  overflow: hidden;
`;

export const ProgressFill = styled.div<{ $pct: number; $over: boolean }>`
  height: 100%;
  width: ${({ $pct }) => `${Math.min(100, $pct)}%`};
  border-radius: ${radii.full};
  background: ${({ $over, $pct }) => ($over ? '#ef4444' : $pct > 90 ? '#f59e0b' : '#22c55e')};
  transition: width 180ms ease;
`;

export const ProgressMeta = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 13px;
  color: ${colors.textMuted};
`;

export const PillTabs = styled.div`
  display: inline-flex;
  gap: ${spacing.xs};
  padding: ${spacing.xs};
  border: 1px solid ${colors.border};
  border-radius: ${radii.full};
  background: ${colors.surface};
  flex-wrap: wrap;
`;

export const PillTab = styled.button<{ $active: boolean }>`
  border: 0;
  cursor: pointer;
  border-radius: ${radii.full};
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  color: ${({ $active }) => ($active ? colors.primaryLightText : colors.textMuted)};
  background: ${({ $active }) => ($active ? colors.primaryLightBg : 'transparent')};
  &:hover {
    background: ${({ $active }) => ($active ? colors.primaryLightBg : colors.background)};
  }
`;

export const ChartCard = styled(Card)`
  margin-bottom: ${spacing.lg};
`;

export const ChartFrame = styled.div`
  height: 280px;
  width: 100%;
  margin-top: ${spacing.md};
`;

export const Callout = styled.div`
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: ${spacing.md};
  border-radius: ${radii.md};
  background: ${colors.calloutBg};
  border: 1px solid ${colors.calloutBorder};
  color: ${colors.calloutText};
  font-size: 13px;
  line-height: 1.45;
  margin-top: ${spacing.md};
`;

export const DetailedSection = styled(Card)`
  margin-bottom: ${spacing.xl};
`;

export const SectionHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${spacing.md};
  flex-wrap: wrap;
  margin-bottom: ${spacing.md};
`;

export const CategoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
`;

export const CategoryCard = styled.div`
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  padding: ${spacing.md};
  background: ${colors.surface};
`;

export const CategoryTop = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${spacing.md};
  flex-wrap: wrap;
  margin-bottom: 8px;
`;

export const CategoryName = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  color: ${colors.textPrimary};
`;

export const Dot = styled.span<{ $color: string }>`
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: ${({ $color }) => $color};
`;

export const CategoryAmounts = styled.div`
  font-size: 14px;
  color: ${colors.textMuted};
  text-align: right;
`;

export const CategoryFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 12px;
  color: ${colors.textMuted};
`;

export const TrendTag = styled.span<{ $trend: 'up' | 'down' | 'stable' }>`
  font-weight: 600;
  color: ${({ $trend }) =>
    $trend === 'up' ? colors.amountNegative : $trend === 'down' ? colors.amountPositive : colors.textMuted};
`;

export const CategoryBar = styled.div<{ $pct: number; $color: string; $over: boolean }>`
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

export const Pill = styled.span`
  display: inline-block;
  padding: 3px 10px;
  border-radius: ${radii.full};
  font-size: 12px;
  font-weight: 600;
  background: ${colors.primaryLightBg};
  color: ${colors.primaryLightText};
`;

export const StatusPill = styled.span<{ $variant: 'under' | 'over' }>`
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

export const MiniTrend = styled.span<{ $trend: 'up' | 'down' | 'stable' }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: ${({ $trend }) =>
    $trend === 'up' ? colors.amountNegative : $trend === 'down' ? colors.amountPositive : colors.textMuted};
`;

export const ModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: ${spacing.lg};
`;

export const ModalPanel = styled.div`
  width: min(520px, 100%);
  max-height: min(88vh, 720px);
  overflow: auto;
  background: ${colors.surface};
  border-radius: ${radii.lg};
  padding: ${spacing.xl};
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.2);
`;

export const ModalTitle = styled.h2`
  margin: 0 0 ${spacing.sm};
  font-size: 18px;
`;

export const FormGrid = styled.div`
  display: grid;
  gap: ${spacing.md};
  margin-top: ${spacing.md};
`;

export const CategoryBudgetRow = styled.label`
  display: grid;
  grid-template-columns: 1fr 120px;
  gap: ${spacing.sm};
  align-items: center;
  font-size: 13px;
  color: ${colors.textPrimary};
`;

export const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${spacing.sm};
  margin-top: ${spacing.xl};
`;
