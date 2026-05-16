import styled from 'styled-components';
import { Card, Input } from '../../components/ui';
import { colors, spacing } from '../../styles/tokens';

export const Panel = styled(Card)`
  display: grid;
  gap: ${spacing.md};
  margin-bottom: ${spacing.lg};
  padding: ${spacing.lg};
`;

export const Actions = styled.div`
  display: flex;
  gap: ${spacing.sm};
  flex-wrap: wrap;
`;

export const UploadBox = styled.div<{ $isDragActive: boolean }>`
  border: 1px dashed #d1d5db;
  border-radius: 12px;
  min-height: 280px;
  display: grid;
  place-items: center;
  text-align: center;
  background: ${({ $isDragActive }) => ($isDragActive ? colors.primaryLighterBg : '#fafafa')};
  border-color: ${({ $isDragActive }) => ($isDragActive ? colors.primary : '#d1d5db')};
  transition: background-color 120ms ease, border-color 120ms ease;
`;

export const UploadInner = styled.div`
  display: grid;
  gap: ${spacing.sm};
  justify-items: center;
  max-width: 520px;
`;

export const UploadIconWrap = styled.div`
  color: ${colors.textSubtle};
  display: inline-flex;
`;

export const HiddenFileInput = styled(Input)`
  display: none;
`;

export const UploadPrimaryText = styled.h4`
  margin: 0;
  font-size: 22px;
  color: ${colors.textPrimary};
`;

export const UploadSecondaryText = styled.p`
  margin: 0;
  font-size: 14px;
  color: ${colors.textMuted};
`;

export const DropHint = styled.p`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: ${colors.primaryLightText};
`;

export const UploadFootnote = styled.p`
  margin: ${spacing.sm} 0 0;
  font-size: 12px;
  color: ${colors.textSubtle};
`;

export const UploadedFileName = styled.p`
  margin: 0;
  font-size: 13px;
  color: ${colors.textMuted};
`;

export const InlineInput = styled(Input)`
  min-width: 120px;
`;

export const CurrencyInput = styled(InlineInput)`
  min-width: 84px;
  width: 84px;
`;

export const AmountInput = styled(InlineInput)`
  min-width: 96px;
  width: 96px;
`;

export const CategorySelect = styled(InlineInput)`
  min-width: 170px;
  width: 170px;
`;

export const ImportSummary = styled.div`
  display: flex;
  gap: ${spacing.lg};
  flex-wrap: wrap;
  font-size: 13px;
  color: ${colors.textMuted};
`;

export const DuplicateNotice = styled(Card)<{ $severity: 'warning' | 'info' }>`
  margin: ${spacing.sm} 0;
  border-color: ${({ $severity }) => ($severity === 'warning' ? '#f59e0b' : colors.border)};
  background: ${({ $severity }) => ($severity === 'warning' ? '#fff7ed' : '#f8fafc')};
  padding: ${spacing.sm} ${spacing.md};
`;

export const RulePanel = styled(Card)`
  margin: ${spacing.sm} 0;
  padding: ${spacing.sm} ${spacing.md};
  display: grid;
  gap: ${spacing.sm};
`;

export const RuleRow = styled.div`
  display: grid;
  grid-template-columns: 80px 100px minmax(160px, 1fr) 160px 120px 140px 160px auto;
  gap: ${spacing.sm};
  align-items: center;
`;
