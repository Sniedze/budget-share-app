import type { FormEvent } from 'react';
import styled from 'styled-components';

const Form = styled.form`
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  align-items: center;
  flex-wrap: wrap;
`;

const Input = styled.input`
  font: inherit;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  min-width: 140px;
`;

const Button = styled.button<{ $variant: 'primary' | 'secondary' }>`
  font: inherit;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  color: #ffffff;
  cursor: pointer;
  background: ${({ $variant }) => ($variant === 'primary' ? '#2563eb' : '#6b7280')};

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

type ExpenseFormProps = {
  title: string;
  amount: string;
  transactionDate: string;
  editingId: string | null;
  isMutating: boolean;
  onTitleChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onTransactionDateChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
};

export const ExpenseForm = ({
  title,
  amount,
  transactionDate,
  editingId,
  isMutating,
  onTitleChange,
  onAmountChange,
  onTransactionDateChange,
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
