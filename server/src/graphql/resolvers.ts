import {
  createExpense,
  listExpenses,
  deleteExpense,
  updateExpense,
} from '../modules/expenses/service.js';
import { createGroup, listGroups } from '../modules/groups/service.js';
import type {
  CreateExpenseInput,
  DeleteExpenseInput,
  UpdateExpenseInput,
} from '../modules/expenses/types.js';
import type { CreateGroupInput } from '../modules/groups/types.js';

export const resolvers = {
  Query: {
    hello: () => 'Hello from GraphQL!',
    expenses: async () => listExpenses(),
    groups: async () => listGroups(),
  },
  Mutation: {
    addExpense: async (_parent: unknown, args: { input: CreateExpenseInput }) => {
      return createExpense(args.input);
    },
    deleteExpense: async (_parent: unknown, args: { input: DeleteExpenseInput }) => {
      return deleteExpense(args.input.id);
    },
    updateExpense: async (_parent: unknown, args: { input: UpdateExpenseInput }) => {
      return updateExpense(args.input);
    },
    createGroup: async (_parent: unknown, args: { input: CreateGroupInput }) => {
      return createGroup(args.input);
    },
  },
};
