import { Button, MutedText } from '../../../components/ui';
import type { ParsedStatementData } from '../types';
import { Actions, InlineInput } from '../importPageStyles';

type ImportManualMappingSectionProps = {
  manualMappingData: ParsedStatementData;
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
  onApplyManualMapping,
}: ImportManualMappingSectionProps): JSX.Element => {
  return (
    <>
      <MutedText>Manual mapping required for this file format.</MutedText>
      <Actions>
        <InlineInput as="select" value={manualDateIndex} onChange={(event) => setManualDateIndex(event.currentTarget.value)}>
          <option value="">Select Date column</option>
          {manualMappingData.header.map((column, index) => (
            <option key={`date-col-${index}`} value={String(index)}>
              {column || `Column ${index + 1}`}
            </option>
          ))}
        </InlineInput>
        <InlineInput
          as="select"
          value={manualMerchantIndex}
          onChange={(event) => setManualMerchantIndex(event.currentTarget.value)}
        >
          <option value="">Select Merchant column</option>
          {manualMappingData.header.map((column, index) => (
            <option key={`merchant-col-${index}`} value={String(index)}>
              {column || `Column ${index + 1}`}
            </option>
          ))}
        </InlineInput>
        <InlineInput
          as="select"
          value={manualAmountIndex}
          onChange={(event) => setManualAmountIndex(event.currentTarget.value)}
        >
          <option value="">Select Amount column</option>
          {manualMappingData.header.map((column, index) => (
            <option key={`amount-col-${index}`} value={String(index)}>
              {column || `Column ${index + 1}`}
            </option>
          ))}
        </InlineInput>
        <InlineInput
          as="select"
          value={manualDescriptionIndex}
          onChange={(event) => setManualDescriptionIndex(event.currentTarget.value)}
        >
          <option value="">Description column (optional)</option>
          {manualMappingData.header.map((column, index) => (
            <option key={`desc-col-${index}`} value={String(index)}>
              {column || `Column ${index + 1}`}
            </option>
          ))}
        </InlineInput>
        <InlineInput
          as="select"
          value={manualCurrencyIndex}
          onChange={(event) => setManualCurrencyIndex(event.currentTarget.value)}
        >
          <option value="">Currency column (optional)</option>
          {manualMappingData.header.map((column, index) => (
            <option key={`currency-col-${index}`} value={String(index)}>
              {column || `Column ${index + 1}`}
            </option>
          ))}
        </InlineInput>
        <Button type="button" onClick={onApplyManualMapping}>
          Apply mapping
        </Button>
      </Actions>
    </>
  );
};
