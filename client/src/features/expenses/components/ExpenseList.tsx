import type { Expense } from '../types';

type ExpenseListProps = {
  expenses: Expense[];
  isMutating: boolean;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
};

const formatDate = (value: string): string => {
  return new Date(value).toLocaleDateString();
};

export const ExpenseList = ({
  expenses,
  isMutating,
  onEdit,
  onDelete,
}: ExpenseListProps): JSX.Element => {
  if (!expenses.length) {
    return <p className="placeholder">No expenses yet.</p>;
  }

  return (
    <ul className="expense-list">
      {expenses.map((expense) => (
        <li className="expense-list-item" key={expense.id}>
          <div className="expense-main">
            <strong>{expense.title}</strong>
            <span>${expense.amount.toFixed(2)}</span>
          </div>
          <div className="expense-meta">
            <span>Transaction: {formatDate(expense.transactionDate)}</span>
            <span>Created: {formatDate(expense.createdAt)}</span>
          </div>
          <div className="expense-actions">
            <button
              className="button button-primary"
              type="button"
              onClick={() => onEdit(expense)}
              disabled={isMutating}
            >
              Edit
            </button>
            <button
              className="button button-danger"
              type="button"
              onClick={() => onDelete(expense.id)}
              disabled={isMutating}
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
};
