import styled from 'styled-components';
import { colors, radii } from '../../styles/tokens';

export const Card = styled.article`
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  background: ${colors.surface};
  padding: 14px;
`;
