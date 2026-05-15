import styled from 'styled-components';
import { colors, spacing } from '../../styles/tokens';

const LoadingRoot = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40vh;
  padding: ${spacing.xl};
  color: ${colors.textMuted};
  font-size: 15px;
`;

export const PageLoading = (): JSX.Element => <LoadingRoot>Loading…</LoadingRoot>;
