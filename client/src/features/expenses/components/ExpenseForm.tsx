import type {
  ChangeEvent,
  FormEvent,
} from 'react';
import styled from 'styled-components';
import {
  Button,
  Input,
} from '../../../components/ui';
import type {
  SplitAllocationInput,
  SplitType,
} from '../types';

const Form = styled.form`
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  align-items: center;
  flex-wrap: wrap;
`;

const SplitDetails = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SplitRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 120px auto;
  gap: 8px;
`;

type ExpenseFormProps = {
  title: string;
  amount: string;
  transactionDate: string;
  category: string;
  split: SplitType;
  splitDetails: SplitAllocationInput[];
  editingId: string | null;
  isMutating: boolean;
  onInputChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSplitDetailChange: (index: number, field: 'participant' | 'ratio', value: string) => void;
  onAddSplitDetail: () => void;
  onRemoveSplitDetail: (index: number) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
};

export const ExpenseForm = ({
  title,
  amount,
  transactionDate,
  category,
  split,
  splitDetails,
  editingId,
  isMutating,
  onInputChange,
  onSplitDetailChange,
  onAddSplitDetail,
  onRemoveSplitDetail,
  onSubmit,
  onCancel,
}: ExpenseFormProps): JSX.Element => {
  return (
    <Form onSubmit={onSubmit}>
      <Input
        name="title"
        value={title}
        onChange={onInputChange}
        placeholder="Expense title"
      />
      <Input
        name="amount"
        value={amount}
        onChange={onInputChange}
        placeholder="Amount"
        type="number"
        step="0.01"
      />
      <Input
        name="transactionDate"
        value={transactionDate}
        onChange={onInputChange}
        type="date"
      />
      <Input
        name="category"
        value={category}
        onChange={onInputChange}
        placeholder="Category"
      />
      <Input
        as="select"
        name="split"
        value={split}
        onChange={onInputChange}
      >
        <option value="Personal">Personal</option>
        <option value="Shared">Shared</option>
        <option value="Custom">Custom</option>
      </Input>
      {split === 'Custom' ? (
        <SplitDetails>
          {splitDetails.map((detail, index) => (
            <SplitRow key={`split-detail-${index}`}>
              <Input
                value={detail.participant}
                onChange={(event) => onSplitDetailChange(index, 'participant', event.target.value)}
                placeholder="Participant"
              />
              <Input
                value={String(detail.ratio)}
                onChange={(event) => onSplitDetailChange(index, 'ratio', event.target.value)}
                placeholder="Ratio %"
                type="number"
                min="0"
                step="0.01"
              />
              <Button
                type="button"
                $variant="secondary"
                $size="sm"
                onClick={() => onRemoveSplitDetail(index)}
                disabled={isMutating || splitDetails.length <= 1}
              >
                Remove
              </Button>
            </SplitRow>
          ))}
          <Button type="button" $variant="secondary" $size="sm" onClick={onAddSplitDetail}>
            + Add Split Row
          </Button>
        </SplitDetails>
      ) : null}
      <Button $variant="primary" type="submit" disabled={isMutating}>
        {editingId ? 'Save' : 'Add expense'}
      </Button>
      {editingId ? (
        <Button $variant="secondary" type="button" onClick={onCancel} disabled={isMutating}>
          Cancel
        </Button>
      ) : null}
    </Form>
  );
};
