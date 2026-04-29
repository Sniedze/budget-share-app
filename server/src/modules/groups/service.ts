import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db } from '../../db/mysql.js';
import type {
  CreateGroupInput,
  Group,
  GroupInvitation,
  GroupMember,
  SplitTemplate,
  UpdateGroupInput,
  UpsertSplitTemplateInput,
} from './types.js';

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

export const updateGroup = async (input: UpdateGroupInput, actorEmail: string): Promise<Group> => {
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

  const normalizedActorEmail = actorEmail.trim().toLowerCase();
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
