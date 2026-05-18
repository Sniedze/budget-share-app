import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db } from '../../db/mysql.js';
import { SETTLEMENT_EXPENSE_COLUMNS } from '../../db/sqlColumns.js';
import { normalizeExpenseCurrency } from '../../lib/currency.js';
import { appError, ErrorCode } from '../../graphql/appError.js';
import { roundCents } from '../../lib/money.js';
import { assertActiveGroupMembership } from './invitations.js';
import {
  type GroupViewer,
  findViewerGroupMember,
} from './memberIdentity.js';
import { resolveSettlementMemberName } from './settlementMemberResolution.js';
import { buildOptimizedTransfers } from './settlementTransfers.js';
import { parseSettlementPeriod, settlementPeriodRange } from './settlementPeriod.js';
import {
  loadExpenseViewerProfile,
  PERSONAL_CUSTOM_SETTLEMENT_GROUP_ID,
  viewerParticipatesInCustomSplit,
  expenseGroupTemplateLookupKey,
  viewerParticipatesInExpenseGroup,
} from './expenseVisibility.js';
import { parseExpenseSettlementAmounts } from './splitDetailsParse.js';
import { isMissingTableError } from './groupDbErrors.js';
import { loadAccessibleGroupsWithMembers } from './groupMembership.js';
import {
  listExpenseGroupLabelsByGroupId,
  listTemplateSplitDetailsByGroupAndCategory,
  readExpenseGroupLabel,
} from './groupSplitTemplates.js';
import type {
  CurrencySettlementScope,
  ExpenseGroupSettlement,
  GroupMember,
  HouseholdSettlement,
  RecordSettlementPaymentInput,
  RecordSettlementPaymentResult,
  SettlementBalance,
  SettlementPayment,
  SettlementTransfer,
} from './types.js';

