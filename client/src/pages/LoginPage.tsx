import { FormEvent, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth';
import { PERSONAL_FINANCES_PATH } from '../routes';
import {
  AuthActions,
  AuthForm,
  AuthPageShell,
  Button,
  ErrorText,
  FieldLabel,
  Input,
  RequiredMark,
} from '../components/ui';

export const LoginPage = (): JSX.Element => {
  const navigate = useNavigate();
  const { login, isAuthenticating } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const emailId = useId();
  const passwordId = useId();

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    if (!form.reportValidity()) {
      return;
    }
    const fd = new FormData(form);
    const emailValue = String(fd.get('email') ?? '').trim();
    const passwordValue = String(fd.get('password') ?? '');
    try {
      await login(emailValue, passwordValue, rememberMe);
      navigate(PERSONAL_FINANCES_PATH, { replace: true });
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : 'Login failed.';
      setError(
        message === 'Failed to fetch'
          ? 'Cannot reach the API. From the repo root run: npm run server'
          : message,
      );
    }
  };

  return (
    <AuthPageShell subtitle="Manage household expenses together" activeTab="login">
        <AuthForm onSubmit={onSubmit}>
          <FieldLabel htmlFor={emailId}>
            Email <RequiredMark>*</RequiredMark>
          </FieldLabel>
          <Input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onInput={(e) => setEmail(e.currentTarget.value)}
            required
          />
          <FieldLabel htmlFor={passwordId}>
            Password <RequiredMark>*</RequiredMark>
          </FieldLabel>
          <Input
            id={passwordId}
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="********"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onInput={(e) => setPassword(e.currentTarget.value)}
            required
          />
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#4b5563' }}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            Remember me
          </label>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <AuthActions>
            <Button
              type="submit"
              $variant="accent"
              $weight="semibold"
              $size="lg"
              disabled={isAuthenticating}
              style={{ width: '100%' }}
            >
              {isAuthenticating ? 'Signing in...' : 'Sign In'}
            </Button>
          </AuthActions>
        </AuthForm>
    </AuthPageShell>
  );
};
