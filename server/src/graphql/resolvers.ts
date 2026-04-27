import { createExpense, listExpenses } from '../modules/expenses/service.js';
import type { CreateExpenseInput } from '../modules/expenses/types.js';

export const resolvers = {
  Query: {
    hello: () => 'Hello from GraphQL!',
    expenses: () => listExpenses(),
  },
  Mutation: {
    addExpense: (_parent: unknown, args: { input: CreateExpenseInput }) => {
      return createExpense(args.input);
    },
  },
};
