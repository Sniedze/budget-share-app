import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { PRIVACY_POLICY_PATH } from '../../routes';
import { colors, spacing } from '../../styles/tokens';

const Footer = styled.p`
  margin: ${spacing.lg} 0 0;
  text-align: center;
  font-size: 0.8125rem;
  color: ${colors.textMuted};
  line-height: 1.5;
`;

export const AuthLegalFooter = (): JSX.Element => (
  <Footer>
    <Link to={PRIVACY_POLICY_PATH}>Privacy Policy</Link>
  </Footer>
);
