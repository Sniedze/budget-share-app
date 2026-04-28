import styled from 'styled-components';
import { colors, radii } from '../../styles/tokens';

export type InputSize = 'sm' | 'md';

type InputProps = {
  $size?: InputSize;
};

export const Input = styled.input<InputProps>`
  font: inherit;
  padding: ${({ $size = 'md' }) => ($size === 'sm' ? '8px 10px' : '10px 12px')};
  border-radius: ${radii.sm};
  border: 1px solid ${colors.border};
  background: ${colors.surface};
  color: ${colors.textPrimary};
  min-width: 140px;

  &::placeholder {
    color: ${colors.textSubtle};
  }

  &:focus {
    outline: 2px solid rgba(79, 70, 229, 0.25);
    outline-offset: 1px;
    border-color: ${colors.accent};
  }
`;
