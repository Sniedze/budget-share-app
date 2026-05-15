import type { InvitationEmailDeliveryStatusLabel } from './invitationEmailStatus';

export type GroupMember = {
  name: string;
  email: string;
  ratio: number;
};

export type GroupInvitationStatus = 'Pending' | 'Accepted' | 'Declined';

export type GroupPendingInvitation = {
  email: string;
  name: string;
  status: GroupInvitationStatus;
  emailDeliveryStatus?: InvitationEmailDeliveryStatusLabel;
};

export type GroupInvitation = {
  id: string;
  groupId: string;
  groupName: string;
  email: string;
  status: GroupInvitationStatus;
  emailDeliveryStatus?: InvitationEmailDeliveryStatusLabel;
  invitedAt: string;
  acceptedAt?: string;
};

export type GroupExpense = {
  date: string;
  expenseGroup?: string;
  category: string;
  description: string;
  paidBy: string;
  total: number;
  yourShare: number;
  isPrivate: boolean;
  currency: string;
};

export type GroupSummary = {
  id: string;
  name: string;
  description?: string;
  members: GroupMember[];
  totalSpent: number;
  yourShare: number;
  expenses: GroupExpense[];
  /** Split-template categories for this household (may have no expenses yet). */
  expenseGroupLabels: string[];
  pendingInvitations?: GroupPendingInvitation[];
};

export type CreateGroupInput = {
  name: string;
  description?: string;
  members: GroupMember[];
};

export type SplitTemplate = {
  id: string;
  groupId: string;
  category: string;
  templateName: string;
  splitDetails: Array<{
    participant: string;
    ratio: number;
  }>;
};
