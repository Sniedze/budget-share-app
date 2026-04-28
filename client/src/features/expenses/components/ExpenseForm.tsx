import type { FormEvent } from 'react';
import styled from 'styled-components';
import { Button, Input } from '../../../components/ui';

const Form = styled.form`
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  align-items: center;
  flex-wrap: wrap;
`;

type ExpenseFormProps = {
  title: string;
  amount: string;
  transactionDate: string;
  category: string;
  split: string;
  editingId: string | null;
  isMutating: boolean;
  onTitleChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onTransactionDateChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSplitChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
};

export const ExpenseForm = ({
  title,
  amount,
  transactionDate,
  category,
  split,
  editingId,
  isMutating,
  onTitleChange,
  onAmountChange,
  onTransactionDateChange,
  onCategoryChange,
  onSplitChange,
  onSubmit,
  onCancel,
}: ExpenseFormProps): JSX.Element => {
  return (
    <Form onSubmit={onSubmit}>
      <Input
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder="Expense title"
      />
      <Input
        value={amount}
        onChange={(event) => onAmountChange(event.target.value)}
        placeholder="Amount"
        type="number"
        step="0.01"
      />
      <Input
        value={transactionDate}
        onChange={(event) => onTransactionDateChange(event.target.value)}
        type="date"
      />
      <Input
        value={category}
        onChange={(event) => onCategoryChange(event.target.value)}
        placeholder="Category"
      />
      <Input as="select" value={split} onChange={(event) => onSplitChange(event.target.value)}>
        <option value="Personal">Personal</option>
        <option value="Shared">Shared</option>
      </Input>
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
