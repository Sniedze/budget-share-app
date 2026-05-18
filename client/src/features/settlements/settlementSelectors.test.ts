import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filterTransfersSettledByPayments } from './settlementSelectors.js';
import type { SettlementPayment, SettlementTransfer } from '../../graphql/operationTypes.js';

const payment = (overrides: Partial<SettlementPayment>): SettlementPayment => ({
  id: '1',
  groupId: '1',
  expenseGroup: null,
  fromMember: 'Alex',
  toMember: 'Sam',
  amount: 50,
  note: null,
  settledAt: '2026-05-01',
  ...overrides,
});

describe('filterTransfersSettledByPayments', () => {
  it('removes pending transfers covered by a recorded payment', () => {
    const transfers: SettlementTransfer[] = [
      { fromMember: 'Alex', toMember: 'Sam', amount: 50 },
    ];
    const payments = [payment({ id: 'p1' })];
    const pending = filterTransfersSettledByPayments(transfers, payments);
    assert.equal(pending.length, 0);
  });
});
