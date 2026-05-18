import type { RowDataPacket } from 'mysql2';
import { db } from '../../db/mysql.js';
import { GROUP_CORE_COLUMNS, GROUP_MEMBER_COLUMNS } from '../../db/sqlColumns.js';
import {
  type GroupViewer,
  groupMemberMatchesViewerClause,
  groupMemberMatchesViewerParams,
} from './memberIdentity.js';
import type { GroupMember } from './types.js';

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
  userId: number | null;
} & RowDataPacket;

const toNumericRatio = (value: number | string): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const mapGroupMemberRow = (row: GroupMemberRow): GroupMember => ({
  userId: row.userId !== null && row.userId !== undefined ? String(row.userId) : undefined,
  name: row.name,
  email: row.email,
  ratio: toNumericRatio(row.ratio),
});

export type AccessibleGroupWithMembers = {
  id: number;
  name: string;
  description: string | null;
  members: GroupMember[];
};

export const loadAccessibleGroupsWithMembers = async (
  viewer: GroupViewer,
): Promise<AccessibleGroupWithMembers[]> => {
  const [groupRows] = await db.query<GroupRow[]>(
    `
      SELECT ${GROUP_CORE_COLUMNS}
      FROM \`groups\`
      WHERE id IN (
        SELECT gm.group_id
        FROM group_members gm
        LEFT JOIN group_invitations gi
          ON gi.group_id = gm.group_id AND gi.email = gm.email
        WHERE ${groupMemberMatchesViewerClause('gm')}
          AND (gi.id IS NULL OR gi.status = 'Accepted')
      )
      ORDER BY created_at DESC, id DESC
    `,
    groupMemberMatchesViewerParams(viewer),
  );

  if (groupRows.length === 0) {
    return [];
  }

  const [memberRows] = await db.query<GroupMemberRow[]>(
    `
      SELECT ${GROUP_MEMBER_COLUMNS}
      FROM group_members
      WHERE group_id IN (?)
      ORDER BY id ASC
    `,
    [groupRows.map((group) => group.id)],
  );

  const membersByGroupId = new Map<number, GroupMember[]>();
  for (const row of memberRows) {
    const existingMembers = membersByGroupId.get(row.groupId) ?? [];
    existingMembers.push(mapGroupMemberRow(row));
    membersByGroupId.set(row.groupId, existingMembers);
  }

  return groupRows.map((group) => ({
    id: group.id,
    name: group.name,
    description: group.description,
    members: membersByGroupId.get(group.id) ?? [],
  }));
};
