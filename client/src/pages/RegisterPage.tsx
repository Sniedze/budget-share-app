import { FormEvent, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth';
import { PERSONAL_FINANCES_PATH, PRIVACY_POLICY_PATH } from '../routes';
import { isPasswordStrong, passwordPolicyHint } from '../features/auth/passwordPolicy';
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
  const fullNameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();
  const passwordsMatch = password === confirmPassword;
  const isFormComplete =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    isPasswordStrong(password) &&
    isPasswordStrong(confirmPassword);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      await register(fullName.trim(), email.trim(), password);
      navigate(PERSONAL_FINANCES_PATH, { replace: true });
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Registration failed.');
    }
  };

  return (
    <AuthPageShell subtitle="Create your account and start sharing expenses" activeTab="register">
        <AuthForm onSubmit={onSubmit}>
          <FieldLabel htmlFor={fullNameId}>
            Full name <RequiredMark>*</RequiredMark>
          </FieldLabel>
          <Input
            id={fullNameId}
            type="text"
            placeholder="Your full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <FieldLabel htmlFor={emailId}>
            Email <RequiredMark>*</RequiredMark>
          </FieldLabel>
          <Input
            id={emailId}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <FieldLabel htmlFor={passwordId}>
            Password <RequiredMark>*</RequiredMark>
          </FieldLabel>
          <Input
            id={passwordId}
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <MutedText style={{ margin: 0 }}>{passwordPolicyHint}</MutedText>
          <FieldLabel htmlFor={confirmPasswordId}>
            Confirm password <RequiredMark>*</RequiredMark>
          </FieldLabel>
          <Input
            id={confirmPasswordId}
            type="password"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />
          {error ? <ErrorText>{error}</ErrorText> : null}
          <MutedText style={{ fontSize: '0.8125rem' }}>
            By creating an account you acknowledge our{' '}
            <Link to={PRIVACY_POLICY_PATH}>Privacy Policy</Link>.
          </MutedText>
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
