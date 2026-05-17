import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EXPENSE_SELECT_COLUMNS,
  GROUP_CORE_COLUMNS,
  GROUP_LIST_EXPENSE_COLUMNS,
  SETTLEMENT_EXPENSE_COLUMNS,
} from './sqlColumns.js';

describe('sqlColumns', () => {
  it('exports non-empty shared column lists', () => {
    assert.match(EXPENSE_SELECT_COLUMNS, /transaction_date/);
    assert.match(GROUP_CORE_COLUMNS, /name/);
    assert.match(GROUP_LIST_EXPENSE_COLUMNS, /paidByName/);
    assert.match(SETTLEMENT_EXPENSE_COLUMNS, /paidByName/);
  });
});
