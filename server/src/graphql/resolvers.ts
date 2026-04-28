import {
  createExpense,
  listExpenses,
  deleteExpense,
  updateExpense,
} from '../modules/expenses/service.js';
import { createGroup, listGroups } from '../modules/groups/service.js';
import { login, refreshSession, register } from '../modules/auth/service.js';
import type {
  CreateExpenseInput,
  DeleteExpenseInput,
  UpdateExpenseInput,
} from '../modules/expenses/types.js';
import type { GraphqlContext } from './context.js';
import type { CreateGroupInput } from '../modules/groups/types.js';
import type { LoginInput, RegisterInput } from '../modules/auth/types.js';

const requireAuth = (context: GraphqlContext) => {
  if (!context.currentUser) {
    throw new Error('Authentication required.');
  }
  return context.currentUser;
};

export const resolvers = {
  Query: {
    hello: () => 'Hello from GraphQL!',
    me: async (_parent: unknown, _args: unknown, context: GraphqlContext) => context.currentUser,
    expenses: async (_parent: unknown, _args: unknown, context: GraphqlContext) => {
      const user = requireAuth(context);
      return listExpenses(user.id, user.email);
    },
    groups: async (_parent: unknown, _args: unknown, context: GraphqlContext) => {
      const user = requireAuth(context);
      return listGroups(user.email);
    },
  },
  Mutation: {
    addExpense: async (_parent: unknown, args: { input: CreateExpenseInput }, context: GraphqlContext) => {
      const user = requireAuth(context);
      return createExpense(args.input, { userId: user.id, email: user.email });
    },
    deleteExpense: async (_parent: unknown, args: { input: DeleteExpenseInput }, context: GraphqlContext) => {
      const user = requireAuth(context);
      return deleteExpense(args.input.id, { userId: user.id, email: user.email });
    },
    updateExpense: async (_parent: unknown, args: { input: UpdateExpenseInput }, context: GraphqlContext) => {
      const user = requireAuth(context);
      return updateExpense(args.input, { userId: user.id, email: user.email });
    },
    createGroup: async (_parent: unknown, args: { input: CreateGroupInput }, context: GraphqlContext) => {
      const user = requireAuth(context);
      return createGroup(args.input, user.email);
    },
    register: async (_parent: unknown, args: { input: RegisterInput }) => {
      return register(args.input);
    },
    login: async (_parent: unknown, args: { input: LoginInput }) => {
      return login(args.input);
    },
    refreshSession: async (_parent: unknown, args: { input: { refreshToken: string } }) => {
      return refreshSession(args.input.refreshToken);
    },
  },
};
