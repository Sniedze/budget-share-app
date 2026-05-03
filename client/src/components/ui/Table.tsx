import styled from 'styled-components';
import { colors, radii } from '../../styles/tokens';

export const TableWrapper = styled.div`
  overflow-x: auto;
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
`;

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  min-width: 680px;
`;

export const Thead = styled.thead`
  background: #f9fafb;
`;

export const Tbody = styled.tbody``;

export const Th = styled.th`
  text-align: left;
  padding: 10px 12px;
  font-size: 11px;
  color: ${colors.textMuted};
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
`;

export const Tr = styled.tr`
  border-top: 1px solid ${colors.border};
`;

export const Td = styled.td`
  padding: 10px 12px;
  font-size: 14px;
  color: ${colors.textPrimary};
  vertical-align: middle;
`;
