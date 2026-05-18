import type { RowDataPacket } from 'mysql2/promise';
import { db } from '../../db/mysql.js';
import { isMissingTableError } from './groupDbErrors.js';
import { parseTemplateSplitRatios } from './splitDetailsParse.js';

type SplitTemplateRow = {
  id: number;
  groupId: number;
  category: string;
  templateName: string;
  splitDetails: string | Array<{ participant: string; ratio: number }>;
} & RowDataPacket;

export const readExpenseGroupLabel = (expense: {
  expenseGroup: string | null;
  category: string | null;
}): string => (expense.expenseGroup ?? expense.category ?? 'General').trim() || 'General';

export const listExpenseGroupLabelsByGroupId = async (
  groupIds: number[],
): Promise<Map<number, string[]>> => {
  const map = new Map<number, string[]>();
  if (groupIds.length === 0) {
    return map;
  }
  let rows: Array<{ groupId: number; category: string } & RowDataPacket> = [];
  try {
    const [templateRows] = await db.query<Array<{ groupId: number; category: string } & RowDataPacket>>(
      `
      SELECT group_id AS groupId, category
      FROM group_split_templates
      WHERE group_id IN (?)
    `,
      [groupIds],
    );
    rows = templateRows;
  } catch (error) {
    if (!isMissingTableError(error, 'group_split_templates')) {
      throw error;
    }
  }
  for (const row of rows) {
    const cat = row.category?.trim();
    if (!cat) {
      continue;
    }
    const list = map.get(row.groupId) ?? [];
    if (!list.some((existing) => existing.toLowerCase() === cat.toLowerCase())) {
      list.push(cat);
    }
    map.set(row.groupId, list);
  }
  for (const [, list] of map) {
    list.sort((left, right) => left.localeCompare(right));
  }
  return map;
};

export const listTemplateSplitDetailsByGroupAndCategory = async (
  groupIds: number[],
): Promise<Map<string, Array<{ participant: string; ratio: number }>>> => {
  const map = new Map<string, Array<{ participant: string; ratio: number }>>();
  if (groupIds.length === 0) {
    return map;
  }

  let rows: SplitTemplateRow[] = [];
  try {
    const [templateRows] = await db.query<SplitTemplateRow[]>(
      `
      SELECT
        id,
        group_id AS groupId,
        category,
        template_name AS templateName,
        split_details AS splitDetails
      FROM group_split_templates
      WHERE group_id IN (?)
    `,
      [groupIds],
    );
    rows = templateRows;
  } catch (error) {
    if (!isMissingTableError(error, 'group_split_templates')) {
      throw error;
    }
  }

  for (const row of rows) {
    const categoryKey = row.category.trim().toLowerCase();
    if (!categoryKey) {
      continue;
    }
    map.set(`${row.groupId}:${categoryKey}`, parseTemplateSplitRatios(row.splitDetails));
  }

  return map;
};
