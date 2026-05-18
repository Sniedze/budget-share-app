import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DELETE_ACCOUNT_CONFIRMATION,
  validateDeleteAccountConfirmation,
} from './accountDataValidation.js';
import { AppError, ErrorCode } from '../../graphql/appError.js';

describe('validateDeleteAccountConfirmation', () => {
  it('accepts the required phrase case-insensitively', () => {
    assert.doesNotThrow(() => validateDeleteAccountConfirmation(DELETE_ACCOUNT_CONFIRMATION));
    assert.doesNotThrow(() => validateDeleteAccountConfirmation('DELETE MY ACCOUNT'));
  });

  it('rejects other text', () => {
    assert.throws(
      () => validateDeleteAccountConfirmation('delete'),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.extensions?.code, ErrorCode.BAD_USER_INPUT);
        return true;
      },
    );
  });
});
