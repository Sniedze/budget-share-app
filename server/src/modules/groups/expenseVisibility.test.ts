import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  viewerParticipatesInCustomSplit,
  viewerParticipatesInExpenseGroup,
} from './expenseVisibility.js';

describe('viewerParticipatesInExpenseGroup', () => {
  it('returns true when viewer is on the expense-group template', () => {
    assert.equal(
      viewerParticipatesInExpenseGroup(
        'Alex',
        'Shared',
        null,
        [
          { participant: 'Alex', ratio: 50 },
          { participant: 'Sam', ratio: 50 },
        ],
        100,
      ),
      true,
    );
  });

  it('returns false when viewer is not on the template', () => {
    assert.equal(
      viewerParticipatesInExpenseGroup(
        'Alex',
        'Shared',
        null,
        [{ participant: 'Sam', ratio: 100 }],
        100,
      ),
      false,
    );
  });
});

describe('viewerParticipatesInCustomSplit', () => {
  const viewer = { userId: '2', fullName: 'Sam Example', email: 'sam@example.com' };

  it('matches participant by full name', () => {
    assert.equal(
      viewerParticipatesInCustomSplit(
        JSON.stringify([
          { participant: 'Alex', ratio: 50, amount: 50 },
          { participant: 'Sam Example', ratio: 50, amount: 50 },
        ]),
        100,
        viewer,
        '1',
      ),
      true,
    );
  });

  it('matches "You" to the expense creator only', () => {
    const split = JSON.stringify([{ participant: 'You', ratio: 100, amount: 80 }]);
    assert.equal(viewerParticipatesInCustomSplit(split, 80, viewer, '1'), false);
    assert.equal(viewerParticipatesInCustomSplit(split, 80, viewer, '2'), true);
  });
});
