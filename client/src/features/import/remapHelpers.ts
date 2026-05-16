import { DESCRIPTION_COLUMN_ALIASES } from './constants';
import { includesAnyAlias, normalizeHeaderKey } from './csvParse';
import type { ImportColumnMappingIndices, ImportedRow, ParsedStatementData } from './types';

export type ColumnMappingFormState = {
  dateIndex: string;
  merchantIndex: string;
  amountIndex: string;
  descriptionIndex: string;
  currencyIndex: string;
};

export type ParsedColumnMappingForm =
  | { ok: true; indices: ImportColumnMappingIndices }
  | { ok: false; message: string };

const parseOptionalColumnIndex = (value: string): number => {
  if (value.trim() === '') {
    return -1;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return Number.NaN;
  }
  return parsed;
};

/** Parse mapping dropdown values; rejects empty required fields (Number('') is 0). */
export const parseColumnMappingForm = (
  form: ColumnMappingFormState,
  columnCount: number,
): ParsedColumnMappingForm => {
  if (form.dateIndex.trim() === '' || form.merchantIndex.trim() === '' || form.amountIndex.trim() === '') {
    return { ok: false, message: 'Select Date, Merchant, and Amount columns to continue.' };
  }

  const dateIndex = Number(form.dateIndex);
  const merchantIndex = Number(form.merchantIndex);
  const amountIndex = Number(form.amountIndex);
  const currencyIndex = parseOptionalColumnIndex(form.currencyIndex);
  const descriptionIndex = parseOptionalColumnIndex(form.descriptionIndex);

  const required = [dateIndex, merchantIndex, amountIndex];
  if (required.some((index) => !Number.isInteger(index) || index < 0)) {
    return { ok: false, message: 'Column selections are invalid.' };
  }
  if ([currencyIndex, descriptionIndex].some((index) => Number.isNaN(index))) {
    return { ok: false, message: 'Optional column selections are invalid.' };
  }

  const maxIndex = columnCount - 1;
  const all = [dateIndex, merchantIndex, amountIndex, currencyIndex, descriptionIndex].filter((index) => index >= 0);
  if (all.some((index) => index > maxIndex)) {
    return { ok: false, message: 'A selected column is outside this file.' };
  }

  const uniqueRequired = new Set([dateIndex, merchantIndex, amountIndex]);
  if (uniqueRequired.size < 3) {
    return { ok: false, message: 'Date, Merchant, and Amount must be three different columns.' };
  }

  return {
    ok: true,
    indices: {
      dateIndex,
      merchantIndex,
      amountIndex,
      currencyIndex,
      descriptionIndex,
    },
  };
};

/** Dropdown label: bank header plus a sample cell from the file. */
export const formatStatementColumnOption = (
  header: string,
  columnIndex: number,
  dataRows: string[][],
): string => {
  const headerLabel = header.trim() || `Column ${columnIndex + 1}`;
  const sampleRow = dataRows.find((row) => (row[columnIndex] ?? '').trim().length > 0);
  const sample = sampleRow?.[columnIndex]?.trim() ?? '';
  if (!sample) {
    return headerLabel;
  }
  const preview = sample.length > 48 ? `${sample.slice(0, 48)}…` : sample;
  return `${headerLabel} (e.g. ${preview})`;
};

export const getStatementColumnPreview = (
  data: ParsedStatementData,
  columnIndex: number,
): string => {
  if (columnIndex < 0) {
    return '';
  }
  const sampleRow = data.dataRows.find((row) => (row[columnIndex] ?? '').trim().length > 0);
  return sampleRow?.[columnIndex]?.trim() ?? '';
};

export const columnMappingIndicesToForm = (indices: ImportColumnMappingIndices): ColumnMappingFormState => ({
  dateIndex: String(indices.dateIndex),
  merchantIndex: String(indices.merchantIndex),
  amountIndex: String(indices.amountIndex),
  descriptionIndex: indices.descriptionIndex >= 0 ? String(indices.descriptionIndex) : '',
  currencyIndex: indices.currencyIndex >= 0 ? String(indices.currencyIndex) : '',
});

const looksLikeReferenceNumber = (value: string): boolean => {
  const trimmed = value.trim();
  return trimmed.length > 0 && /^\d[\d\s]*$/.test(trimmed);
};

const looksLikePayeeLabel = (value: string): boolean => {
  const trimmed = value.trim();
  return trimmed.length > 2 && /[a-zA-ZæøåÆØÅ]/.test(trimmed);
};

/** When merchant column is numeric IDs and description has payee names, swap for remap. */
export const suggestRemapIndices = (
  applied: ImportColumnMappingIndices,
  rows: ImportedRow[],
): ImportColumnMappingIndices => {
  if (applied.descriptionIndex < 0 || applied.merchantIndex === applied.descriptionIndex) {
    return applied;
  }

  const sample = rows.slice(0, 30);
  if (sample.length < 3) {
    return applied;
  }

  const merchantLooksLikeId = sample.filter((row) => looksLikeReferenceNumber(row.title)).length;
  const descriptionLooksLikePayee = sample.filter((row) => looksLikePayeeLabel(row.description)).length;

  if (merchantLooksLikeId >= sample.length * 0.5 && descriptionLooksLikePayee >= sample.length * 0.4) {
    return {
      ...applied,
      merchantIndex: applied.descriptionIndex,
      descriptionIndex: applied.merchantIndex,
    };
  }

  return applied;
};

/** Use statement headers when parsed rows have no description column mapped yet. */
export const suggestRemapIndicesFromStatement = (
  applied: ImportColumnMappingIndices,
  rows: ImportedRow[],
  statementData: ParsedStatementData,
): ImportColumnMappingIndices => {
  const fromRows = suggestRemapIndices(applied, rows);
  if (fromRows.merchantIndex !== applied.merchantIndex) {
    return fromRows;
  }

  const headerNorm = statementData.header.map((cell) => normalizeHeaderKey(cell));
  const descriptionColumnIndex = headerNorm.findIndex(
    (cell, index) => index !== applied.merchantIndex && includesAnyAlias(cell, DESCRIPTION_COLUMN_ALIASES),
  );
  if (descriptionColumnIndex < 0) {
    return fromRows;
  }

  const sample = rows.slice(0, 30);
  if (sample.length < 3) {
    return fromRows;
  }

  const merchantLooksLikeId = sample.filter((row) => looksLikeReferenceNumber(row.title)).length;
  if (merchantLooksLikeId < sample.length * 0.5) {
    return fromRows;
  }

  return {
    ...applied,
    merchantIndex: descriptionColumnIndex,
    descriptionIndex: applied.merchantIndex,
  };
};
