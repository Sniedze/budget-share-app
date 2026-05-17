/** Shared SQL column lists — keep SELECT projections consistent across modules. */

export const EXPENSE_SELECT_COLUMNS = `
  id,
  title,
  amount,
  currency,
  created_at,
  transaction_date,
  category,
  expense_group,
  split_type,
  split_details,
  group_id,
  created_by_user_id,
  paid_by_user_id,
  transaction_dedup_hash,
  is_private,
  expense_flow
`.trim();

export const GROUP_CORE_COLUMNS = 'id, name, description';

export const GROUP_MEMBER_COLUMNS = 'group_id AS groupId, name, email, ratio, user_id AS userId';

export const GROUP_LIST_EXPENSE_COLUMNS = `
  e.id,
  e.group_id AS groupId,
  e.title,
  e.expense_group AS expenseGroup,
  e.category,
  e.amount,
  e.currency,
  e.split_type AS splitType,
  e.split_details AS splitDetails,
  e.transaction_date AS transactionDate,
  u.full_name AS paidByName,
  COALESCE(e.is_private, 0) AS isPrivate,
  e.created_by_user_id AS createdByUserId
`.trim();

export const SETTLEMENT_EXPENSE_COLUMNS = `
  e.id,
  e.group_id AS groupId,
  e.amount,
  e.currency,
  e.expense_group AS expenseGroup,
  e.category,
  e.split_type AS splitType,
  e.split_details AS splitDetails,
  payer.full_name AS paidByName
`.trim();

export const PENDING_GROUP_INVITATION_COLUMNS = `
  gi.group_id AS groupId,
  gi.email,
  gm.name,
  gi.status,
  gi.email_delivery_status AS emailDeliveryStatus
`.trim();
