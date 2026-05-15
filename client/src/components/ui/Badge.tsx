import styled from 'styled-components';
import { colors, radii } from '../../styles/tokens';

export type BadgeVariant = 'default' | 'accent' | 'danger';

export const Badge = styled.span<{ $variant?: BadgeVariant }>`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: ${radii.full};
  font-size: 11px;
  font-weight: 600;
  color: ${({ $variant = 'default' }) =>
    $variant === 'accent' ? colors.accent : $variant === 'danger' ? '#b91c1c' : colors.textMuted};
  background: ${({ $variant = 'default' }) =>
    $variant === 'accent' ? colors.sidebarActiveBg : $variant === 'danger' ? '#fee2e2' : '#f3f4f6'};
`;
