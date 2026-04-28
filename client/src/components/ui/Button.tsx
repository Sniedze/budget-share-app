import styled from 'styled-components';
import { colors, radii } from '../../styles/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'accent';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonRadius = 'sm' | 'md';
export type ButtonWeight = 'normal' | 'semibold';
export type ButtonElevation = 'none' | 'accent';

type ButtonProps = {
  $variant?: ButtonVariant;
  $size?: ButtonSize;
  $radius?: ButtonRadius;
  $weight?: ButtonWeight;
  $elevation?: ButtonElevation;
};

export const Button = styled.button<ButtonProps>`
  font: inherit;
  padding: ${({ $size = 'md' }) => {
    if ($size === 'sm') return '8px 10px';
    if ($size === 'lg') return '10px 16px';
    return '10px 12px';
  }};
  border: none;
  border-radius: ${({ $radius = 'sm' }) => ($radius === 'md' ? radii.md : radii.sm)};
  font-size: ${({ $size = 'md' }) => ($size === 'sm' ? '13px' : '14px')};
  font-weight: ${({ $weight = 'normal' }) => ($weight === 'semibold' ? 600 : 500)};
  color: ${colors.surface};
  cursor: pointer;
  box-shadow: ${({ $elevation = 'none' }) =>
    $elevation === 'accent' ? '0 10px 18px rgba(79, 70, 229, 0.2)' : 'none'};
  background: ${({ $variant = 'primary' }) => {
    if ($variant === 'secondary') return colors.secondary;
    if ($variant === 'danger') return colors.danger;
    if ($variant === 'accent') return colors.accent;
    return colors.primary;
  }};

  &:hover {
    background: ${({ $variant = 'primary' }) => {
      if ($variant === 'secondary') return colors.secondaryHover;
      if ($variant === 'danger') return colors.dangerHover;
      if ($variant === 'accent') return colors.accentHover;
      return colors.primaryHover;
    }};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
