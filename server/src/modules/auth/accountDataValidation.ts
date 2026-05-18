import { appError, ErrorCode } from '../../graphql/appError.js';

export const DELETE_ACCOUNT_CONFIRMATION = 'delete my account';

export const validateDeleteAccountConfirmation = (confirmation: string): void => {
  if (confirmation.trim().toLowerCase() !== DELETE_ACCOUNT_CONFIRMATION) {
    throw appError(
      ErrorCode.BAD_USER_INPUT,
      `Type "${DELETE_ACCOUNT_CONFIRMATION}" to confirm account deletion.`,
    );
  }
};