type SettlementExpenseRow = {
  id: number;
  groupId: number;
  amount: string;
  currency: string | null;
  expenseGroup: string | null;
  category: string | null;
  splitType: string | null;
  splitDetails: string | null;
  isPrivate: number;
  createdByUserId: number | null;
  paidByUserId: number | null;
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

const toSafeGraphqlFloat = (value: number): number => {
  const rounded = roundCents(value);
  return Number.isFinite(rounded) ? rounded : 0;
};

const toSettlementDateString = (value: Date | string | null | undefined): string => {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
};

const resolveExpenseSettlementShares = (
  expense: SettlementExpenseRow,
  members: GroupMember[],
  templateSplitByKey: Map<string, Array<{ participant: string; ratio: number }>>,
): Array<{ participant: string; amount: number }> => {
  const amount = Number(expense.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return [];
  }

  const splitDetails = parseExpenseSettlementAmounts(expense.splitDetails as unknown, amount);
  const expenseGroupKey = readExpenseGroupLabel(expense).toLowerCase();
  const templateSplit = templateSplitByKey.get(`${expense.groupId}:${expenseGroupKey}`) ?? [];

  if (expense.splitType === 'Custom' && splitDetails.length > 0) {
    return splitDetails;
  }
  if (templateSplit.length > 0) {
    return templateSplit.map((allocation) => ({
      participant: allocation.participant,
      amount: roundCents((amount * allocation.ratio) / 100),
    }));
  }
  if (splitDetails.length > 0) {
    return splitDetails;
  }
  return members.map((member) => ({
    participant: member.name,
    amount: roundCents((amount * member.ratio) / 100),
  }));
};

const buildSettlementForScope = (
  members: GroupMember[],
  expenses: SettlementExpenseRow[],
  payments: SettlementPayment[],
  templateSplitByKey: Map<string, Array<{ participant: string; ratio: number }>>,
): { balances: SettlementBalance[]; transfers: SettlementTransfer[]; totalExpenses: number } => {
  const balanceMap = new Map<string, number>();
  members.forEach((member) => {
    balanceMap.set(member.name, 0);
  });
  let totalExpenses = 0;

  const resolveBalanceMemberName = (memberName: string): string | undefined =>
    resolveSettlementMemberName(memberName, members);

  const resolvePayerMemberName = (expense: SettlementExpenseRow): string | undefined => {
    if (expense.paidByUserId !== null && expense.paidByUserId !== undefined) {
      const payerId = String(expense.paidByUserId);
      const memberByUserId = members.find((member) => member.userId === payerId);
      if (memberByUserId) {
        return memberByUserId.name;
      }
    }
    if (expense.paidByName) {
      return resolveBalanceMemberName(expense.paidByName);
    }
    return undefined;
  };

  expenses.forEach((expense) => {
    const amount = Number(expense.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    totalExpenses = roundCents(totalExpenses + amount);
    const shares = resolveExpenseSettlementShares(expense, members, templateSplitByKey);
    shares.forEach((share) => {
      const balanceMemberName = resolveBalanceMemberName(share.participant);
      if (!balanceMemberName) {
        return;
      }
      const previous = balanceMap.get(balanceMemberName) ?? 0;
      balanceMap.set(balanceMemberName, roundCents(previous - share.amount));
    });

    const payerName = resolvePayerMemberName(expense);
    if (payerName) {
      const previous = balanceMap.get(payerName) ?? 0;
      balanceMap.set(payerName, roundCents(previous + amount));
    }
  });

  payments.forEach((payment) => {
    const paymentAmount = toSafeGraphqlFloat(Number(payment.amount));
    const fromMemberName = resolveBalanceMemberName(payment.fromMember);
    const toMemberName = resolveBalanceMemberName(payment.toMember);
    if (!fromMemberName || !toMemberName) {
      return;
    }
    const fromPrevious = balanceMap.get(fromMemberName) ?? 0;
    const toPrevious = balanceMap.get(toMemberName) ?? 0;
    balanceMap.set(fromMemberName, roundCents(fromPrevious + paymentAmount));
    balanceMap.set(toMemberName, roundCents(toPrevious - paymentAmount));
  });

  const balances = Array.from(balanceMap.entries())
    .map(([memberName, balanceAmount]) => ({
      memberName,
      amount: toSafeGraphqlFloat(balanceAmount),
    }))
    .sort((left, right) => right.amount - left.amount);
  const transfers = buildOptimizedTransfers(balances).map((transfer) => ({
    fromMember: transfer.fromMember,
    toMember: transfer.toMember,
    amount: toSafeGraphqlFloat(transfer.amount),
  }));

  return { balances, transfers, totalExpenses: toSafeGraphqlFloat(totalExpenses) };
};

const expenseRowIsPrivate = (row: { isPrivate?: number }): boolean => row.isPrivate === 1;

const listSettlementPaymentRows = async (
  groupIds: number[],
  periodStartIso?: string,
): Promise<SettlementPaymentRow[]> => {
  if (groupIds.length === 0) {
    return [];
  }
  try {
    const periodFilter = periodStartIso ? 'AND settled_at >= ?' : '';
    const params: Array<number[] | string> = [groupIds];
    if (periodStartIso) {
      params.push(periodStartIso);
    }
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
        ${periodFilter}
      ORDER BY settled_at DESC, id DESC
    `,
      params,
    );
    return paymentRows;
  } catch (error) {
    if (isMissingTableError(error, 'settlement_payments')) {
      return [];
    }
    throw error;
  }
};

type SanitizedSettlementScope = {
  balances: SettlementBalance[];
  transfers: SettlementTransfer[];
  totalExpenses: number;
};

const sanitizeSettlementScope = (computed: {
  balances: SettlementBalance[];
  transfers: SettlementTransfer[];
  totalExpenses: number;
}): SanitizedSettlementScope => ({
  totalExpenses: toSafeGraphqlFloat(computed.totalExpenses),
  balances: computed.balances.map((balance) => ({
    memberName: balance.memberName,
    amount: toSafeGraphqlFloat(balance.amount),
  })),
  transfers: computed.transfers.map((transfer) => ({
    fromMember: transfer.fromMember,
    toMember: transfer.toMember,
    amount: toSafeGraphqlFloat(transfer.amount),
  })),
});

const buildExpenseGroupSettlements = (
  members: GroupMember[],
  groupExpenses: SettlementExpenseRow[],
  groupPayments: SettlementPayment[],
  templateSplitByKey: Awaited<ReturnType<typeof listTemplateSplitDetailsByGroupAndCategory>>,
): ExpenseGroupSettlement[] => {
  const expenseGroupNames = new Set(groupExpenses.map((expense) => readExpenseGroupLabel(expense)));
  return Array.from(expenseGroupNames)
    .sort((left, right) => left.localeCompare(right))
    .map((expenseGroupName) => {
      const scopedExpenses = groupExpenses.filter(
        (expense) => readExpenseGroupLabel(expense).toLowerCase() === expenseGroupName.toLowerCase(),
      );
      const scopedPayments = groupPayments.filter(
        (payment) => payment.expenseGroup?.trim().toLowerCase() === expenseGroupName.toLowerCase(),
      );
      const computed = sanitizeSettlementScope(
        buildSettlementForScope(members, scopedExpenses, scopedPayments, templateSplitByKey),
      );
      return {
        expenseGroup: expenseGroupName,
        totalExpenses: computed.totalExpenses,
        balances: computed.balances,
        transfers: computed.transfers,
      };
    });
};

const buildCurrencySettlementScope = (
  currency: string,
  members: GroupMember[],
  groupExpenses: SettlementExpenseRow[],
  groupPayments: SettlementPayment[],
  templateSplitByKey: Awaited<ReturnType<typeof listTemplateSplitDetailsByGroupAndCategory>>,
): CurrencySettlementScope => {
  const householdComputed = sanitizeSettlementScope(
    buildSettlementForScope(members, groupExpenses, groupPayments, templateSplitByKey),
  );
  return {
    currency,
    totalExpenses: householdComputed.totalExpenses,
    balances: householdComputed.balances,
    transfers: householdComputed.transfers,
    expenseGroups: buildExpenseGroupSettlements(members, groupExpenses, groupPayments, templateSplitByKey),
  };
};

const groupSettlementExpensesByCurrency = (
  expenses: SettlementExpenseRow[],
): Map<string, SettlementExpenseRow[]> => {
  const byCurrency = new Map<string, SettlementExpenseRow[]>();
  for (const expense of expenses) {
    const currency = normalizeExpenseCurrency(expense.currency);
    const bucket = byCurrency.get(currency) ?? [];
    bucket.push(expense);
    byCurrency.set(currency, bucket);
  }
  return byCurrency;
};

const normalizeYouParticipantInSplitDetails = (
  splitDetailsJson: string | null,
  creatorDisplayName: string | null,
): string | null => {
  if (!splitDetailsJson?.trim() || !creatorDisplayName?.trim()) {
    return splitDetailsJson;
  }
  try {
    const raw = JSON.parse(splitDetailsJson) as Array<{ participant?: string }>;
    if (!Array.isArray(raw)) {
      return splitDetailsJson;
    }
    const normalized = raw.map((entry) => {
      const participant = typeof entry.participant === 'string' ? entry.participant : '';
      return {
        ...entry,
        participant:
          participant.trim().toLowerCase() === 'you' ? creatorDisplayName.trim() : participant,
      };
    });
    return JSON.stringify(normalized);
  } catch {
    return splitDetailsJson;
  }
};

const loadCreatorDisplayNames = async (userIds: number[]): Promise<Map<number, string>> => {
  const map = new Map<number, string>();
  if (userIds.length === 0) {
    return map;
  }
  const [rows] = await db.query<Array<{ id: number; full_name: string } & RowDataPacket>>(
    'SELECT id, full_name FROM users WHERE id IN (?)',
    [userIds],
  );
  for (const row of rows) {
    const name = row.full_name?.trim();
    if (name) {
      map.set(row.id, name);
    }
  }
  return map;
};

const buildPersonalCustomSplitSettlement = async (
  viewer: GroupViewer,
  periodStartIso: string,
): Promise<HouseholdSettlement | null> => {
  const viewerProfile = await loadExpenseViewerProfile(viewer.userId, viewer.email);
  const [rows] = await db.query<SettlementExpenseRow[]>(
    `
      SELECT
        ${SETTLEMENT_EXPENSE_COLUMNS}
      FROM expenses e
      LEFT JOIN users payer ON payer.id = e.paid_by_user_id
      WHERE e.group_id IS NULL
        AND e.split_type = 'Custom'
        AND COALESCE(e.is_private, 0) = 0
        AND COALESCE(e.expense_flow, 'Outgoing') = 'Outgoing'
        AND e.transaction_date >= ?
      ORDER BY e.transaction_date DESC, e.id DESC
    `,
    [periodStartIso],
  );

  const candidateRows = rows.filter(
    (row) =>
      !expenseRowIsPrivate(row) &&
      viewerParticipatesInCustomSplit(
        typeof row.splitDetails === 'string' ? row.splitDetails : null,
        Number(row.amount),
        viewerProfile,
        row.createdByUserId,
      ),
  );
  if (candidateRows.length === 0) {
    return null;
  }

  const creatorIds = [
    ...new Set(
      candidateRows
        .map((row) => row.createdByUserId)
        .filter((id): id is number => id !== null && Number.isFinite(id)),
    ),
  ];
  const creatorNamesById = await loadCreatorDisplayNames(creatorIds);

  const visibleExpenses: SettlementExpenseRow[] = candidateRows.map((row) => {
    const creatorName =
      row.createdByUserId !== null ? creatorNamesById.get(row.createdByUserId) ?? null : null;
    return {
      ...row,
      groupId: 0,
      splitType: 'Custom',
      splitDetails: normalizeYouParticipantInSplitDetails(row.splitDetails, creatorName),
    };
  });

  const participantNames = new Set<string>();
  for (const expense of visibleExpenses) {
    const shares = parseExpenseSettlementAmounts(expense.splitDetails as unknown, Number(expense.amount));
    shares.forEach((share) => {
      const name = share.participant.trim();
      if (name) {
        participantNames.add(name);
      }
    });
    if (expense.paidByName?.trim()) {
      participantNames.add(expense.paidByName.trim());
    }
  }

  const members: GroupMember[] = Array.from(participantNames)
    .sort((left, right) => left.localeCompare(right))
    .map((name) => ({
      name,
      email: '',
      ratio: 0,
    }));

  const templateSplitByKey = new Map<string, Array<{ participant: string; ratio: number }>>();
  const payments: SettlementPayment[] = [];
  const byCurrency = groupSettlementExpensesByCurrency(visibleExpenses);
  const currencies = Array.from(byCurrency.keys()).sort();
  const currencyScopes = currencies.map((currency) =>
    buildCurrencySettlementScope(
      currency,
      members,
      byCurrency.get(currency) ?? [],
      payments,
      templateSplitByKey,
    ),
  );
  const primary = currencyScopes[0];

  return {
    groupId: PERSONAL_CUSTOM_SETTLEMENT_GROUP_ID,
    groupName: 'Personal custom splits',
    balances: primary?.balances ?? [],
    transfers: primary?.transfers ?? [],
    expenseGroups: primary?.expenseGroups ?? [],
    payments,
    mixedCurrencyWarning: currencies.length > 1,
    currencyScopes,
  };
};

const listHouseholdSettlementsImpl = async (
  viewer: GroupViewer,
  periodInput?: unknown,
  filterGroupId?: number,
): Promise<HouseholdSettlement[]> => {
  const period = parseSettlementPeriod(periodInput);
  const { startIso: periodStartIso } = settlementPeriodRange(period);
  let groups = await loadAccessibleGroupsWithMembers(viewer);
  if (filterGroupId !== undefined) {
    groups = groups.filter((group) => group.id === filterGroupId);
  }

  const householdSettlements: HouseholdSettlement[] = [];
  const groupIds = groups.map((group) => group.id);
  if (groupIds.length > 0) {
    const templateSplitByKey = await listTemplateSplitDetailsByGroupAndCategory(groupIds);
    const [expenseRows] = await db.query<SettlementExpenseRow[]>(
      `
      SELECT
        ${SETTLEMENT_EXPENSE_COLUMNS}
      FROM expenses e
      LEFT JOIN users payer ON payer.id = e.paid_by_user_id
      WHERE e.group_id IN (?)
        AND COALESCE(e.expense_flow, 'Outgoing') = 'Outgoing'
        AND e.transaction_date >= ?
      ORDER BY e.transaction_date DESC, e.id DESC
    `,
      [groupIds, periodStartIso],
    );
    const paymentRows = await listSettlementPaymentRows(groupIds, periodStartIso);

    const expensesByGroupId = new Map<number, SettlementExpenseRow[]>();
    for (const row of expenseRows) {
      if (expenseRowIsPrivate(row)) {
        continue;
      }
      const group = groups.find((entry) => entry.id === row.groupId);
      const viewerMember = group ? findViewerGroupMember(group.members, viewer) : undefined;
      if (!viewerMember) {
        continue;
      }
      const templateSplit =
        templateSplitByKey.get(
          expenseGroupTemplateLookupKey(row.groupId, row.expenseGroup, row.category),
        ) ?? [];
      if (
        !viewerParticipatesInExpenseGroup(
          viewerMember.name,
          row.splitType ?? 'Shared',
          typeof row.splitDetails === 'string' ? row.splitDetails : null,
          templateSplit,
          Number(row.amount),
        )
      ) {
        continue;
      }
      const existing = expensesByGroupId.get(row.groupId) ?? [];
      existing.push(row);
      expensesByGroupId.set(row.groupId, existing);
    }
    const paymentsByGroupId = new Map<number, SettlementPayment[]>();
    paymentRows.forEach((row) => {
      const existing = paymentsByGroupId.get(row.groupId) ?? [];
      existing.push({
        id: String(row.id),
        groupId: String(row.groupId),
        expenseGroup: row.expenseGroup ?? undefined,
        fromMember: row.fromMember,
        toMember: row.toMember,
        amount: toSafeGraphqlFloat(Number(row.amount)),
        note: row.note ?? undefined,
        settledAt:
          toSettlementDateString(row.settledAt) || new Date().toISOString().slice(0, 10),
      });
      paymentsByGroupId.set(row.groupId, existing);
    });

    householdSettlements.push(
      ...groups.map((group) => {
        const groupExpenses = expensesByGroupId.get(group.id) ?? [];
        const groupPayments = paymentsByGroupId.get(group.id) ?? [];
        const byCurrency = groupSettlementExpensesByCurrency(groupExpenses);
        const currencies = Array.from(byCurrency.keys()).sort();
        const currencyScopes = currencies.map((currency) =>
          buildCurrencySettlementScope(
            currency,
            group.members,
            byCurrency.get(currency) ?? [],
            groupPayments,
            templateSplitByKey,
          ),
        );
        const primary = currencyScopes[0];

        return {
          groupId: String(group.id),
          groupName: group.name,
          balances: primary?.balances ?? [],
          transfers: primary?.transfers ?? [],
          expenseGroups: primary?.expenseGroups ?? [],
          payments: groupPayments,
          mixedCurrencyWarning: currencies.length > 1,
          currencyScopes,
        };
      }),
    );
  }

  if (filterGroupId === undefined) {
    const customSettlement = await buildPersonalCustomSplitSettlement(viewer, periodStartIso);
    if (customSettlement) {
      householdSettlements.push(customSettlement);
    }
  }

  return householdSettlements;
};

export const listHouseholdSettlements = async (
  viewer: GroupViewer,
  periodInput?: unknown,
): Promise<HouseholdSettlement[]> => {
  try {
    return await listHouseholdSettlementsImpl(viewer, periodInput);
  } catch (error) {
    console.error('[listHouseholdSettlements]', error);
    throw error;
  }
};

export const getHouseholdSettlement = async (
  viewer: GroupViewer,
  groupId: string,
  periodInput?: unknown,
): Promise<HouseholdSettlement | null> => {
  const numericGroupId = Number(groupId);
  if (!Number.isFinite(numericGroupId) || numericGroupId <= 0) {
    return null;
  }
  const settlements = await listHouseholdSettlementsImpl(viewer, periodInput, numericGroupId);
  return settlements[0] ?? null;
};

export const recordSettlementPayment = async (
  input: RecordSettlementPaymentInput,
  viewer: GroupViewer,
  periodInput?: unknown,
): Promise<RecordSettlementPaymentResult> => {
  if (input.groupId === PERSONAL_CUSTOM_SETTLEMENT_GROUP_ID) {
    throw appError(
      ErrorCode.BAD_USER_INPUT,
      'Recording payments for personal custom splits is not supported yet.',
    );
  }
  const groupId = Number(input.groupId);
  if (!Number.isFinite(groupId) || groupId <= 0) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Invalid groupId.');
  }
  await assertActiveGroupMembership(groupId, viewer, 'recordSettlementPayment');

  const fromMemberRaw = input.fromMember.trim();
  const toMemberRaw = input.toMember.trim();
  const amount = Number(input.amount);
  const settledAt = input.settledAt.trim();
  if (!fromMemberRaw || !toMemberRaw || fromMemberRaw.toLowerCase() === toMemberRaw.toLowerCase()) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Provide valid payer and recipient members.');
  }

  const accessibleGroups = await loadAccessibleGroupsWithMembers(viewer);
  const groupMembers = accessibleGroups.find((group) => group.id === groupId)?.members ?? [];
  const fromMember = resolveSettlementMemberName(fromMemberRaw, groupMembers);
  const toMember = resolveSettlementMemberName(toMemberRaw, groupMembers);
  if (!fromMember || !toMember) {
    throw appError(
      ErrorCode.BAD_USER_INPUT,
      'Payer and recipient must match household member names.',
    );
  }

  let expenseGroup = input.expenseGroup?.trim() || null;
  if (expenseGroup) {
    const labels = await listExpenseGroupLabelsByGroupId([groupId]);
    const known = labels.get(groupId) ?? [];
    const match = known.find((label) => label.trim().toLowerCase() === expenseGroup!.toLowerCase());
    if (match) {
      expenseGroup = match;
    }
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Settlement amount must be greater than 0.');
  }
  if (!settledAt) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Settlement date is required.');
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
      expenseGroup,
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
    throw appError(ErrorCode.BAD_USER_INPUT, 'Unable to record settlement payment.');
  }
  const payment: SettlementPayment = {
    id: String(row.id),
    groupId: String(row.groupId),
    expenseGroup: row.expenseGroup ?? undefined,
    fromMember: row.fromMember,
    toMember: row.toMember,
    amount: Number(row.amount),
    note: row.note ?? undefined,
    settledAt: toSettlementDateString(row.settledAt),
  };
  const householdSettlement = await getHouseholdSettlement(viewer, input.groupId, periodInput);
  if (!householdSettlement) {
    throw appError(ErrorCode.NOT_FOUND, 'Household settlement not found.');
  }
  return { payment, householdSettlement };
};
