import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { Button, MutedText } from '../components/ui';
import { colors, radii, spacing } from '../styles/tokens';

const Page = styled.main`
  min-height: 100vh;
  padding: ${spacing.xxl};
  background: ${colors.background};
`;

const Article = styled.article`
  max-width: 720px;
  margin: 0 auto;
  padding: ${spacing.xxl};
  border-radius: ${radii.lg};
  background: ${colors.surface};
  border: 1px solid ${colors.border};
`;

const Title = styled.h1`
  margin: 0 0 ${spacing.md};
  font-size: 1.75rem;
`;

const SectionTitle = styled.h2`
  margin: ${spacing.xl} 0 ${spacing.sm};
  font-size: 1.125rem;
`;

const Paragraph = styled.p`
  margin: 0 0 ${spacing.md};
  line-height: 1.6;
  color: ${colors.textPrimary};
`;

const List = styled.ul`
  margin: 0 0 ${spacing.md};
  padding-left: 1.25rem;
  line-height: 1.6;
`;

export const PrivacyPolicyPage = (): JSX.Element => {
  return (
    <Page>
      <Article>
        <Title>Privacy Policy</Title>
        <MutedText style={{ display: 'block', marginBottom: spacing.lg }}>
          Last updated: May 2026. This describes how BudgetShare handles personal data for the household
          expense-sharing service.
        </MutedText>

        <SectionTitle>What we collect</SectionTitle>
        <Paragraph>When you create an account and use the app, we process:</Paragraph>
        <List>
          <li>Account details: email address, display name, password (stored as a secure hash, never plain text).</li>
          <li>Optional profile fields: phone number, time zone, preferred currency.</li>
          <li>Expense data you enter or import: amounts, dates, categories, descriptions, split information.</li>
          <li>Household membership: member names and emails you add to shared groups.</li>
          <li>Settlement records between household members (who paid whom, amounts, dates).</li>
          <li>Technical data: session cookies for sign-in, request identifiers for error logs.</li>
        </List>
        <Paragraph>
          Bank statement files you import are parsed in your browser. We do not upload or store the original
          CSV/TXT files on our servers.
        </Paragraph>

        <SectionTitle>How we use your data</SectionTitle>
        <Paragraph>We use this information to:</Paragraph>
        <List>
          <li>Authenticate you and keep your session secure.</li>
          <li>Show shared expenses and balances to the household members you choose.</li>
          <li>Send invitation and account-related emails when SMTP is configured.</li>
          <li>Maintain audit logs for important account and household changes.</li>
        </List>
        <Paragraph>We do not sell your personal data.</Paragraph>

        <SectionTitle>Where data is stored</SectionTitle>
        <Paragraph>
          Data is stored in a MySQL database on the server that hosts your deployment (for example your VPS).
          Session tokens are issued as httpOnly cookies. Secrets such as database passwords and JWT keys stay
          in server environment variables, not in the web app bundle.
        </Paragraph>

        <SectionTitle>Retention</SectionTitle>
        <Paragraph>
          We keep your data while your account is active. Audit log entries may be purged automatically after
          a configured retention period. You can delete individual expenses and leave households from within
          the app.
        </Paragraph>

        <SectionTitle>Your choices</SectionTitle>
        <Paragraph>
          In Account settings you can update your profile, change your password, download a JSON export of
          your data, or permanently delete your account (password and confirmation required). Deletion
          removes your account and personal expenses; shared household expenses remain for other members
          but are no longer linked to your user id.
        </Paragraph>

        <Button as={Link} to="/login" $variant="secondary" style={{ marginTop: spacing.lg }}>
          Back to sign in
        </Button>
      </Article>
    </Page>
  );
};
