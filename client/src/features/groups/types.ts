import type {
  CreateGroupInput,
  CreateGroupMutation,
  GetGroupSplitTemplatesQuery,
  GetGroupsQuery,
  GetMyInvitationsQuery,
  GroupExpense,
  GroupInvitation,
  GroupInvitationStatus,
  GroupMember,
  GroupPendingInvitation,
  ResendGroupInvitationMutation,
  UpdateGroupMutation,
} from '../../graphql/generated/graphql';

export type {
  CreateGroupInput,
  GroupExpense,
  GroupInvitation,
  GroupInvitationStatus,
  GroupMember,
  GroupPendingInvitation,
};

export type GroupSummary = GetGroupsQuery['groups'][number];
export type SplitTemplate = GetGroupSplitTemplatesQuery['groupSplitTemplates'][number];
export type GetGroupsQueryResult = GetGroupsQuery;
export type CreateGroupMutationResult = CreateGroupMutation['createGroup'];
export type UpdateGroupMutationResult = UpdateGroupMutation['updateGroup'];
export type GetGroupSplitTemplatesQueryResult = GetGroupSplitTemplatesQuery;
export type GetMyInvitationsQueryResult = GetMyInvitationsQuery;
export type ResendGroupInvitationMutationResult = ResendGroupInvitationMutation['resendGroupInvitation'];
