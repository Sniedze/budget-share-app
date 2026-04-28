import styled from 'styled-components';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'accent';

export const Button = styled.button<{ $variant?: ButtonVariant }>`
  font: inherit;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  color: #ffffff;
  cursor: pointer;
  background: ${({ $variant = 'primary' }) => {
    if ($variant === 'secondary') return '#6b7280';
    if ($variant === 'danger') return '#ef4444';
    if ($variant === 'accent') return '#4f46e5';
    return '#2563eb';
  }};

  &:hover {
    background: ${({ $variant = 'primary' }) => {
      if ($variant === 'secondary') return '#4b5563';
      if ($variant === 'danger') return '#dc2626';
      if ($variant === 'accent') return '#4338ca';
      return '#1d4ed8';
    }};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
