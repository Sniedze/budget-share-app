import { combineExpenseTitle } from '../../format/expenseTitle';
import { normalizeStatementCurrency } from '../../format/currency';
import type { SplitType } from '../expenses';
import { normalizeAmountValue, resolveRowAmountAndFlow } from './amountParse';
import { merchantHistoryKey } from './columnMapping';
import { sanitizeCellText } from './csvParse';
import { normalizeDate } from './dateParse';
import {
  applyMerchantRuleToRow,
  findMatchingMerchantRule,
  importRuleMatchText,
} from './merchantRules';
import type { ImportedRow, ImportMerchantRule } from './types';

export const buildImportSignature = (row: {
  title: string;
  transactionDate: string;
  amount: string;
  flow: 'in' | 'out';
}): string => {
  const merchant = sanitizeCellText(row.title).toLowerCase();
  const date = normalizeDate(row.transactionDate);
  const amount = normalizeAmountValue(row.amount).toFixed(2);
  const base = `${merchant}|${date}|${amount}`;
  return row.flow === 'in' ? `${base}|in` : base;
};

export const buildExpenseTitleForImport = (row: ImportedRow): string =>
  combineExpenseTitle(row.title, row.description);

export const applyDuplicateFlags = (
  importedRows: ImportedRow[],
  existingSignatures: Set<string>,
): ImportedRow[] => {
  const signatureCounts = new Map<string, number>();
  importedRows.forEach((row) => {
    const signature = buildImportSignature(row);
    signatureCounts.set(signature, (signatureCounts.get(signature) ?? 0) + 1);
  });

  return importedRows.map((row) => {
    const signature = buildImportSignature(row);
    const isExistingDuplicate = existingSignatures.has(signature);
    const isFileDuplicate = (signatureCounts.get(signature) ?? 0) > 1;
    const duplicateType: ImportedRow['duplicateType'] = isExistingDuplicate
      ? 'existing'
      : isFileDuplicate
        ? 'file'
        : 'none';
    return {
      ...row,
      duplicateType,
      selected: duplicateType === 'none' ? row.selected : false,
    };
  });
};

export const buildImportedRows = (
  dataRows: string[][],
  dateIndex: number,
  merchantIndex: number,
  amountIndex: number,
  debitIndex: number,
  creditIndex: number,
  currencyIndex: number,
  descriptionIndex: number,
  amountColumnAssumeAllOutgoing: boolean,
  merchantRules: ImportMerchantRule[],
  merchantHistory: Map<
    string,
    { category: string; split: SplitType; groupId: string; expenseGroup: string; transactionDate: string }
  >,
): ImportedRow[] =>
  dataRows.flatMap((cells, index) => {
    const transactionDate = normalizeDate(cells[dateIndex] ?? '');
    const title = sanitizeCellText(cells[merchantIndex] ?? '');
    const description =
      descriptionIndex >= 0 ? sanitizeCellText(cells[descriptionIndex] ?? '') : '';
    const resolved = resolveRowAmountAndFlow(
      cells,
      amountIndex,
      debitIndex,
      creditIndex,
      amountColumnAssumeAllOutgoing,
    );
    if (!resolved || resolved.magnitude <= 0) {
      return [];
    }
    const amount = String(resolved.magnitude);
    const flow = resolved.flow;
    const rawCurrencyCell = currencyIndex >= 0 ? cells[currencyIndex] ?? '' : '';
    const currency = normalizeStatementCurrency(rawCurrencyCell);
    const history = merchantHistory.get(merchantHistoryKey(title, flow));
    const isIncoming = flow === 'in';
    const isShared = !isIncoming && history?.split === 'Shared';
    const hasLabel = Boolean(title.trim() || description.trim());
    const baseRow: ImportedRow = {
      id: `${Date.now()}-${index}`,
      selected: true,
      transactionDate,
      title,
      description,
      amount,
      currency,
      flow,
      category: isIncoming ? 'Salary' : history?.category ?? 'General',
      split: isShared ? 'Shared' : 'Personal',
      groupId: isShared ? history?.groupId ?? '' : '',
      expenseGroup: isShared ? history?.expenseGroup ?? '' : '',
      confidence: history ? 'high' : hasLabel ? 'medium' : 'low',
      duplicateType: 'none',
    };
    const rule = findMatchingMerchantRule(merchantRules, importRuleMatchText({ title, description }), flow);
    const rowWithRule = applyMerchantRuleToRow(baseRow, rule);
    return [rowWithRule];
  });
