import styled from 'styled-components';
import { colors } from '../../styles/tokens';

export const SectionTitle = styled.h1`
  margin: 0;
  font-size: 34px;
  line-height: 1.1;
`;

export const SectionSubtitle = styled.p`
  margin: 6px 0 0;
  color: ${colors.textMuted};
  font-size: 14px;
`;

export const MutedText = styled.p`
  color: ${colors.textMuted};
`;

export const ErrorText = styled.p`
  margin: 0;
  color: ${colors.danger};
  font-size: 13px;
`;
