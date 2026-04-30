import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db } from '../../db/mysql.js';
import type {
  CreateGroupInput,
  ExpenseGroupSettlement,
  Group,
  GroupInvitation,
  GroupMember,
  HouseholdSettlement,
  RecordSettlementPaymentInput,
  SettlementBalance,
  SettlementPayment,
  SettlementTransfer,
  SplitTemplate,
  UpdateGroupInput,
  UpsertSplitTemplateInput,
} from './types.js';
import { logAuditEvent } from '../audit/service.js';

type GroupRow = {
  id: number;
  name: string;
  description: string | null;
} & RowDataPacket;

type GroupMemberRow = {
  groupId: number;
  name: string;
  email: string;
  ratio: number | string;
} & RowDataPacket;

type GroupInvitationRow = {
  id: number;
  groupId: number;
  groupName: string;
  email: string;
  status: string;
  invitedAt: Date | string;
  acceptedAt: Date | string | null;
} & RowDataPacket;

type GroupExpenseRow = {
  id: number;
  groupId: number;
  title: string;
  expenseGroup: string | null;
  category: string;
  amount: string;
  transactionDate: Date | string;
  paidByName: string | null;
} & RowDataPacket;

type SplitTemplateRow = {
  id: number;
  groupId: number;
  category: string;
  templateName: string;
  splitDetails: string | Array<{ participant: string; ratio: number }>;
} & RowDataPacket;

type SettlementExpenseRow = {
  id: number;
  groupId: number;
  amount: string;
  expenseGroup: string | null;
  category: string;
  splitDetails: string | null;
  paidByName: string | null;
} & RowDataPacket;

type SettlementPaymentRow = {
  id: number;
  groupId: number;
  expenseGroup: string | null;
  fromMember: string;
  toMember: string;
  amount: string;
  note: string | null;
  settledAt: Date | string;
} & RowDataPacket;

const toIsoString = (value: Date | string): string => {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

const toNumericRatio = (value: number | string): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const normalizeMembers = (members: GroupMember[]): GroupMember[] => {
  return members.map((member) => ({
    name: member.name.trim(),
    email: member.email.trim().toLowerCase(),
    ratio: Number(member.ratio.toFixed(2)),
  }));
};

const normalizeTemplateSplitDetails = (
  splitDetails: UpsertSplitTemplateInput['splitDetails'],
): Array<{ participant: string; ratio: number }> => {
  const normalized = splitDetails
    .map((item) => ({
      participant: item.participant.trim(),
      ratio: Number(item.ratio),
    }))
    .filter((item) => item.participant.length > 0 && Number.isFinite(item.ratio) && item.ratio > 0);

  if (normalized.length === 0) {
    throw new Error('Template split must include at least one member.');
  }

  const ratioTotal = normalized.reduce((sum, item) => sum + item.ratio, 0);
  if (Math.abs(ratioTotal - 100) > 0.01) {
    throw new Error(`Template ratios must add up to 100% (current: ${ratioTotal.toFixed(2)}%).`);
  }

  return normalized.map((item) => ({
    participant: item.participant,
    ratio: Number(item.ratio.toFixed(2)),
  }));
};

const parseTemplateSplitDetails = (
  value: SplitTemplateRow['splitDetails'],
): Array<{ participant: string; ratio: number }> => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed as Array<{ participant: string; ratio: number }>;
      }
      return [];
    } catch {
      return [];
    }
  }

  return [];
};

const roundCents = (value: number): number => Math.round(value * 100) / 100;

const parseExpenseSplitDetails = (
  value: string | null,
): Array<{ participant: string; amount: number }> => {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => {
        if (typeof item !== 'object' || item === null) {
          return null;
        }
        const participant =
          'participant' in item && typeof item.participant === 'string' ? item.participant.trim() : '';
        const amount = 'amount' in item ? Number(item.amount) : Number.NaN;
        if (!participant || !Number.isFinite(amount)) {
          return null;
        }
        return { participant, amount: roundCents(amount) };
      })
      .filter((item): item is { participant: string; amount: number } => item !== null);
  } catch {
    return [];
  }
};

