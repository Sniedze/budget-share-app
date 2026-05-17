import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { Button, ErrorText, MutedText, PageLoading } from '../components/ui';
import { useAuth } from '../features/auth';
import { colors, radii, spacing } from '../styles/tokens';

const Panel = styled.main`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${spacing.xxl};
  background: ${colors.background};
`;

const Card = styled.section`
  width: min(480px, 100%);
  padding: ${spacing.xxl};
  border-radius: ${radii.lg};
  background: ${colors.surface};
  border: 1px solid ${colors.border};
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
`;

const Title = styled.h1`
  margin: 0 0 ${spacing.sm};
  font-size: 1.5rem;
`;

export const ConfirmEmailChangePage = (): JSX.Element => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { confirmEmailChange } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [confirmedEmail, setConfirmedEmail] = useState('');

  useEffect(() => {
    const token = searchParams.get('token')?.trim() ?? '';
    if (!token) {
      setStatus('error');
      setMessage('This confirmation link is missing a token.');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const user = await confirmEmailChange(token);
        if (cancelled) {
          return;
        }
        setConfirmedEmail(user.email);
        setStatus('success');
        setMessage('Your email address has been updated. Sign in with your new email.');
      } catch (error) {
        if (cancelled) {
          return;
        }
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Could not confirm email change.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [confirmEmailChange, searchParams]);

  return (
    <Panel>
      <Card>
        {status === 'loading' ? <PageLoading /> : null}
        {status === 'success' ? (
          <>
            <Title>Email confirmed</Title>
            <MutedText>{message}</MutedText>
            {confirmedEmail ? (
              <MutedText style={{ marginTop: spacing.sm }}>
                New sign-in email: <strong>{confirmedEmail}</strong>
              </MutedText>
            ) : null}
            <Button
              type="button"
              $variant="accent"
              $weight="semibold"
              style={{ marginTop: spacing.lg }}
              onClick={() => navigate('/login')}
            >
              Go to sign in
            </Button>
          </>
        ) : null}
        {status === 'error' ? (
          <>
            <Title>Confirmation failed</Title>
            <ErrorText>{message}</ErrorText>
            <Button
              type="button"
              $variant="secondary"
              style={{ marginTop: spacing.lg }}
              onClick={() => navigate('/account')}
            >
              Back to account settings
            </Button>
          </>
        ) : null}
      </Card>
    </Panel>
  );
};
