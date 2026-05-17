import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError, ErrorCode } from '../../graphql/appError.js';
import { assertPasswordNotCommon, assertPasswordStrength } from './validation.js';

describe('assertPasswordStrength', () => {
  it('accepts passwords with at least 8 chars, a letter, and a digit', () => {
    assert.doesNotThrow(() => assertPasswordStrength('password12'));
  });

  it('rejects passwords shorter than 8 characters', () => {
    assert.throws(
      () => assertPasswordStrength('pass1'),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.extensions?.code, ErrorCode.BAD_USER_INPUT);
        return true;
      },
    );
  });

  it('rejects passwords without a letter', () => {
    assert.throws(() => assertPasswordStrength('12345678'));
  });

  it('rejects passwords without a digit', () => {
    assert.throws(() => assertPasswordStrength('password'));
  });
});

describe('assertPasswordNotCommon', () => {
  it('rejects trivial breached-style passwords', () => {
    assert.throws(() => assertPasswordNotCommon('password1'));
  });

  it('allows less common passwords', () => {
    assert.doesNotThrow(() => assertPasswordNotCommon('k9RiverLane'));
  });
});
