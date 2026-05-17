import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getDashboardStats } from './expenseAnalytics.js';

describe('getDashboardStats', () => {
  it('uses real group count and names in the active groups stat', () => {
    const stats = getDashboardStats({
      expenses: [],
      groups: [{ name: 'Home' }, { name: 'Trip' }],
      viewer: { userId: '1', fullName: 'Alex', email: 'alex@example.com' },
      membersByGroupId: new Map(),
    });

    const groupsStat = stats.find((row) => row.label === 'Active Groups');
    assert.ok(groupsStat);
    assert.equal(groupsStat.value, '2');
    assert.equal(groupsStat.hint, 'Home, Trip');
  });

  it('attributes personal vs shared amounts for the current month', () => {
    const now = new Date();
    const stats = getDashboardStats({
      expenses: [
        {
          id: '1',
          title: 'Coffee',
          amount: 40,
          currency: 'DKK',
          createdAt: now.toISOString(),
          transactionDate: now.toISOString(),
          category: 'Food',
          expenseGroup: null,
          split: 'Personal',
          splitDetails: [],
          groupId: null,
          createdByUserId: '1',
          paidByUserId: '1',
          isPrivate: false,
          flow: 'Outgoing',
        },
        {
          id: '2',
          title: 'Rent',
          amount: 100,
          currency: 'DKK',
          createdAt: now.toISOString(),
          transactionDate: now.toISOString(),
          category: 'Housing',
          expenseGroup: 'Rent',
          split: 'Shared',
          splitDetails: [{ participant: 'Alex', ratio: 50, amount: 50 }],
          groupId: '10',
          createdByUserId: '1',
          paidByUserId: '1',
          isPrivate: false,
          flow: 'Outgoing',
        },
      ],
      groups: [{ name: 'Home' }],
      viewer: { userId: '1', fullName: 'Alex', email: 'alex@example.com' },
      membersByGroupId: new Map([
        [
          '10',
          [{ userId: '1', name: 'Alex', email: 'alex@example.com', ratio: 50 }],
        ],
      ]),
    });

    const personal = stats.find((row) => row.label === 'Personal Expenses');
    const shared = stats.find((row) => row.label === 'Shared Expenses');
    assert.ok(personal?.value.includes('40'));
    assert.ok(shared?.value.includes('50'));
  });
});
