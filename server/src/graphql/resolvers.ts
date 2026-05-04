import {
  createExpense,
  listExpenses,
  deleteExpense,
  updateExpense,
} from '../modules/expenses/service.js';
import {
  createGroup,
  listHouseholdSettlements,
  listGroups,
  listInvitations,
  listSplitTemplates,
  recordSettlementPayment,
  updateGroup,
  upsertSplitTemplate,
} from '../modules/groups/service.js';
import {
  login,
  refreshSession,
  register,
  revokeRefreshTokens,
} from '../modules/auth/service.js';
import { clearSessionCookies, getRefreshTokenFromCookies, setSessionCookies } from '../modules/auth/cookies.js';
import type {
  CreateExpenseInput,
  DeleteExpenseInput,
  UpdateExpenseInput,
} from '../modules/expenses/types.js';
import type { GraphqlContext } from './context.js';
import type {
  CreateGroupInput,
  RecordSettlementPaymentInput,
  UpdateGroupInput,
  UpsertSplitTemplateInput,
} from '../modules/groups/types.js';
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
      return listGroups(user.email, user.id);
    },
    myInvitations: async (_parent: unknown, _args: unknown, context: GraphqlContext) => {
      const user = requireAuth(context);
      return listInvitations(user.email);
    },
    groupSplitTemplates: async (
      _parent: unknown,
      args: { groupId: string },
      context: GraphqlContext,
    ) => {
      const user = requireAuth(context);
      return listSplitTemplates(args.groupId, user.email);
    },
    householdSettlements: async (_parent: unknown, _args: unknown, context: GraphqlContext) => {
      const user = requireAuth(context);
      return listHouseholdSettlements(user.email, user.id);
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
    updateGroup: async (_parent: unknown, args: { input: UpdateGroupInput }, context: GraphqlContext) => {
      const user = requireAuth(context);
      return updateGroup(args.input, { userId: user.id, email: user.email });
    },
    register: async (_parent: unknown, args: { input: RegisterInput }, context: GraphqlContext) => {
      const payload = await register(args.input);
      setSessionCookies(context.res, payload.accessToken, payload.refreshToken, { remember: true });
      return { user: payload.user };
    },
    login: async (_parent: unknown, args: { input: LoginInput }, context: GraphqlContext) => {
      const payload = await login(args.input);
      const remember = args.input.rememberMe !== false;
      setSessionCookies(context.res, payload.accessToken, payload.refreshToken, { remember });
      return { user: payload.user };
    },
    refreshSession: async (
      _parent: unknown,
      args: { input: { refreshToken?: string | null } },
      context: GraphqlContext,
    ) => {
      const fromBody = args.input.refreshToken?.trim();
      const fromCookie = getRefreshTokenFromCookies(context.req);
      const token = (fromBody && fromBody.length > 0 ? fromBody : null) ?? fromCookie;
      if (!token) {
        throw new Error('Refresh token required.');
      }
      const payload = await refreshSession(token);
      setSessionCookies(context.res, payload.accessToken, payload.refreshToken, { remember: true });
      return { user: payload.user };
    },
    logout: async (_parent: unknown, _args: unknown, context: GraphqlContext) => {
      if (context.currentUser) {
        await revokeRefreshTokens(context.currentUser.id);
      }
      clearSessionCookies(context.res);
      return true;
    },
    upsertGroupSplitTemplate: async (
      _parent: unknown,
      args: { input: UpsertSplitTemplateInput },
      context: GraphqlContext,
    ) => {
      const user = requireAuth(context);
      return upsertSplitTemplate(args.input, user.email);
    },
    recordSettlementPayment: async (
      _parent: unknown,
      args: { input: RecordSettlementPaymentInput },
      context: GraphqlContext,
    ) => {
      const user = requireAuth(context);
      return recordSettlementPayment(args.input, user.email);
    },
  },
};
