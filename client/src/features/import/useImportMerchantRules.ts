import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { importRuleMatchText } from './merchantRules';
import { loadMerchantRules, saveMerchantRules } from './importStorage';
import { reapplyMerchantRulesToRows } from './merchantRules';
import type { ImportedRow, ImportMerchantRule } from './types';

export const useImportMerchantRules = (
  setRows: Dispatch<SetStateAction<ImportedRow[]>>,
) => {
  const [merchantRules, setMerchantRules] = useState<ImportMerchantRule[]>(() => loadMerchantRules());
  const [newRuleMatchType, setNewRuleMatchType] = useState<'exact' | 'contains'>('exact');

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
    setMerchantRules((previous) => {
      const next = [...previous];
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
      saveMerchantRules(next);
      return next;
    });
  };

  const upsertRuleFromRow = (row: ImportedRow, matchType: 'exact' | 'contains'): string => {
    const pattern = importRuleMatchText(row).toLowerCase();
    if (!pattern) {
      return '';
    }
    setMerchantRules((previous) => {
      const next = [...previous];
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
      saveMerchantRules(next);
      return next;
    });
    return `Saved ${matchType} rule for "${importRuleMatchText(row)}".`;
  };

  const updateMerchantRule = (id: string, patch: Partial<ImportMerchantRule>) => {
    setMerchantRules((previous) => {
      const next = previous.map((rule) => {
        if (rule.id !== id) {
          return rule;
        }
        return {
          ...rule,
          ...patch,
          updatedAt: new Date().toISOString(),
        };
      });
      saveMerchantRules(next);
      return next;
    });
  };

  const deleteMerchantRule = (id: string) => {
    setMerchantRules((previous) => {
      const next = previous.filter((rule) => rule.id !== id);
      saveMerchantRules(next);
      return next;
    });
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
