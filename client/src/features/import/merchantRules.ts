import type { ImportedRow, ImportMerchantRule, ImportRuleSaveButtonState } from './types';

/** Payee text for merchant rules: merchant column, or description when the statement only fills that. */
export const importRuleMatchText = (row: Pick<ImportedRow, 'title' | 'description'>): string =>
  (row.title.trim() || row.description.trim()).trim();

export const findMatchingMerchantRule = (
  rules: ImportMerchantRule[],
  merchant: string,
  flow: 'out' | 'in',
): ImportMerchantRule | null => {
  const normalized = merchant.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  for (const rule of rules) {
    if (rule.flow !== flow) {
      continue;
    }
    const pattern = rule.pattern.trim().toLowerCase();
    if (!pattern) {
      continue;
    }
    if (rule.matchType === 'exact' && normalized === pattern) {
      return rule;
    }
    if (rule.matchType === 'contains' && normalized.includes(pattern)) {
      return rule;
    }
  }
  return null;
};

export const findRuleByRowPattern = (
  rules: ImportMerchantRule[],
  row: ImportedRow,
  matchType: 'exact' | 'contains',
): ImportMerchantRule | null => {
  const pattern = importRuleMatchText(row).toLowerCase();
  if (!pattern) {
    return null;
  }
  return (
    rules.find(
      (rule) =>
        rule.flow === row.flow &&
        rule.matchType === matchType &&
        rule.pattern.trim().toLowerCase() === pattern,
    ) ?? null
  );
};

export const isSavedRuleSyncedWithRow = (rule: ImportMerchantRule, row: ImportedRow): boolean => {
  if (rule.category !== row.category) {
    return false;
  }
  if (row.flow === 'in') {
    return true;
  }
  const ruleSplit = rule.split ?? 'Personal';
  if (ruleSplit !== row.split) {
    return false;
  }
  if (row.split !== 'Shared') {
    return true;
  }
  return (rule.groupId ?? '') === (row.groupId ?? '') && (rule.expenseGroup ?? '') === (row.expenseGroup ?? '');
};

export const getImportRuleSaveButtonState = (
  rules: ImportMerchantRule[],
  row: ImportedRow,
  matchType: 'exact' | 'contains',
): ImportRuleSaveButtonState => {
  const pattern = importRuleMatchText(row).toLowerCase();
  if (!pattern) {
    return {
      label: 'Save rule',
      disabled: true,
      title: 'Add a merchant or description to save a rule.',
      synced: false,
    };
  }
  const existing = findRuleByRowPattern(rules, row, matchType);
  if (existing && isSavedRuleSyncedWithRow(existing, row)) {
    return {
      label: 'Saved',
      disabled: true,
      title:
        'This mapping is already saved for this merchant with the selected rule type (exact vs contains).',
      synced: true,
    };
  }
  if (existing) {
    return {
      label: 'Update rule',
      disabled: false,
      title: 'Update the saved rule to match this row.',
      synced: false,
    };
  }
  return {
    label: 'Save rule',
    disabled: false,
    title: 'Save this row as a reusable rule.',
    synced: false,
  };
};

export const applyMerchantRuleToRow = (
  row: ImportedRow,
  rule: ImportMerchantRule | null,
): ImportedRow => {
  if (!rule) {
    return row;
  }
  if (row.flow === 'in') {
    return {
      ...row,
      category: rule.category,
      split: 'Personal',
      groupId: '',
      expenseGroup: '',
      confidence: 'high',
    };
  }
  const nextSplit = rule.split ?? row.split;
  return {
    ...row,
    category: rule.category,
    split: nextSplit,
    groupId: nextSplit === 'Shared' ? rule.groupId ?? row.groupId : '',
    expenseGroup: nextSplit === 'Shared' ? rule.expenseGroup ?? row.expenseGroup : '',
    confidence: 'high',
  };
};

export const reapplyMerchantRulesToRows = (
  rows: ImportedRow[],
  rules: ImportMerchantRule[],
): ImportedRow[] =>
  rows.map((row) => {
    const rule = findMatchingMerchantRule(rules, importRuleMatchText(row), row.flow);
    return applyMerchantRuleToRow(row, rule);
  });
