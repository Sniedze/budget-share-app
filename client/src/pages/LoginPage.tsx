import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth';
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

type LocationState = {
  from?: {
    pathname: string;
  };
};

export const LoginPage = (): JSX.Element => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | undefined)?.from?.pathname ?? '/';
  const { login, isAuthenticating } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFormComplete = email.trim().length > 0 && password.length > 0;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      await login(email.trim(), password, rememberMe);
      navigate(from, { replace: true });
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Login failed.');
    }
  };

  return (
    <AuthPageShell subtitle="Manage household expenses together" activeTab="login">
        <AuthForm onSubmit={onSubmit}>
          <FieldLabel>
            Email <RequiredMark>*</RequiredMark>
          </FieldLabel>
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <FieldLabel>
            Password <RequiredMark>*</RequiredMark>
          </FieldLabel>
          <Input
            type="password"
            placeholder="********"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
              disabled={isAuthenticating || !isFormComplete}
              style={{ width: '100%' }}
            >
              {isAuthenticating ? 'Signing in...' : 'Sign In'}
            </Button>
          </AuthActions>
        </AuthForm>
    </AuthPageShell>
  );
};
