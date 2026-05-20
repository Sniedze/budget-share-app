import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  build503020CategoryBudgets,
  buildBudgetSetupDraftLimits,
  classifyBudget503020Bucket,
  compute503020CategorySuggestions,
  formatShareOfMonthlyBudget,
  isBudgetSetupConfigured,
  rebalanceCategoryLimitsToIncome,
  savedBudgetLimitsAreCredible,
} from './budget503020.js';

describe('budget503020', () => {
  it('classifies default budget lines into needs, wants, and savings', () => {
    assert.equal(classifyBudget503020Bucket('Living'), 'needs');
    assert.equal(classifyBudget503020Bucket('Entertainment'), 'wants');
    assert.equal(classifyBudget503020Bucket('Savings & Investments'), 'savings');
    assert.equal(classifyBudget503020Bucket('Technology'), 'wants');
  });

  it('splits income 50/30/20 across categories in each bucket', () => {
    const categories = ['Living', 'Transportation', 'Entertainment', 'Savings & Investments'];
    const income = 5000;
    const budgets = build503020CategoryBudgets(categories, income);
    const sum = Object.values(budgets).reduce((a, b) => a + b, 0);
    assert.ok(sum > 0);
    assert.ok(sum <= income + categories.length);

    const living = compute503020CategorySuggestions(categories, income).get('Living');
    assert.ok(living);
    assert.equal(living.bucket, 'needs');
    assert.equal(living.bucketIncomeSharePercent, 50);
    assert.ok(living.amount > (budgets.Entertainment ?? 0));
  });

  it('shows fractional % of monthly total instead of rounding to 0%', () => {
    assert.equal(formatShareOfMonthlyBudget(50, 10899.97), '0.5%');
    assert.equal(formatShareOfMonthlyBudget(5000, 10899.97), '46%');
  });

  it('treats an all-empty save as no budget setup', () => {
    assert.equal(
      isBudgetSetupConfigured(
        { startingBalance: 0, monthlyIncomeEstimate: 0 },
        { Living: 0, Entertainment: 0 },
      ),
      false,
    );
    assert.equal(
      isBudgetSetupConfigured(
        { startingBalance: 0, monthlyIncomeEstimate: 15000 },
        build503020CategoryBudgets(['Living', 'Entertainment'], 15000),
      ),
      true,
    );
  });

  it('rejects tiny saved limits when income is a real estimate', () => {
    assert.equal(savedBudgetLimitsAreCredible({ Living: 3, Entertainment: 2 }, 15000), false);
    assert.equal(savedBudgetLimitsAreCredible({ Living: 4000, Entertainment: 2000 }, 15000), true);
  });

  it('scales flexible categories when a manual edit pushes total over income', () => {
    const categories = ['Living', 'Entertainment', 'Transportation'];
    const income = 10000;
    const amounts = { Living: 6000, Entertainment: 3000, Transportation: 2000 };
    const fixed = new Set(['Living']);
    const balanced = rebalanceCategoryLimitsToIncome(categories, amounts, income, fixed);
    assert.equal(balanced.Living, 6000);
    const flexSum = (balanced.Entertainment ?? 0) + (balanced.Transportation ?? 0);
    assert.equal(flexSum, 4000);
    const sum = Object.values(balanced).reduce((a, b) => a + b, 0);
    assert.equal(sum, income);
  });

  it('scales all categories when fixed lines alone exceed income', () => {
    const categories = ['Living', 'Entertainment'];
    const income = 10000;
    const amounts = { Living: 8000, Entertainment: 7000 };
    const balanced = rebalanceCategoryLimitsToIncome(categories, amounts, income, new Set(['Living', 'Entertainment']));
    const sum = Object.values(balanced).reduce((a, b) => a + b, 0);
    assert.equal(sum, income);
    assert.ok((balanced.Living ?? 0) < 8000);
    assert.ok((balanced.Entertainment ?? 0) < 7000);
  });

  it('prefills draft limits from 503020 when saved totals are not credible', () => {
    const cats = ['Living', 'Entertainment', 'Savings & Investments'];
    const draft = buildBudgetSetupDraftLimits(cats, 15000, { Living: 3, Entertainment: 2, 'Savings & Investments': 3 });
    assert.ok(Number(draft.Living) > 1000);
    assert.ok(Number(draft.Entertainment) > 500);
    assert.ok(Number(draft['Savings & Investments']) > 500);
  });
});
