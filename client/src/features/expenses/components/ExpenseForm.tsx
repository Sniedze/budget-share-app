import type { FormEvent } from 'react';

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
    <form className="expense-form" onSubmit={onSubmit}>
      <input
        className="input"
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder="Expense title"
      />
      <input
        className="input"
        value={amount}
        onChange={(event) => onAmountChange(event.target.value)}
        placeholder="Amount"
        type="number"
        step="0.01"
      />
      <input
        className="input"
        value={transactionDate}
        onChange={(event) => onTransactionDateChange(event.target.value)}
        type="date"
      />
      <button className="button button-primary" type="submit" disabled={isMutating}>
        {editingId ? 'Save' : 'Add expense'}
      </button>
      {editingId ? (
        <button className="button button-secondary" type="button" onClick={onCancel} disabled={isMutating}>
          Cancel
        </button>
      ) : null}
    </form>
  );
};
