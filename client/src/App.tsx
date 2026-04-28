import { useQuery } from '@apollo/client/react';
import { FormEvent, useMemo, useState } from 'react';
import { GET_EXPENSES } from './features/expenses/graphql';
import { ExpenseForm } from './features/expenses/components/ExpenseForm';
import { ExpenseList } from './features/expenses/components/ExpenseList';
import type { Expense, GetExpensesResponse } from './features/expenses/types';
import { useExpenseActions } from './hooks/useExpenseActions';
import { Sidebar } from './components/Sidebar';
import './App.css';

const App = (): JSX.Element => {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, loading, error } = useQuery<GetExpensesResponse>(GET_EXPENSES);

  const { addExpense, updateExpense, deleteExpense, isMutating } = useExpenseActions(GET_EXPENSES);

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setTransactionDate(new Date().toISOString().slice(0, 10));
    setEditingId(null);
  };

  const expenses = useMemo(() => data?.expenses ?? [], [data]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedAmount = Number(amount);

    if (!title.trim() || Number.isNaN(parsedAmount) || !transactionDate) return;

    if (editingId) {
      await updateExpense({
        id: editingId,
        title: title.trim(),
        amount: parsedAmount,
        transactionDate,
      });
    } else {
      await addExpense({
        title: title.trim(),
        amount: parsedAmount,
        transactionDate,
      });
    }

    resetForm();
  };

  const handleEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setTitle(expense.title);
    setAmount(String(expense.amount));
    setTransactionDate(expense.transactionDate.slice(0, 10));
  };

  const handleDelete = async (id: string) => {
    await deleteExpense(id);

    if (editingId === id) {
      resetForm();
    }
  };

  return (
    <main className="app-layout">
      <Sidebar />

      <section className="page">
        <h1 className="page-title">Household Budget</h1>

        <ExpenseForm
          title={title}
          amount={amount}
          transactionDate={transactionDate}
          editingId={editingId}
          isMutating={isMutating}
          onTitleChange={setTitle}
          onAmountChange={setAmount}
          onTransactionDateChange={setTransactionDate}
          onSubmit={handleSubmit}
          onCancel={resetForm}
        />

        {loading ? <p className="placeholder">Loading expenses...</p> : null}
        {error ? <p className="placeholder">Error: {error.message}</p> : null}
        {!loading && !error ? (
          <ExpenseList
            expenses={expenses}
            isMutating={isMutating}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ) : null}
      </section>
    </main>
  );
};

export default App;
