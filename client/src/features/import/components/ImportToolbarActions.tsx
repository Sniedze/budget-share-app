import { Button } from '../../../components/ui';
import type { ImportedRow, ParsedStatementData } from '../types';
import { Actions } from '../importPageStyles';

type ImportToolbarActionsProps = {
  rows: ImportedRow[];
  manualMappingData: ParsedStatementData | null;
  isMutating: boolean;
  onRemoveImportedFile: () => void;
  toggleAll: (selected: boolean) => void;
  onApproveSelected: () => void;
};

export const ImportToolbarActions = ({
  rows,
  manualMappingData,
  isMutating,
  onRemoveImportedFile,
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
