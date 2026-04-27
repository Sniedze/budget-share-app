import { createExpense, listExpenses, deleteExpense } from '../modules/expenses/service.js';
import type { CreateExpenseInput, DeleteExpenseInput } from '../modules/expenses/types.js';

export const resolvers = {
  Query: {
    hello: () => 'Hello from GraphQL!',
    expenses: async () => listExpenses(),
  },
  Mutation: {
    addExpense: async (_parent: unknown, args: { input: CreateExpenseInput }) => {
      return createExpense(args.input);
    },
    deleteExpense: async (_parent: unknown, args: { input: DeleteExpenseInput }) => {
      return deleteExpense(args.input.id);
    },
  },
};
