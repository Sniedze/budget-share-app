import styled from 'styled-components';
import { colors, spacing } from '../../styles/tokens';
import { Card } from './Card';
import { Button } from './Button';

export const AuthPage = styled.main`
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: linear-gradient(180deg, #e7ecfa 0%, #dfe6f8 100%);
  padding: ${spacing.xl};
`;

export const AuthCard = styled(Card)`
  display: grid;
  gap: ${spacing.lg};
  width: min(470px, 100%);
  padding: 28px 32px;
  border-radius: 16px;
  border: 1px solid #d7ddeb;
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.12);
`;

export const AuthForm = styled.form`
  display: grid;
  gap: ${spacing.sm};
`;

export const AuthActions = styled.div`
  margin-top: ${spacing.sm};
`;

export const AuthHeader = styled.div`
  display: grid;
  gap: ${spacing.sm};
  text-align: center;
`;

export const AuthEyebrow = styled.span`
  margin: 0 auto;
  display: grid;
  place-items: center;
  width: 60px;
  height: 60px;
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  background: linear-gradient(145deg, #4f46e5, #4338ca);
  border-radius: 999px;
  box-shadow: 0 8px 18px rgba(79, 70, 229, 0.35);
`;

export const FieldLabel = styled.label`
  display: flex;
  gap: 4px;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-top: ${spacing.xs};
`;

export const RequiredMark = styled.span`
  color: ${colors.danger};
`;

export const AuthTabs = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${spacing.sm};
`;

export const AuthTabButton = styled(Button)<{ $active?: boolean }>`
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: ${({ $active }) => ($active ? 'linear-gradient(145deg, #4f46e5, #4338ca)' : '#e5e7eb')};
  color: ${({ $active }) => ($active ? '#ffffff' : '#4b5563')};

  &:hover {
    background: ${({ $active }) => ($active ? 'linear-gradient(145deg, #4338ca, #3730a3)' : '#d1d5db')};
  }
`;
