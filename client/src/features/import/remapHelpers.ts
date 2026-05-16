import type { ImportColumnMappingIndices, ImportedRow } from './types';

export type ColumnMappingFormState = {
  dateIndex: string;
  merchantIndex: string;
  amountIndex: string;
  descriptionIndex: string;
  currencyIndex: string;
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
