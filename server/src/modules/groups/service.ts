import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db } from '../../db/mysql.js';
import type { CreateGroupInput, Group, GroupMember } from './types.js';

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

export const listGroups = async (): Promise<Group[]> => {
  const [groupRows] = await db.query<GroupRow[]>(`
      SELECT id, name, description
      FROM groups
      ORDER BY created_at DESC, id DESC
    `);

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

  return groupRows.map((row) => ({
    id: String(row.id),
    name: row.name,
    description: row.description ?? undefined,
    members: membersByGroupId.get(row.id) ?? [],
    totalSpent: 0,
    yourShare: 0,
    expenses: [],
  }));
};

export const createGroup = async (input: CreateGroupInput): Promise<Group> => {
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

  const connection = await db.getConnection();
  let groupId = 0;
  try {
    await connection.beginTransaction();

    const [insertResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO groups (name, description)
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
