import { Button } from '../../../components/ui';
import type { ImportedRow, ParsedStatementData } from '../types';
import { Actions } from '../importPageStyles';

type ImportToolbarActionsProps = {
  rows: ImportedRow[];
  manualMappingData: ParsedStatementData | null;
  canRemapColumns: boolean;
  isMutating: boolean;
  onRemoveImportedFile: () => void;
  onRequestColumnRemap: () => void;
  toggleAll: (selected: boolean) => void;
  onApproveSelected: () => void;
};

export const ImportToolbarActions = ({
  rows,
  manualMappingData,
  canRemapColumns,
  isMutating,
  onRemoveImportedFile,
  onRequestColumnRemap,
  toggleAll,
  onApproveSelected,
}: ImportToolbarActionsProps): JSX.Element => {
  return (
    <Actions>
      <Button
        type="button"
        $variant="secondary"
        onClick={onRemoveImportedFile}
        disabled={rows.length === 0 && !manualMappingData}
      >
        Remove file
      </Button>
      <Button
        type="button"
        $variant="secondary"
        onClick={onRequestColumnRemap}
        disabled={!canRemapColumns || Boolean(manualMappingData)}
        title="Re-select which CSV columns map to merchant, description, and amount"
      >
        Remap columns
      </Button>
      <Button type="button" $variant="secondary" onClick={() => toggleAll(true)} disabled={rows.length === 0}>
        Select all
      </Button>
      <Button type="button" $variant="secondary" onClick={() => toggleAll(false)} disabled={rows.length === 0}>
        Clear selection
      </Button>
      <Button type="button" onClick={onApproveSelected} disabled={isMutating || rows.every((row) => !row.selected)}>
        Import selected
      </Button>
    </Actions>
  );
};
