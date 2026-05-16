import { Button, MutedText } from '../../../components/ui';
import { formatStatementColumnOption } from '../remapHelpers';
import type { ParsedStatementData } from '../types';
import {
  Actions,
  ColumnMappingGrid,
  ColumnMappingLabel,
  ColumnMappingRow,
  ColumnMappingSelect,
  InlineInput,
  MappingSectionTitle,
} from '../importPageStyles';

type MappingFieldKey = 'date' | 'merchant' | 'amount' | 'description' | 'currency';

type MappingFieldConfig = {
  key: MappingFieldKey;
  expenseFieldLabel: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  required: boolean;
};

type ImportManualMappingSectionProps = {
  manualMappingData: ParsedStatementData;
  isRemappingColumns: boolean;
  manualDateIndex: string;
  setManualDateIndex: (value: string) => void;
  manualMerchantIndex: string;
  setManualMerchantIndex: (value: string) => void;
  manualAmountIndex: string;
  setManualAmountIndex: (value: string) => void;
  manualDescriptionIndex: string;
  setManualDescriptionIndex: (value: string) => void;
  manualCurrencyIndex: string;
  setManualCurrencyIndex: (value: string) => void;
  onApplyManualMapping: () => void;
  onSwapMerchantDescriptionColumns: () => void;
};

export const ImportManualMappingSection = ({
  manualMappingData,
  manualDateIndex,
  setManualDateIndex,
  manualMerchantIndex,
  setManualMerchantIndex,
  manualAmountIndex,
  setManualAmountIndex,
  manualDescriptionIndex,
  setManualDescriptionIndex,
  manualCurrencyIndex,
  setManualCurrencyIndex,
  isRemappingColumns,
  onApplyManualMapping,
  onSwapMerchantDescriptionColumns,
}: ImportManualMappingSectionProps): JSX.Element => {
  const fields: MappingFieldConfig[] = [
    {
      key: 'date',
      expenseFieldLabel: 'Date',
      placeholder: 'Choose statement column…',
      value: manualDateIndex,
      onChange: setManualDateIndex,
      required: true,
    },
    {
      key: 'merchant',
      expenseFieldLabel: 'Merchant (payee name)',
      placeholder: 'Choose statement column…',
      value: manualMerchantIndex,
      onChange: setManualMerchantIndex,
      required: true,
    },
    {
      key: 'amount',
      expenseFieldLabel: 'Amount',
      placeholder: 'Choose statement column…',
      value: manualAmountIndex,
      onChange: setManualAmountIndex,
      required: true,
    },
    {
      key: 'description',
      expenseFieldLabel: 'Description (optional)',
      placeholder: 'None',
      value: manualDescriptionIndex,
      onChange: setManualDescriptionIndex,
      required: false,
    },
    {
      key: 'currency',
      expenseFieldLabel: 'Currency (optional)',
      placeholder: 'None',
      value: manualCurrencyIndex,
      onChange: setManualCurrencyIndex,
      required: false,
    },
  ];

  const canSwapMerchantDescription = manualMerchantIndex !== '' && manualDescriptionIndex !== '';

  return (
    <>
      <MappingSectionTitle>
        {isRemappingColumns ? 'Remap statement columns to expense fields' : 'Map statement columns to expense fields'}
      </MappingSectionTitle>
      <MutedText>
        {isRemappingColumns
          ? 'For each expense field on the left, pick which column from your bank file supplies that data. Merchant should be the payee name (often Beskrivelse), not a reference number.'
          : 'Match each expense field to a column from your uploaded file. Samples from your file are shown in the dropdowns.'}
      </MutedText>

      <ColumnMappingGrid role="table" aria-label="Column mapping">
        <ColumnMappingRow $isHeader>
          <ColumnMappingLabel as="div">Expense field</ColumnMappingLabel>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'inherit' }}>Bank statement column</span>
        </ColumnMappingRow>
        {fields.map((field) => (
          <ColumnMappingRow key={field.key}>
            <ColumnMappingLabel as="label" htmlFor={`import-map-${field.key}`}>
              {field.expenseFieldLabel}
              {field.required ? ' *' : null}
            </ColumnMappingLabel>
            <ColumnMappingSelect
              id={`import-map-${field.key}`}
              as={InlineInput}
              value={field.value}
              onChange={(event) => field.onChange(event.currentTarget.value)}
            >
              <option value="">{field.placeholder}</option>
              {manualMappingData.header.map((column, index) => (
                <option key={`${field.key}-col-${index}`} value={String(index)}>
                  {formatStatementColumnOption(column, index, manualMappingData.dataRows)}
                </option>
              ))}
            </ColumnMappingSelect>
          </ColumnMappingRow>
        ))}
      </ColumnMappingGrid>

      <Actions>
        <Button
          type="button"
          $variant="secondary"
          onClick={onSwapMerchantDescriptionColumns}
          disabled={!canSwapMerchantDescription}
          title="Exchange merchant and description column selections"
        >
          Swap merchant ↔ description
        </Button>
        <Button type="button" onClick={onApplyManualMapping}>
          Apply mapping
        </Button>
      </Actions>
    </>
  );
};
