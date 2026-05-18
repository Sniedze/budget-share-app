import { FormEvent, useId, useState } from 'react';
import styled from 'styled-components';
import { useMutation } from '@apollo/client/react';
import { useNavigate } from 'react-router-dom';
import { Button, ErrorText, FieldLabel, Input, MutedText } from '../../components/ui';
import { colors, radii, spacing } from '../../styles/tokens';
import { useAuth } from './AuthContext';
import { DELETE_ACCOUNT, DELETE_ACCOUNT_CONFIRMATION_PHRASE } from './accountDataGraphql';

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
  width: min(440px, 100%);
  background: ${colors.surface};
  border-radius: ${radii.lg};
  padding: ${spacing.xl};
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.2);
`;

const ModalTitle = styled.h2`
  margin: 0 0 ${spacing.sm};
  font-size: 1.125rem;
  color: ${colors.danger};
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

const DangerButton = styled(Button)`
  background: ${colors.danger};
  color: #fff;

  &:hover:not(:disabled) {
    background: ${colors.dangerHover};
  }
`;

type DeleteAccountModalProps = {
  onClose: () => void;
};

export const DeleteAccountModal = ({ onClose }: DeleteAccountModalProps): JSX.Element => {
  const navigate = useNavigate();
  const { logout, isAuthenticating } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const passwordId = useId();
  const confirmationId = useId();

  const [deleteAccountMutation, { loading: deleting }] = useMutation<{ deleteAccount: boolean }>(
    DELETE_ACCOUNT,
    { errorPolicy: 'all' },
  );

  const confirmationOk =
    confirmation.trim().toLowerCase() === DELETE_ACCOUNT_CONFIRMATION_PHRASE.toLowerCase();
  const canSubmit = password.length > 0 && confirmationOk && !deleting;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!confirmationOk) {
      setError(`Type "${DELETE_ACCOUNT_CONFIRMATION_PHRASE}" to confirm.`);
      return;
    }
    try {
      const result = await deleteAccountMutation({
        variables: { input: { password, confirmation } },
      });
      if (!result.data?.deleteAccount) {
        throw new Error(result.error?.message ?? 'Account deletion failed.');
      }
      await logout();
      navigate('/login', { replace: true });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Account deletion failed.');
    }
  };

  return (
    <ModalBackdrop role="presentation" onMouseDown={onClose}>
      <ModalPanel
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <ModalTitle id="delete-account-title">Delete account</ModalTitle>
        <MutedText>
          This permanently removes your account, personal expenses, and household memberships. Shared
          household expenses stay for other members but no longer reference your account.
        </MutedText>
        <FormStack onSubmit={onSubmit}>
          <div>
            <FieldLabel htmlFor={passwordId}>Password</FieldLabel>
            <Input
              id={passwordId}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <FieldLabel htmlFor={confirmationId}>
              Type <strong>{DELETE_ACCOUNT_CONFIRMATION_PHRASE}</strong> to confirm
            </FieldLabel>
            <Input
              id={confirmationId}
              type="text"
              autoComplete="off"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              required
            />
          </div>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <ModalActions>
            <Button type="button" $variant="secondary" onClick={onClose} disabled={deleting}>
              Cancel
            </Button>
            <DangerButton type="submit" disabled={isAuthenticating || !canSubmit}>
              {deleting ? 'Deleting…' : 'Delete my account'}
            </DangerButton>
          </ModalActions>
        </FormStack>
      </ModalPanel>
    </ModalBackdrop>
  );
};
