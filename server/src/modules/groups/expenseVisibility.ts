import type { RowDataPacket } from 'mysql2/promise';
import { db } from '../../db/mysql.js';
import { parseExpenseSettlementAmounts } from './splitDetailsParse.js';

/** Synthetic settlements scope for Custom splits without a household (GraphQL groupId). */
export const PERSONAL_CUSTOM_SETTLEMENT_GROUP_ID = 'personal-custom';

export type ExpenseGroupSplitAllocation = {
  participant: string;
  ratio: number;
};

export type ExpenseViewerProfile = {
  userId: string;
  fullName: string;
  email: string;
};

const normalizeParticipantKey = (name: string): string => name.trim().toLowerCase();

const participantMatchesViewerProfile = (
  participant: string,
  viewer: ExpenseViewerProfile,
  createdByUserId: string | number | null | undefined,
): boolean => {
  const key = normalizeParticipantKey(participant);
  if (key === 'you') {
    return createdByUserId !== null && String(createdByUserId) === viewer.userId;
  }
  return (
    key === normalizeParticipantKey(viewer.fullName) ||
    key === normalizeParticipantKey(viewer.email)
  );
};

/** Custom split without a household: visible to creator and named participants. */
export const viewerParticipatesInCustomSplit = (
  splitDetailsJson: string | null | undefined,
  amount: number,
  viewer: ExpenseViewerProfile,
  createdByUserId: string | number | null | undefined,
): boolean => {
  const shares = parseExpenseSettlementAmounts(
    typeof splitDetailsJson === 'string' ? splitDetailsJson : null,
    amount,
  );
  return shares.some((share) =>
    participantMatchesViewerProfile(share.participant, viewer, createdByUserId),
  );
};

/**
 * True when the viewer's household member name is allocated on this expense
 * (expense-group template for Shared, or split_details for Custom).
 */
export const viewerParticipatesInExpenseGroup = (
  viewerMemberName: string | null | undefined,
  splitType: string,
  splitDetailsJson: string | null | undefined,
  templateSplit: ExpenseGroupSplitAllocation[],
  amount: number,
): boolean => {
  const viewerKey = viewerMemberName?.trim();
  if (!viewerKey) {
    return false;
  }
  const normalizedViewer = normalizeParticipantKey(viewerKey);

  if (splitType === 'Custom') {
    const shares = parseExpenseSettlementAmounts(
      typeof splitDetailsJson === 'string' ? splitDetailsJson : null,
      amount,
    );
    return shares.some((share) => normalizeParticipantKey(share.participant) === normalizedViewer);
  }

  if (templateSplit.length > 0) {
    return templateSplit.some(
      (allocation) => normalizeParticipantKey(allocation.participant) === normalizedViewer,
    );
  }

  return false;
};

export const loadExpenseViewerProfile = async (
  userId: string,
  fallbackEmail: string,
): Promise<ExpenseViewerProfile> => {
  const numericUserId = Number(userId);
  if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
    return { userId, fullName: '', email: fallbackEmail };
  }
  const [rows] = await db.query<Array<{ full_name: string; email: string } & RowDataPacket>>(
    'SELECT full_name, email FROM users WHERE id = ? LIMIT 1',
    [numericUserId],
  );
  const row = rows[0];
  return {
    userId,
    fullName: row?.full_name?.trim() ?? '',
    email: row?.email?.trim() || fallbackEmail,
  };
};

/** Legacy rows with is_private=1: only the creator may see them outside Personal Finances. */
export const legacyPrivateExpenseHiddenFromOthers = (
  isPrivate: boolean,
  createdByUserId: string | number | null | undefined,
  viewerUserId: string,
): boolean => isPrivate && String(createdByUserId ?? '') !== viewerUserId;
