import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseExpenseSettlementAmounts,
  parseTemplateSplitRatios,
  stripParticipantFromTemplateSplitJson,
} from './splitDetailsParse.js';

describe('parseTemplateSplitRatios', () => {
  it('parses JSON ratio rows', () => {
    const ratios = parseTemplateSplitRatios(
      JSON.stringify([
        { participant: 'Alex', ratio: 60 },
        { participant: 'Sam', ratio: 40 },
      ]),
    );
    assert.deepEqual(ratios, [
      { participant: 'Alex', ratio: 60 },
      { participant: 'Sam', ratio: 40 },
    ]);
  });
});

describe('stripParticipantFromTemplateSplitJson', () => {
  it('removes a participant case-insensitively', () => {
    const next = stripParticipantFromTemplateSplitJson(
      JSON.stringify([{ participant: 'Alex', ratio: 50 }, { participant: 'sam', ratio: 50 }]),
      'SAM',
    );
    assert.deepEqual(JSON.parse(next), [{ participant: 'Alex', ratio: 50 }]);
  });
});

describe('parseExpenseSettlementAmounts', () => {
  it('derives amount from ratio when amount is missing', () => {
    const shares = parseExpenseSettlementAmounts(
      JSON.stringify([{ participant: 'Alex', ratio: 50 }]),
      100,
    );
    assert.deepEqual(shares, [{ participant: 'Alex', amount: 50 }]);
  });
});
