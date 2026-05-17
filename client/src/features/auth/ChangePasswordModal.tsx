import { FormEvent, useId, useState } from 'react';
import styled from 'styled-components';
import { Button, ErrorText, FieldLabel, Input, MutedText } from '../../components/ui';
import { colors, radii, spacing } from '../../styles/tokens';
import { useAuth } from './AuthContext';
import { isPasswordStrong, passwordPolicyHint } from './passwordPolicy';

const ModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: ${spacing.lg};
`;

const ModalPanel = styled.div`
  width: min(420px, 100%);
  background: ${colors.surface};
  border-radius: ${radii.lg};
  padding: ${spacing.xl};
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.2);
`;

const ModalTitle = styled.h2`
  margin: 0 0 ${spacing.sm};
  font-size: 1.125rem;
`;

const FormStack = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
  margin-top: ${spacing.md};
`;

const ModalActions = styled.div`
  display: flex;
  gap: ${spacing.sm};
  justify-content: flex-end;
  margin-top: ${spacing.sm};
`;

type ChangePasswordModalProps = {
  onClose: () => void;
};

export const ChangePasswordModal = ({ onClose }: ChangePasswordModalProps): JSX.Element => {
  const { changePassword, isAuthenticating } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const currentPasswordId = useId();
  const newPasswordId = useId();
  const confirmPasswordId = useId();

  const canSubmit =
    currentPassword.length > 0 &&
    isPasswordStrong(newPassword) &&
    newPassword === confirmPassword &&
    newPassword !== currentPassword;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.');
      return;
    }
    try {
      await changePassword(currentPassword, newPassword);
      onClose();
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : 'Password change failed.');
    }
  };

  return (
    <ModalBackdrop role="presentation" onMouseDown={onClose}>
      <ModalPanel
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <ModalTitle id="change-password-title">Change password</ModalTitle>
        <MutedText>
          Other devices will be signed out. {passwordPolicyHint}
        </MutedText>
        <FormStack onSubmit={onSubmit}>
          <div>
            <FieldLabel htmlFor={currentPasswordId}>Current password</FieldLabel>
            <Input
              id={currentPasswordId}
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <FieldLabel htmlFor={newPasswordId}>New password</FieldLabel>
            <Input
              id={newPasswordId}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <FieldLabel htmlFor={confirmPasswordId}>Confirm new password</FieldLabel>
            <Input
              id={confirmPasswordId}
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <ModalActions>
            <Button type="button" $variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" $variant="accent" disabled={isAuthenticating || !canSubmit}>
              {isAuthenticating ? 'Saving…' : 'Update password'}
            </Button>
          </ModalActions>
        </FormStack>
      </ModalPanel>
    </ModalBackdrop>
  );
};
