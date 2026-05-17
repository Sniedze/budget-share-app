import {
  createExpense,
  importExpenses,
  listExpenses,
  deleteExpense,
  updateExpense,
} from '../modules/expenses/service.js';
import {
  acceptGroupInvitation,
  declineExpenseGroupParticipation,
  declineGroupInvitation,
} from '../modules/groups/invitations.js';
import {
  createGroup,
  listHouseholdSettlements,
  listGroups,
  listInvitations,
  listSplitTemplates,
  recordSettlementPayment,
  updateGroup,
  deleteExpenseGroup,
  upsertSplitTemplate,
} from '../modules/groups/service.js';
import { login, logoutSession, refreshSession, register, revokeRefreshTokens } from '../modules/auth/service.js';
import { clearSessionCookies, getRefreshTokenFromCookies, setSessionCookies } from '../modules/auth/cookies.js';
import { appError, ErrorCode } from './appError.js';
import {
  parseCreateExpenseInput,
  parseDeleteExpenseId,
  parseImportExpenseRows,
  parseUpdateExpenseInput,
} from '../modules/expenses/validation.js';
import type { GraphqlContext } from './context.js';
import { requireAuth } from './authz.js';
import {
  parseCreateGroupInput,
  parseRecordSettlementPaymentInput,
  parseUpdateGroupInput,
  parseUpsertSplitTemplateInput,
} from '../modules/groups/validation.js';
import type { LoginInput, RegisterInput } from '../modules/auth/types.js';
import {
  getUserWorkspaceSettings,
  saveUserWorkspaceSettings,
} from '../modules/userSettings/service.js';
import {
  fromGraphqlSaveInput,
  toGraphqlUserWorkspaceSettings,
} from '../modules/userSettings/graphqlMappers.js';
import {
  parseSaveUserWorkspaceSettingsInput,
  parseYearMonth,
} from '../modules/userSettings/validation.js';

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
    householdSettlements: async (
      _parent: unknown,
      args: { period?: string | null },
      context: GraphqlContext,
    ) => {
      const user = requireAuth(context);
      return listHouseholdSettlements(user.email, user.id, args.period);
    },
    userWorkspaceSettings: async (
      _parent: unknown,
      args: { yearMonth: string },
      context: GraphqlContext,
    ) => {
      const user = requireAuth(context);
      const yearMonth = parseYearMonth(args.yearMonth);
      const settings = await getUserWorkspaceSettings(Number(user.id), yearMonth);
      return toGraphqlUserWorkspaceSettings(settings);
    },
  },
  Mutation: {
    addExpense: async (_parent: unknown, args: { input: unknown }, context: GraphqlContext) => {
      const user = requireAuth(context);
      return createExpense(parseCreateExpenseInput(args.input), { userId: user.id, email: user.email });
    },
    importExpenses: async (_parent: unknown, args: { input: unknown }, context: GraphqlContext) => {
      const user = requireAuth(context);
      return importExpenses(parseImportExpenseRows(args.input), { userId: user.id, email: user.email });
    },
    deleteExpense: async (_parent: unknown, args: { input: unknown }, context: GraphqlContext) => {
      const user = requireAuth(context);
      return deleteExpense(parseDeleteExpenseId(args.input), { userId: user.id, email: user.email });
    },
    updateExpense: async (_parent: unknown, args: { input: unknown }, context: GraphqlContext) => {
      const user = requireAuth(context);
      return updateExpense(parseUpdateExpenseInput(args.input), { userId: user.id, email: user.email });
    },
    createGroup: async (_parent: unknown, args: { input: unknown }, context: GraphqlContext) => {
      const user = requireAuth(context);
      return createGroup(parseCreateGroupInput(args.input), user.email);
    },
    updateGroup: async (_parent: unknown, args: { input: unknown }, context: GraphqlContext) => {
      const user = requireAuth(context);
      return updateGroup(parseUpdateGroupInput(args.input), { userId: user.id, email: user.email });
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
        throw appError(ErrorCode.UNAUTHENTICATED, 'Refresh token required.');
      }
      const payload = await refreshSession(token);
      setSessionCookies(context.res, payload.accessToken, payload.refreshToken, { remember: true });
      return { user: payload.user };
    },
    logout: async (_parent: unknown, _args: unknown, context: GraphqlContext) => {
      const refreshToken = getRefreshTokenFromCookies(context.req);
      await logoutSession(refreshToken);
      clearSessionCookies(context.res);
      return true;
    },
    logoutAllDevices: async (_parent: unknown, _args: unknown, context: GraphqlContext) => {
      const user = requireAuth(context);
      await revokeRefreshTokens(user.id);
      clearSessionCookies(context.res);
      return true;
    },
    upsertGroupSplitTemplate: async (_parent: unknown, args: { input: unknown }, context: GraphqlContext) => {
      const user = requireAuth(context);
      return upsertSplitTemplate(parseUpsertSplitTemplateInput(args.input), user.email);
    },
    recordSettlementPayment: async (_parent: unknown, args: { input: unknown }, context: GraphqlContext) => {
      const user = requireAuth(context);
      return recordSettlementPayment(parseRecordSettlementPaymentInput(args.input), user.email);
    },
    acceptGroupInvitation: async (
      _parent: unknown,
      args: { id: string },
      context: GraphqlContext,
    ) => {
      const user = requireAuth(context);
      return acceptGroupInvitation(args.id, user.email);
    },
    declineGroupInvitation: async (
      _parent: unknown,
      args: { id: string },
      context: GraphqlContext,
    ) => {
      const user = requireAuth(context);
      return declineGroupInvitation(args.id, user.email);
    },
    declineExpenseGroupParticipation: async (
      _parent: unknown,
      args: { groupId: string; category: string },
      context: GraphqlContext,
    ) => {
      const user = requireAuth(context);
      return declineExpenseGroupParticipation(args.groupId, args.category, user.email);
    },
    deleteExpenseGroup: async (
      _parent: unknown,
      args: { groupId: string; category: string },
      context: GraphqlContext,
    ) => {
      const user = requireAuth(context);
      return deleteExpenseGroup(args.groupId, args.category, user.email);
    },
    saveUserWorkspaceSettings: async (
      _parent: unknown,
      args: { input: unknown },
      context: GraphqlContext,
    ) => {
      const user = requireAuth(context);
      const parsed = parseSaveUserWorkspaceSettingsInput(fromGraphqlSaveInput(args.input as never));
      const saved = await saveUserWorkspaceSettings(Number(user.id), parsed);
      return toGraphqlUserWorkspaceSettings(saved);
    },
  },
};
