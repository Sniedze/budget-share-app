import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth';
import {
  AuthActions,
  AuthForm,
  AuthPageShell,
  Button,
  ErrorText,
  FieldLabel,
  Input,
  MutedText,
  RequiredMark,
} from '../components/ui';

export const RegisterPage = (): JSX.Element => {
  const navigate = useNavigate();
  const { register, isAuthenticating } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const passwordsMatch = password === confirmPassword;
  const isFormComplete =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 8 &&
    confirmPassword.length >= 8;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      await register(fullName.trim(), email.trim(), password);
      navigate('/', { replace: true });
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Registration failed.');
    }
  };

  return (
    <AuthPageShell subtitle="Create your account and start sharing expenses" activeTab="register">
        <AuthForm onSubmit={onSubmit}>
          <FieldLabel>
            Full name <RequiredMark>*</RequiredMark>
          </FieldLabel>
          <Input
            type="text"
            placeholder="Your full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
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
            placeholder="Minimum 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <MutedText style={{ margin: 0 }}>Password must be at least 8 characters.</MutedText>
          <FieldLabel>
            Confirm password <RequiredMark>*</RequiredMark>
          </FieldLabel>
          <Input
            type="password"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />
          {error ? <ErrorText>{error}</ErrorText> : null}
          <AuthActions>
            <Button
              type="submit"
              $variant="accent"
              $weight="semibold"
              $size="lg"
              disabled={isAuthenticating || !isFormComplete || !passwordsMatch}
              style={{ width: '100%' }}
            >
              {isAuthenticating ? 'Creating...' : 'Create Account'}
            </Button>
          </AuthActions>
        </AuthForm>
    </AuthPageShell>
  );
};
