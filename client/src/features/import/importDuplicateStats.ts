import type { ImportedRow } from './types';

export type ImportDuplicateStats = {
  total: number;
  existing: number;
  inFile: number;
};

export const computeDuplicateStats = (rows: ImportedRow[]): ImportDuplicateStats => {
  const existing = rows.filter((row) => row.duplicateType === 'existing').length;
  const inFile = rows.filter((row) => row.duplicateType === 'file').length;
  return {
    total: existing + inFile,
    existing,
    inFile,
  };
};

export const computeFileDuplicateWarning = (
  rows: ImportedRow[],
  duplicateStats: ImportDuplicateStats,
): string | null => {
  if (rows.length === 0) {
    return null;
  }
  const existingRatio = duplicateStats.existing / rows.length;
  if (duplicateStats.existing === rows.length) {
    return 'All imported rows match existing expenses. This statement appears to be already uploaded.';
  }
  if (rows.length >= 10 && existingRatio >= 0.8) {
    return `Most rows (${duplicateStats.existing}/${rows.length}) match existing expenses. This file may already be uploaded.`;
  }
  return null;
};
