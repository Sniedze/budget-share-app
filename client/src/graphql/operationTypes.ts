/**
 * GraphQL operation types derived from codegen. Import from here instead of per-feature types.ts files.
 */
import type {
  AddExpenseMutation,
  AddExpenseMutationVariables,
  ChangePasswordMutation,
  CreateGroupInput,
  CreateGroupMutation,
  ExpenseFlow,
  ExpenseGroupSettlement,
  GetExpensesQuery,
  GetGroupSplitTemplatesQuery,
  GetGroupsQuery,
  GetHouseholdSettlementsQuery,
  GetMyInvitationsQuery,
  GroupExpense,
  GroupInvitation,
  GroupInvitationStatus,
  GroupMember,
  GroupPendingInvitation,
  LoginMutation,
  MeQuery,
  RegisterMutation,
  ResendGroupInvitationMutation,
  SettlementBalance,
  SettlementPayment,
  SettlementTransfer,
  SplitAllocation,
  SplitAllocationInput,
  SplitType,
  UpdateExpenseMutation,
  UpdateExpenseMutationVariables,
  UpdateGroupMutation,
} from './generated/graphql';

export type {
  CreateGroupInput,
  ExpenseFlow,
  ExpenseGroupSettlement,
  GroupExpense,
  GroupInvitation,
  GroupInvitationStatus,
  GroupMember,
  GroupPendingInvitation,
  SettlementBalance,
  SettlementPayment,
  SettlementTransfer,
  SplitAllocation,
  SplitAllocationInput,
  SplitType,
};

export type Expense = GetExpensesQuery['expenses'][number];
export type GetExpensesResponse = GetExpensesQuery;
export type AddExpenseInput = AddExpenseMutationVariables['input'];
export type UpdateExpenseInput = UpdateExpenseMutationVariables['input'];
export type AddExpenseMutationResult = AddExpenseMutation['addExpense'];
export type UpdateExpenseMutationResult = NonNullable<UpdateExpenseMutation['updateExpense']>;

export type GroupSummary = GetGroupsQuery['groups'][number];
export type SplitTemplate = GetGroupSplitTemplatesQuery['groupSplitTemplates'][number];
export type GetGroupsQueryResult = GetGroupsQuery;
export type CreateGroupMutationResult = CreateGroupMutation['createGroup'];
export type UpdateGroupMutationResult = UpdateGroupMutation['updateGroup'];
export type GetGroupSplitTemplatesQueryResult = GetGroupSplitTemplatesQuery;
export type GetMyInvitationsQueryResult = GetMyInvitationsQuery;
export type ResendGroupInvitationMutationResult = ResendGroupInvitationMutation['resendGroupInvitation'];

export type GetHouseholdSettlementsResponse = GetHouseholdSettlementsQuery;
export type HouseholdSettlement = GetHouseholdSettlementsQuery['householdSettlements'][number];

export type AuthUser = NonNullable<MeQuery['me']>;
export type AuthMutationData = {
  login?: LoginMutation['login'];
  register?: RegisterMutation['register'];
  changePassword?: ChangePasswordMutation['changePassword'];
};
