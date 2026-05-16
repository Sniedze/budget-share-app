import { Button, ErrorText, MutedText } from '../../../components/ui';
import type { ImportDuplicateStats } from '../importDuplicateStats';
import { Actions, DuplicateNotice } from '../importPageStyles';
import type { ImportedRow } from '../types';

type ImportAlertsSectionProps = {
  rows: ImportedRow[];
  importError: string | null;
  importInfo: string | null;
  importBackendDuplicateFailureCount: number;
  duplicateStats: ImportDuplicateStats;
  fileDuplicateWarning: string | null;
  onRemoveInFileDuplicates: () => void;
};

export const ImportAlertsSection = ({
  rows,
  importError,
  importInfo,
  importBackendDuplicateFailureCount,
  duplicateStats,
  fileDuplicateWarning,
  onRemoveInFileDuplicates,
}: ImportAlertsSectionProps): JSX.Element | null => {
  const hasIncoming = rows.some((row) => row.flow === 'in');

  return (
    <>
      {hasIncoming ? (
        <DuplicateNotice $severity="info">
          <MutedText>
            Incoming (credit) rows are selected like outgoing rows; deselect any you do not want. They are stored as
            income and count toward Budget YTD income; outgoing rows remain expense records.
          </MutedText>
        </DuplicateNotice>
      ) : null}
      {importError ? (
        <DuplicateNotice $severity="warning">
          <ErrorText>{importError}</ErrorText>
          {importBackendDuplicateFailureCount > 0 ? (
            <MutedText style={{ marginTop: 8, display: 'block' }}>
              The server rejected {importBackendDuplicateFailureCount} row(s) that match an expense you already saved
              (same date, amount, and merchant text). Overlapping bank exports (for example April only vs year-to-date)
              often cause this. Edit the merchant or date slightly only if it is genuinely a different transaction, or
              remove those rows from the selection.
            </MutedText>
          ) : null}
        </DuplicateNotice>
      ) : duplicateStats.total > 0 ? (
        <DuplicateNotice $severity="warning">
          <ErrorText>
            Duplicate warning: {duplicateStats.existing} row(s) match existing expenses and {duplicateStats.inFile} row(s)
            are duplicates within this file.
          </ErrorText>
          <MutedText>Duplicate rows are auto-unselected and cannot be imported until edited.</MutedText>
          {duplicateStats.inFile > 0 ? (
            <Actions>
              <Button type="button" $variant="secondary" onClick={onRemoveInFileDuplicates}>
                Remove repeated rows (keep first)
              </Button>
            </Actions>
          ) : null}
        </DuplicateNotice>
      ) : fileDuplicateWarning ? (
        <DuplicateNotice $severity="warning">
          <ErrorText>{fileDuplicateWarning}</ErrorText>
        </DuplicateNotice>
      ) : importInfo ? (
        <DuplicateNotice $severity="info">
          <MutedText>{importInfo}</MutedText>
        </DuplicateNotice>
      ) : null}
    </>
  );
};
