import type { Expense, GroupMember } from '../../../graphql/operationTypes';

export type ExpenseViewerContext = {
  userId: string;
  fullName: string;
  email: string;
};

const normalizeKey = (value: string): string => value.trim().toLowerCase();

const participantMatchesViewer = (
  participant: string,
  viewer: ExpenseViewerContext,
  createdByUserId?: string | null,
): boolean => {
  const key = normalizeKey(participant);
  if (key === 'you') {
    return createdByUserId !== null && createdByUserId !== undefined && createdByUserId === viewer.userId;
  }
  return key === normalizeKey(viewer.fullName) || key === normalizeKey(viewer.email);
};

const findViewerSplitAmount = (expense: Expense, viewer: ExpenseViewerContext): number | null => {
  const match = expense.splitDetails.find((detail) =>
    participantMatchesViewer(detail.participant, viewer, expense.createdByUserId),
  );
  return match ? match.amount : null;
};

const findViewerMemberRatio = (
  groupId: string,
  viewer: ExpenseViewerContext,
  membersByGroupId: Map<string, GroupMember[]>,
): number | null => {
  const members = membersByGroupId.get(groupId) ?? [];
  const viewerMember = members.find((member) => normalizeKey(member.email) === normalizeKey(viewer.email));
  return viewerMember?.ratio ?? null;
};

/** Amount that counts toward Personal Expenses on the dashboard (personal-only, not household). */
export const getExpensePersonalContribution = (expense: Expense, viewer: ExpenseViewerContext): number => {
  if (expense.groupId) {
    return 0;
  }

  if (expense.split === 'Personal') {
    return expense.amount;
  }

  if (expense.split === 'Custom') {
    return findViewerSplitAmount(expense, viewer) ?? expense.amount;
  }

  return 0;
};

/** User's share of a household (shared) expense. */
export const getExpenseSharedContribution = (
  expense: Expense,
  viewer: ExpenseViewerContext,
  membersByGroupId: Map<string, GroupMember[]>,
): number => {
  if (!expense.groupId) {
    return 0;
  }

  const fromSplitDetails = findViewerSplitAmount(expense, viewer);
  if (fromSplitDetails !== null) {
    return fromSplitDetails;
  }

  const memberRatio = findViewerMemberRatio(expense.groupId, viewer, membersByGroupId);
  if (memberRatio !== null) {
    return Number(((expense.amount * memberRatio) / 100).toFixed(2));
  }

  return 0;
};

/** Total cost to the viewer for charts and monthly totals (personal + shared share). */
export const getExpenseAttributableAmount = (
  expense: Expense,
  viewer: ExpenseViewerContext,
  membersByGroupId: Map<string, GroupMember[]>,
): number => {
  const personal = getExpensePersonalContribution(expense, viewer);
  if (personal > 0) {
    return personal;
  }
  return getExpenseSharedContribution(expense, viewer, membersByGroupId);
};

export const buildMembersByGroupId = (
  groups: Array<{ id: string; members: GroupMember[] }>,
): Map<string, GroupMember[]> => {
  return new Map(groups.map((group) => [group.id, group.members]));
};
