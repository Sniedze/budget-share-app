import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { importRuleMatchText } from './merchantRules';
import { reapplyMerchantRulesToRows } from './merchantRules';
import type { ImportedRow, ImportMerchantRule } from './types';

export const useImportMerchantRules = (
  setRows: Dispatch<SetStateAction<ImportedRow[]>>,
  merchantRules: ImportMerchantRule[],
  onMerchantRulesChange: (rules: ImportMerchantRule[]) => void,
) => {
  const [newRuleMatchType, setNewRuleMatchType] = useState<'exact' | 'contains'>('exact');

  const persistRules = useCallback(
    (next: ImportMerchantRule[]) => {
      onMerchantRulesChange(next);
    },
    [onMerchantRulesChange],
  );

  useEffect(() => {
    setRows((previous) => {
      if (previous.length === 0) {
        return previous;
      }
      return reapplyMerchantRulesToRows(previous, merchantRules);
    });
  }, [merchantRules, setRows]);

  const learnRulesFromImportedRows = (importedRows: ImportedRow[]) => {
    if (importedRows.length === 0) {
      return;
    }
    const next = [...merchantRules];
    importedRows.forEach((row) => {
      const pattern = importRuleMatchText(row).toLowerCase();
      if (!pattern) {
        return;
      }
      const flow = row.flow;
      const existingIndex = next.findIndex(
        (rule) => rule.flow === flow && rule.matchType === 'exact' && rule.pattern.trim().toLowerCase() === pattern,
      );
      const candidate: ImportMerchantRule = {
        id: existingIndex >= 0 ? next[existingIndex].id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        flow,
        matchType: 'exact',
        pattern,
        category: row.category,
        split: flow === 'out' ? row.split : 'Personal',
        groupId: flow === 'out' && row.split === 'Shared' ? row.groupId : '',
        expenseGroup: flow === 'out' && row.split === 'Shared' ? row.expenseGroup : '',
        updatedAt: new Date().toISOString(),
      };
      if (existingIndex >= 0) {
        next[existingIndex] = candidate;
      } else {
        next.push(candidate);
      }
    });
    persistRules(next);
  };

  const upsertRuleFromRow = (row: ImportedRow, matchType: 'exact' | 'contains'): string => {
    const pattern = importRuleMatchText(row).toLowerCase();
    if (!pattern) {
      return '';
    }
    const next = [...merchantRules];
    const existingIndex = next.findIndex(
      (rule) =>
        rule.flow === row.flow && rule.matchType === matchType && rule.pattern.trim().toLowerCase() === pattern,
    );
    const candidate: ImportMerchantRule = {
      id: existingIndex >= 0 ? next[existingIndex].id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      flow: row.flow,
      matchType,
      pattern,
      category: row.category,
      split: row.flow === 'out' ? row.split : 'Personal',
      groupId: row.flow === 'out' && row.split === 'Shared' ? row.groupId : '',
      expenseGroup: row.flow === 'out' && row.split === 'Shared' ? row.expenseGroup : '',
      updatedAt: new Date().toISOString(),
    };
    if (existingIndex >= 0) {
      next[existingIndex] = candidate;
    } else {
      next.push(candidate);
    }
    persistRules(next);
    return `Saved ${matchType} rule for "${importRuleMatchText(row)}".`;
  };

  const updateMerchantRule = (id: string, patch: Partial<ImportMerchantRule>) => {
    const next = merchantRules.map((rule) => {
      if (rule.id !== id) {
        return rule;
      }
      return {
        ...rule,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
    });
    persistRules(next);
  };

  const deleteMerchantRule = (id: string) => {
    persistRules(merchantRules.filter((rule) => rule.id !== id));
  };

  return {
    merchantRules,
    newRuleMatchType,
    setNewRuleMatchType,
    learnRulesFromImportedRows,
    upsertRuleFromRow,
    updateMerchantRule,
    deleteMerchantRule,
  };
};
