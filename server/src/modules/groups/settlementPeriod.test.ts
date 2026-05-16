import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatSettlementPeriodLabel,
  parseSettlementPeriod,
  settlementPeriodRange,
  suggestSettlementDueDate,
} from './settlementPeriod.js';

describe('settlementPeriod', () => {
  const ref = new Date(2026, 4, 15);

  it('defaults invalid period to CurrentMonth', () => {
    assert.equal(parseSettlementPeriod(null), 'CurrentMonth');
    assert.equal(parseSettlementPeriod('Bad'), 'CurrentMonth');
  });

  it('computes rolling 6-month start', () => {
    const range = settlementPeriodRange('Last6Months', ref);
    assert.equal(range.startIso, '2025-11-15');
    assert.equal(range.endIso, '2026-05-15');
  });

  it('computes rolling 12-month start', () => {
    const range = settlementPeriodRange('Last12Months', ref);
    assert.equal(range.startIso, '2025-05-15');
    assert.equal(range.endIso, '2026-05-15');
  });

  it('formats period labels', () => {
    assert.equal(formatSettlementPeriodLabel('CurrentMonth', ref), 'May 2026');
    assert.match(formatSettlementPeriodLabel('Last6Months', ref), /Nov 2025/);
  });

  it('suggests due date by period', () => {
    assert.equal(suggestSettlementDueDate('CurrentMonth', ref), '2026-06-05');
    assert.equal(suggestSettlementDueDate('Last6Months', ref), '2026-05-15');
  });
});
