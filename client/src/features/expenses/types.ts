import type {
  AddExpenseMutation,
  AddExpenseMutationVariables,
  ExpenseFlow,
  GetExpensesQuery,
  SplitAllocation,
  SplitAllocationInput,
  SplitType,
  UpdateExpenseMutation,
  UpdateExpenseMutationVariables,
} from '../../graphql/generated/graphql';

export type { ExpenseFlow, SplitAllocation, SplitAllocationInput, SplitType };

export type Expense = GetExpensesQuery['expenses'][number];
export type GetExpensesResponse = GetExpensesQuery;
export type AddExpenseInput = AddExpenseMutationVariables['input'];
export type UpdateExpenseInput = UpdateExpenseMutationVariables['input'];
export type AddExpenseMutationResult = AddExpenseMutation['addExpense'];
export type UpdateExpenseMutationResult = NonNullable<UpdateExpenseMutation['updateExpense']>;