const buildOptimizedTransfers = (balances: SettlementBalance[]): SettlementTransfer[] => {
  const creditors = balances
    .filter((entry) => entry.amount > 0.01)
    .map((entry) => ({ ...entry }));
  const debtors = balances
    .filter((entry) => entry.amount < -0.01)
    .map((entry) => ({ memberName: entry.memberName, amount: Math.abs(entry.amount) }));
  const transfers: SettlementTransfer[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = roundCents(Math.min(creditor.amount, debtor.amount));
    if (amount <= 0) {
      break;
    }
    transfers.push({
      fromMember: debtor.memberName,
      toMember: creditor.memberName,
      amount,
    });
    creditor.amount = roundCents(creditor.amount - amount);
    debtor.amount = roundCents(debtor.amount - amount);
    if (creditor.amount <= 0.01) {
      creditorIndex += 1;
    }
    if (debtor.amount <= 0.01) {
      debtorIndex += 1;
    }
  }

  return transfers;
};

const buildSettlementForScope = (
  members: GroupMember[],
  expenses: SettlementExpenseRow[],
  payments: SettlementPayment[],
): { balances: SettlementBalance[]; transfers: SettlementTransfer[]; totalExpenses: number } => {
  const balanceMap = new Map<string, number>();
  const memberByNormalizedName = new Map(
    members.map((member) => [member.name.trim().toLowerCase(), member]),
  );
  members.forEach((member) => {
    balanceMap.set(member.name, 0);
  });
  let totalExpenses = 0;

  expenses.forEach((expense) => {
    const amount = Number(expense.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    totalExpenses = roundCents(totalExpenses + amount);
    const splitDetails = parseExpenseSplitDetails(expense.splitDetails);
    if (splitDetails.length > 0) {
      splitDetails.forEach((share) => {
        const targetMember = memberByNormalizedName.get(share.participant.trim().toLowerCase());
        if (!targetMember) {
          return;
        }
        const previous = balanceMap.get(targetMember.name) ?? 0;
        balanceMap.set(targetMember.name, roundCents(previous - share.amount));
      });
    } else {
      members.forEach((member) => {
        const share = roundCents((amount * member.ratio) / 100);
        const previous = balanceMap.get(member.name) ?? 0;
        balanceMap.set(member.name, roundCents(previous - share));
      });
    }

    if (expense.paidByName) {
      const payer = memberByNormalizedName.get(expense.paidByName.trim().toLowerCase());
      if (payer) {
        const previous = balanceMap.get(payer.name) ?? 0;
        balanceMap.set(payer.name, roundCents(previous + amount));
      }
    }
  });

  payments.forEach((payment) => {
    const fromPrevious = balanceMap.get(payment.fromMember) ?? 0;
    const toPrevious = balanceMap.get(payment.toMember) ?? 0;
    balanceMap.set(payment.fromMember, roundCents(fromPrevious + payment.amount));
    balanceMap.set(payment.toMember, roundCents(toPrevious - payment.amount));
  });

  const balances = Array.from(balanceMap.entries())
    .map(([memberName, amount]) => ({ memberName, amount: roundCents(amount) }))
    .sort((left, right) => right.amount - left.amount);
  const transfers = buildOptimizedTransfers(balances);

  return { balances, transfers, totalExpenses };
};

export const listGroups = async (userEmail: string): Promise<Group[]> => {
  const normalizedEmail = userEmail.trim().toLowerCase();
  const [groupRows] = await db.query<GroupRow[]>(
    `
      SELECT id, name, description
      FROM \`groups\`
      WHERE id IN (
        SELECT group_id
        FROM group_members
        WHERE email = ?
      )
      ORDER BY created_at DESC, id DESC
    `,
    [normalizedEmail],
  );

  if (groupRows.length === 0) {
    return [];
  }

  const [memberRows] = await db.query<GroupMemberRow[]>(
    `
      SELECT group_id AS groupId, name, email, ratio
      FROM group_members
      WHERE group_id IN (?)
      ORDER BY id ASC
    `,
    [groupRows.map((group) => group.id)],
  );

  const membersByGroupId = new Map<number, GroupMember[]>();
  for (const row of memberRows) {
    const existingMembers = membersByGroupId.get(row.groupId) ?? [];
    existingMembers.push({
      name: row.name,
      email: row.email,
      ratio: toNumericRatio(row.ratio),
    });
    membersByGroupId.set(row.groupId, existingMembers);
  }

  const [expenseRows] = await db.query<GroupExpenseRow[]>(
    `
      SELECT
        e.id,
        e.group_id AS groupId,
        e.title,
        e.expense_group AS expenseGroup,
        e.category,
        e.amount,
        e.transaction_date AS transactionDate,
        u.full_name AS paidByName
      FROM expenses e
      LEFT JOIN users u ON u.id = e.paid_by_user_id
      WHERE e.group_id IN (?)
      ORDER BY e.transaction_date DESC, e.id DESC
    `,
    [groupRows.map((group) => group.id)],
  );

  const expensesByGroupId = new Map<number, Group['expenses']>();
  const totalsByGroupId = new Map<number, { totalSpent: number; yourShare: number }>();
  for (const row of expenseRows) {
    const groupMembers = membersByGroupId.get(row.groupId) ?? [];
    const viewerMember = groupMembers.find((member) => member.email.trim().toLowerCase() === normalizedEmail);
    const amount = Number(row.amount);
    const yourShare = viewerMember ? Number(((amount * viewerMember.ratio) / 100).toFixed(2)) : 0;

    const groupExpenses = expensesByGroupId.get(row.groupId) ?? [];
    groupExpenses.push({
      date: toIsoString(row.transactionDate).slice(0, 10),
      expenseGroup: row.expenseGroup ?? row.category,
      category: row.category,
      description: row.title,
      paidBy: row.paidByName ?? 'Member',
      total: amount,
      yourShare,
    });
    expensesByGroupId.set(row.groupId, groupExpenses);

    const runningTotals = totalsByGroupId.get(row.groupId) ?? { totalSpent: 0, yourShare: 0 };
    runningTotals.totalSpent = Number((runningTotals.totalSpent + amount).toFixed(2));
    runningTotals.yourShare = Number((runningTotals.yourShare + yourShare).toFixed(2));
    totalsByGroupId.set(row.groupId, runningTotals);
  }

  return groupRows.map((row) => ({
    ...(totalsByGroupId.get(row.id) ?? { totalSpent: 0, yourShare: 0 }),
    id: String(row.id),
    name: row.name,
    description: row.description ?? undefined,
    members: membersByGroupId.get(row.id) ?? [],
    expenses: expensesByGroupId.get(row.id) ?? [],
  }));
};

export const createGroup = async (input: CreateGroupInput, actorEmail: string): Promise<Group> => {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Group name is required.');
  }

  const members = normalizeMembers(input.members).filter((member) => member.name && member.email);
  if (members.length < 2) {
    throw new Error('A group must include at least two members.');
  }

  const totalRatio = members.reduce((sum, member) => sum + member.ratio, 0);
  if (Math.abs(totalRatio - 100) > 0.01) {
    throw new Error(`Member ratios must add up to 100% (current: ${totalRatio.toFixed(2)}%).`);
  }
  if (members.some((member) => !Number.isFinite(member.ratio) || member.ratio <= 0)) {
    throw new Error('Each member ratio must be greater than 0.');
  }

  const duplicateEmails = new Set<string>();
  for (const member of members) {
    if (duplicateEmails.has(member.email)) {
      throw new Error('Each group member must have a unique email.');
    }
    duplicateEmails.add(member.email);
  }

  const normalizedActorEmail = actorEmail.trim().toLowerCase();
  const actorInMembers = members.some((member) => member.email === normalizedActorEmail);
  if (!actorInMembers) {
    throw new Error('Group creator must be included in members.');
  }

  const connection = await db.getConnection();
  let groupId = 0;
  try {
    await connection.beginTransaction();

    const [insertResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO \`groups\` (name, description)
        VALUES (?, ?)
      `,
      [name, input.description?.trim() || null],
    );

    groupId = insertResult.insertId;

    await Promise.all(
      members.map((member) =>
        connection.execute(
          `
            INSERT INTO group_members (group_id, name, email, ratio)
            VALUES (?, ?, ?, ?)
          `,
          [groupId, member.name, member.email, member.ratio],
        ),
      ),
    );

    const [existingUsers] = await connection.query<RowDataPacket[]>(
      `
        SELECT email
        FROM users
        WHERE email IN (?)
      `,
      [members.map((member) => member.email)],
    );
    const existingUserEmails = new Set(
      existingUsers.map((row) =>
        typeof row.email === 'string' ? row.email.trim().toLowerCase() : '',
      ),
    );

    const pendingInvitationEmails = members
      .map((member) => member.email)
      .filter((email) => !existingUserEmails.has(email));

    if (pendingInvitationEmails.length > 0) {
      await Promise.all(
        pendingInvitationEmails.map((email) =>
          connection.execute(
            `
              INSERT INTO group_invitations (group_id, email, status)
              VALUES (?, ?, 'Pending')
              ON DUPLICATE KEY UPDATE status = VALUES(status), accepted_at = NULL
            `,
            [groupId, email],
          ),
        ),
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return {
    id: String(groupId),
    name,
    description: input.description?.trim() || undefined,
    members,
    totalSpent: 0,
    yourShare: 0,
    expenses: [],
  };
};

export const updateGroup = async (
  input: UpdateGroupInput,
  actor: { userId: string; email: string },
): Promise<Group> => {
  const numericGroupId = Number(input.id);
  if (!Number.isFinite(numericGroupId) || numericGroupId <= 0) {
    throw new Error('Invalid group id.');
  }

  const name = input.name.trim();
  if (!name) {
    throw new Error('Group name is required.');
  }

  const members = normalizeMembers(input.members).filter((member) => member.name && member.email);
  if (members.length < 2) {
    throw new Error('A group must include at least two members.');
  }

  const totalRatio = members.reduce((sum, member) => sum + member.ratio, 0);
  if (Math.abs(totalRatio - 100) > 0.01) {
    throw new Error(`Member ratios must add up to 100% (current: ${totalRatio.toFixed(2)}%).`);
  }
  if (members.some((member) => !Number.isFinite(member.ratio) || member.ratio <= 0)) {
    throw new Error('Each member ratio must be greater than 0.');
  }

  const duplicateEmails = new Set<string>();
  for (const member of members) {
    if (duplicateEmails.has(member.email)) {
      throw new Error('Each group member must have a unique email.');
    }
    duplicateEmails.add(member.email);
  }

  const normalizedActorEmail = actor.email.trim().toLowerCase();
  const [beforeRows] = await db.query<GroupRow[]>(
    `
      SELECT id, name, description
      FROM \`groups\`
      WHERE id = ?
      LIMIT 1
    `,
    [numericGroupId],
  );
  const beforeGroup = beforeRows[0];
  if (!beforeGroup) {
    throw new Error('Group not found.');
  }
  const [beforeMemberRows] = await db.query<GroupMemberRow[]>(
    `
      SELECT group_id AS groupId, name, email, ratio
      FROM group_members
      WHERE group_id = ?
      ORDER BY id ASC
    `,
    [numericGroupId],
  );
  const [membershipRows] = await db.query<RowDataPacket[]>(
    `
      SELECT id
      FROM group_members
      WHERE group_id = ? AND email = ?
      LIMIT 1
    `,
    [numericGroupId, normalizedActorEmail],
  );
  if (membershipRows.length === 0) {
    throw new Error('Not authorized for this group.');
  }

  const actorInMembers = members.some((member) => member.email === normalizedActorEmail);
  if (!actorInMembers) {
    throw new Error('Group editor must remain in members.');
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      `
        UPDATE \`groups\`
        SET name = ?, description = ?
        WHERE id = ?
      `,
      [name, input.description?.trim() || null, numericGroupId],
    );

    await connection.execute(
      `
        DELETE FROM group_members
        WHERE group_id = ?
      `,
      [numericGroupId],
    );

    await Promise.all(
      members.map((member) =>
        connection.execute(
          `
            INSERT INTO group_members (group_id, name, email, ratio)
            VALUES (?, ?, ?, ?)
          `,
          [numericGroupId, member.name, member.email, member.ratio],
        ),
      ),
    );

    const [existingUsers] = await connection.query<RowDataPacket[]>(
      `
        SELECT email
        FROM users
        WHERE email IN (?)
      `,
      [members.map((member) => member.email)],
    );
    const existingUserEmails = new Set(
      existingUsers.map((row) =>
        typeof row.email === 'string' ? row.email.trim().toLowerCase() : '',
      ),
    );

    const pendingInvitationEmails = members
      .map((member) => member.email)
      .filter((email) => !existingUserEmails.has(email));

    if (pendingInvitationEmails.length > 0) {
      await Promise.all(
        pendingInvitationEmails.map((email) =>
          connection.execute(
            `
              INSERT INTO group_invitations (group_id, email, status)
              VALUES (?, ?, 'Pending')
              ON DUPLICATE KEY UPDATE status = VALUES(status), accepted_at = NULL
            `,
            [numericGroupId, email],
          ),
        ),
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const [groupRows] = await db.query<GroupRow[]>(
    `
      SELECT id, name, description
      FROM \`groups\`
      WHERE id = ?
      LIMIT 1
    `,
    [numericGroupId],
  );
  const groupRow = groupRows[0];
  if (!groupRow) {
    throw new Error('Group not found.');
  }

  await logAuditEvent({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    action: 'UPDATE_GROUP',
    entityType: 'group',
    entityId: String(groupRow.id),
    beforeState: {
      id: beforeGroup.id,
      name: beforeGroup.name,
      description: beforeGroup.description,
      members: beforeMemberRows.map((member) => ({
        name: member.name,
        email: member.email,
        ratio: toNumericRatio(member.ratio),
      })),
    },
    afterState: {
      id: groupRow.id,
      name: groupRow.name,
      description: groupRow.description,
      members,
    },
  });

  return {
    id: String(groupRow.id),
    name: groupRow.name,
    description: groupRow.description ?? undefined,
    members,
    totalSpent: 0,
    yourShare: 0,
    expenses: [],
  };
};

export const listInvitations = async (userEmail: string): Promise<GroupInvitation[]> => {
  const normalizedEmail = userEmail.trim().toLowerCase();
  const [rows] = await db.query<GroupInvitationRow[]>(
    `
      SELECT
        gi.id,
        gi.group_id AS groupId,
        g.name AS groupName,
        gi.email,
        gi.status,
        gi.invited_at AS invitedAt,
        gi.accepted_at AS acceptedAt
      FROM group_invitations gi
      INNER JOIN \`groups\` g ON g.id = gi.group_id
      WHERE gi.email = ?
      ORDER BY gi.invited_at DESC, gi.id DESC
    `,
    [normalizedEmail],
  );

  return rows.map((row) => ({
    id: String(row.id),
    groupId: String(row.groupId),
    groupName: row.groupName,
    email: row.email,
    status: row.status === 'Accepted' ? 'Accepted' : 'Pending',
    invitedAt: toIsoString(row.invitedAt),
    acceptedAt: row.acceptedAt ? toIsoString(row.acceptedAt) : undefined,
  }));
};

export const listSplitTemplates = async (groupId: string, userEmail: string): Promise<SplitTemplate[]> => {
  const numericGroupId = Number(groupId);
  if (!Number.isFinite(numericGroupId) || numericGroupId <= 0) {
    throw new Error('Invalid groupId.');
  }

  const isMember = await db.query<RowDataPacket[]>(
    `
      SELECT id
      FROM group_members
      WHERE group_id = ? AND email = ?
      LIMIT 1
    `,
    [numericGroupId, userEmail.trim().toLowerCase()],
  );
  if (isMember[0].length === 0) {
    throw new Error('Not authorized for this group.');
  }

  const [rows] = await db.query<SplitTemplateRow[]>(
    `
      SELECT
        id,
        group_id AS groupId,
        category,
        template_name AS templateName,
        split_details AS splitDetails
      FROM group_split_templates
      WHERE group_id = ?
      ORDER BY category ASC, id ASC
    `,
    [numericGroupId],
  );

  return rows.map((row) => ({
    id: String(row.id),
    groupId: String(row.groupId),
    category: row.category,
    templateName: row.templateName,
    splitDetails: parseTemplateSplitDetails(row.splitDetails),
  }));
};

export const upsertSplitTemplate = async (
  input: UpsertSplitTemplateInput,
  userEmail: string,
): Promise<SplitTemplate> => {
  const numericGroupId = Number(input.groupId);
  if (!Number.isFinite(numericGroupId) || numericGroupId <= 0) {
    throw new Error('Invalid groupId.');
  }

  const normalizedEmail = userEmail.trim().toLowerCase();
  const [membershipRows] = await db.query<RowDataPacket[]>(
    `
      SELECT id
      FROM group_members
      WHERE group_id = ? AND email = ?
      LIMIT 1
    `,
    [numericGroupId, normalizedEmail],
  );
  if (membershipRows.length === 0) {
    throw new Error('Not authorized for this group.');
  }

  const category = input.category.trim();
  const templateName = input.templateName.trim();
  if (!category) {
    throw new Error('Template category is required.');
  }
  if (!templateName) {
    throw new Error('Template name is required.');
  }

  const splitDetails = normalizeTemplateSplitDetails(input.splitDetails);
  const splitDetailsJson = JSON.stringify(splitDetails);

  await db.execute(
    `
      INSERT INTO group_split_templates (group_id, category, template_name, split_details)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        template_name = VALUES(template_name),
        split_details = VALUES(split_details)
    `,
    [numericGroupId, category, templateName, splitDetailsJson],
  );

  const [rows] = await db.query<SplitTemplateRow[]>(
    `
      SELECT
        id,
        group_id AS groupId,
        category,
        template_name AS templateName,
        split_details AS splitDetails
      FROM group_split_templates
      WHERE group_id = ? AND category = ?
      LIMIT 1
    `,
    [numericGroupId, category],
  );
  const row = rows[0];
  if (!row) {
    throw new Error('Failed to upsert split template.');
  }

  return {
    id: String(row.id),
    groupId: String(row.groupId),
    category: row.category,
    templateName: row.templateName,
    splitDetails: parseTemplateSplitDetails(row.splitDetails),
  };
};

export const listHouseholdSettlements = async (userEmail: string): Promise<HouseholdSettlement[]> => {
  const groups = await listGroups(userEmail);
  if (groups.length === 0) {
    return [];
  }

  const groupIds = groups.map((group) => Number(group.id));
  const [expenseRows] = await db.query<SettlementExpenseRow[]>(
    `
      SELECT
        e.id,
        e.group_id AS groupId,
        e.amount,
        e.expense_group AS expenseGroup,
        e.category,
        e.split_details AS splitDetails,
        payer.full_name AS paidByName
      FROM expenses e
      LEFT JOIN users payer ON payer.id = e.paid_by_user_id
      WHERE e.group_id IN (?)
      ORDER BY e.transaction_date DESC, e.id DESC
    `,
    [groupIds],
  );
  const [paymentRows] = await db.query<SettlementPaymentRow[]>(
    `
      SELECT
        id,
        group_id AS groupId,
        expense_group AS expenseGroup,
        from_member AS fromMember,
        to_member AS toMember,
        amount,
        note,
        settled_at AS settledAt
      FROM settlement_payments
      WHERE group_id IN (?)
      ORDER BY settled_at DESC, id DESC
    `,
    [groupIds],
  );

  const expensesByGroupId = new Map<number, SettlementExpenseRow[]>();
  expenseRows.forEach((row) => {
    const existing = expensesByGroupId.get(row.groupId) ?? [];
    existing.push(row);
    expensesByGroupId.set(row.groupId, existing);
  });
  const paymentsByGroupId = new Map<number, SettlementPayment[]>();
  paymentRows.forEach((row) => {
    const existing = paymentsByGroupId.get(row.groupId) ?? [];
    existing.push({
      id: String(row.id),
      groupId: String(row.groupId),
      expenseGroup: row.expenseGroup ?? undefined,
      fromMember: row.fromMember,
      toMember: row.toMember,
      amount: Number(row.amount),
      note: row.note ?? undefined,
      settledAt: toIsoString(row.settledAt).slice(0, 10),
    });
    paymentsByGroupId.set(row.groupId, existing);
  });

  return groups.map((group) => {
    const numericGroupId = Number(group.id);
    const groupExpenses = expensesByGroupId.get(numericGroupId) ?? [];
    const groupPayments = paymentsByGroupId.get(numericGroupId) ?? [];
    const householdComputed = buildSettlementForScope(
      group.members,
      groupExpenses,
      groupPayments.filter((payment) => !payment.expenseGroup),
    );
    const expenseGroupNames = new Set(
      groupExpenses.map((expense) => (expense.expenseGroup ?? expense.category).trim()).filter(Boolean),
    );
    const expenseGroups: ExpenseGroupSettlement[] = Array.from(expenseGroupNames)
      .sort((left, right) => left.localeCompare(right))
      .map((expenseGroupName) => {
        const scopedExpenses = groupExpenses.filter(
          (expense) => (expense.expenseGroup ?? expense.category).trim().toLowerCase() === expenseGroupName.toLowerCase(),
        );
        const scopedPayments = groupPayments.filter(
          (payment) => payment.expenseGroup?.trim().toLowerCase() === expenseGroupName.toLowerCase(),
        );
        const computed = buildSettlementForScope(group.members, scopedExpenses, scopedPayments);
        return {
          expenseGroup: expenseGroupName,
          totalExpenses: computed.totalExpenses,
          balances: computed.balances,
          transfers: computed.transfers,
        };
      });

    return {
      groupId: group.id,
      groupName: group.name,
      balances: householdComputed.balances,
      transfers: householdComputed.transfers,
      expenseGroups,
      payments: groupPayments,
    };
  });
};

export const recordSettlementPayment = async (
  input: RecordSettlementPaymentInput,
  userEmail: string,
): Promise<SettlementPayment> => {
  const groupId = Number(input.groupId);
  if (!Number.isFinite(groupId) || groupId <= 0) {
    throw new Error('Invalid groupId.');
  }
  const normalizedEmail = userEmail.trim().toLowerCase();
  const [membershipRows] = await db.query<RowDataPacket[]>(
    `
      SELECT id
      FROM group_members
      WHERE group_id = ? AND email = ?
      LIMIT 1
    `,
    [groupId, normalizedEmail],
  );
  if (membershipRows.length === 0) {
    throw new Error('Not authorized for this group.');
  }

  const fromMember = input.fromMember.trim();
  const toMember = input.toMember.trim();
  const amount = Number(input.amount);
  const settledAt = input.settledAt.trim();
  if (!fromMember || !toMember || fromMember.toLowerCase() === toMember.toLowerCase()) {
    throw new Error('Provide valid payer and recipient members.');
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Settlement amount must be greater than 0.');
  }
  if (!settledAt) {
    throw new Error('Settlement date is required.');
  }

  const [result] = await db.execute<ResultSetHeader>(
    `
      INSERT INTO settlement_payments (
        group_id, expense_group, from_member, to_member, amount, note, settled_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      groupId,
      input.expenseGroup?.trim() || null,
      fromMember,
      toMember,
      roundCents(amount),
      input.note?.trim() || null,
      settledAt,
    ],
  );
  const [rows] = await db.query<SettlementPaymentRow[]>(
    `
      SELECT
        id,
        group_id AS groupId,
        expense_group AS expenseGroup,
        from_member AS fromMember,
        to_member AS toMember,
        amount,
        note,
        settled_at AS settledAt
      FROM settlement_payments
      WHERE id = ?
      LIMIT 1
    `,
    [result.insertId],
  );
  const row = rows[0];
  if (!row) {
    throw new Error('Unable to record settlement payment.');
  }
  return {
    id: String(row.id),
    groupId: String(row.groupId),
    expenseGroup: row.expenseGroup ?? undefined,
    fromMember: row.fromMember,
    toMember: row.toMember,
    amount: Number(row.amount),
    note: row.note ?? undefined,
    settledAt: toIsoString(row.settledAt).slice(0, 10),
  };
};
