import type { ImportedRow } from '../types';
import type { ImportDuplicateStats } from '../importDuplicateStats';
import { ImportSummary } from '../importPageStyles';

type ImportSummaryBarProps = {
  rows: ImportedRow[];
  duplicateStats: ImportDuplicateStats;
};

export const ImportSummaryBar = ({ rows, duplicateStats }: ImportSummaryBarProps): JSX.Element => {
  return (
    <ImportSummary>
      <span>Total rows: {rows.length}</span>
      <span>Outgoing: {rows.filter((row) => row.flow === 'out').length}</span>
      <span>Incoming: {rows.filter((row) => row.flow === 'in').length}</span>
      <span>Selected: {rows.filter((row) => row.selected).length}</span>
      <span>High confidence: {rows.filter((row) => row.confidence === 'high').length}</span>
      <span>Duplicates: {duplicateStats.total}</span>
    </ImportSummary>
  );
};
