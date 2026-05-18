import { escapeSqlLikePattern } from '../../lib/sqlLike.js';
import { EXPENSE_SELECT_COLUMNS } from './mapExpenseRow.js';
import type { ExpenseViewerProfile } from '../groups/expenseVisibility.js';

export type ListExpensesSql = {
  sql: string;
  params: unknown[];
};

/**
 * Returns expenses the viewer may see. Group-level expense-group rules are applied after fetch.
 */
export const buildListExpensesSql = (
  userId: string,
  viewer: ExpenseViewerProfile,
  memberGroupIds: Set<number>,
): ListExpensesSql => {
  const numericUserId = Number(userId);
  const conditions: string[] = ['(group_id IS NULL AND created_by_user_id = ?)'];
  const params: unknown[] = [numericUserId];

  const customMatchParts = ['(group_id IS NULL AND split_type = ? AND created_by_user_id = ?)'];
  const customParams: unknown[] = ['Custom', numericUserId];

  const nameKey = viewer.fullName.trim().toLowerCase();
  if (nameKey.length > 0) {
    customMatchParts.push(
      `(group_id IS NULL AND split_type = ? AND LOWER(CAST(split_details AS CHAR)) LIKE ? ESCAPE '\\\\')`,
    );
    customParams.push('Custom', `%${escapeSqlLikePattern(nameKey)}%`);
  }

  const emailKey = viewer.email.trim().toLowerCase();
  if (emailKey.length > 0 && emailKey !== nameKey) {
    customMatchParts.push(
      `(group_id IS NULL AND split_type = ? AND LOWER(CAST(split_details AS CHAR)) LIKE ? ESCAPE '\\\\')`,
    );
    customParams.push('Custom', `%${escapeSqlLikePattern(emailKey)}%`);
  }

  conditions.push(`(${customMatchParts.join(' OR ')})`);
  params.push(...customParams);

  const groupIds = [...memberGroupIds];
  if (groupIds.length > 0) {
    conditions.push(
      '(group_id IN (?) AND (COALESCE(is_private, 0) = 0 OR created_by_user_id = ?))',
    );
    params.push(groupIds, numericUserId);
  }

  return {
    sql: `
      SELECT ${EXPENSE_SELECT_COLUMNS}
      FROM expenses
      WHERE NOT (created_by_user_id IS NULL AND group_id IS NULL)
        AND (${conditions.join(' OR ')})
      ORDER BY transaction_date DESC, id DESC
    `,
    params,
  };
};
