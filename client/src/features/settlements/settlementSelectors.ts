import type { SettlementPayment, SettlementTransfer } from '../../graphql/operationTypes';

const EPSILON = 0.01;

export const resolveViewerMemberName = (
  viewerFullName: string | null | undefined,
  memberNames: string[],
): string | null => {
  if (!viewerFullName?.trim()) {
    return null;
  }
  const normalizedViewer = viewerFullName.trim().toLowerCase();
  const exact = memberNames.find((name) => name.trim().toLowerCase() === normalizedViewer);
  if (exact) {
    return exact;
  }
  const firstToken = normalizedViewer.split(/\s+/)[0];
  return memberNames.find((name) => name.trim().toLowerCase() === firstToken) ?? viewerFullName.trim();
};

export type SettlementSummaryStats = {
  netBalance: number;
  youAreOwed: number;
  youOwe: number;
  owedByCount: number;
  oweToCount: number;
  pendingCount: number;
};

export const buildSettlementSummary = (
  viewerName: string | null,
  transfers: SettlementTransfer[],
): SettlementSummaryStats => {
  if (!viewerName) {
    return {
      netBalance: 0,
      youAreOwed: 0,
      youOwe: 0,
      owedByCount: 0,
      oweToCount: 0,
      pendingCount: transfers.length,
    };
  }

  const youAreOwed = transfers
    .filter((transfer) => transfer.toMember === viewerName)
    .reduce((sum, transfer) => sum + transfer.amount, 0);
  const youOwe = transfers
    .filter((transfer) => transfer.fromMember === viewerName)
    .reduce((sum, transfer) => sum + transfer.amount, 0);

  const owedByCount = new Set(
    transfers.filter((transfer) => transfer.toMember === viewerName).map((transfer) => transfer.fromMember),
  ).size;
  const oweToCount = new Set(
    transfers.filter((transfer) => transfer.fromMember === viewerName).map((transfer) => transfer.toMember),
  ).size;

  return {
    netBalance: youAreOwed - youOwe,
    youAreOwed,
    youOwe,
    owedByCount,
    oweToCount,
    pendingCount: transfers.length,
  };
};

export type MemberBalanceRow = {
  memberName: string;
  netRelativeToViewer: number;
  label: 'owes you' | 'you owe';
};

export const buildMemberBalanceRows = (
  viewerName: string | null,
  transfers: SettlementTransfer[],
): MemberBalanceRow[] => {
  if (!viewerName) {
    return [];
  }

  const memberNames = new Set<string>();
  transfers.forEach((transfer) => {
    memberNames.add(transfer.fromMember);
    memberNames.add(transfer.toMember);
  });
  memberNames.delete(viewerName);

  return Array.from(memberNames)
    .map((memberName) => {
      const owedToViewer = transfers
        .filter((transfer) => transfer.fromMember === memberName && transfer.toMember === viewerName)
        .reduce((sum, transfer) => sum + transfer.amount, 0);
      const owedByViewer = transfers
        .filter((transfer) => transfer.fromMember === viewerName && transfer.toMember === memberName)
        .reduce((sum, transfer) => sum + transfer.amount, 0);
      const netRelativeToViewer = owedToViewer - owedByViewer;
      return {
        memberName,
        netRelativeToViewer,
        label: netRelativeToViewer >= 0 ? ('owes you' as const) : ('you owe' as const),
      };
    })
    .filter((row) => Math.abs(row.netRelativeToViewer) > EPSILON)
    .sort((left, right) => Math.abs(right.netRelativeToViewer) - Math.abs(left.netRelativeToViewer));
};

const normalizeMemberKey = (name: string): string => name.trim().toLowerCase();

const transferMatchesPayment = (
  transfer: SettlementTransfer,
  payment: SettlementPayment,
): boolean =>
  normalizeMemberKey(transfer.fromMember) === normalizeMemberKey(payment.fromMember) &&
  normalizeMemberKey(transfer.toMember) === normalizeMemberKey(payment.toMember) &&
  Math.abs(transfer.amount - payment.amount) < 0.02;

/** Hide pending rows already recorded as payments in the active scope. */
export const filterTransfersSettledByPayments = (
  transfers: SettlementTransfer[],
  payments: SettlementPayment[],
): SettlementTransfer[] =>
  transfers.filter(
    (transfer) => !payments.some((payment) => transferMatchesPayment(transfer, payment)),
  );

export const filterPaymentsInPeriod = (
  payments: SettlementPayment[],
  startIso: string,
  endIso: string,
): SettlementPayment[] =>
  payments.filter((payment) => {
    const settled = payment.settledAt.slice(0, 10);
    return settled >= startIso && settled <= endIso;
  });

const startOfLocalDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const parseIsoDateLocal = (isoDate: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

/** True when today is strictly after the due date (due date itself is not overdue). */
export const isSettlementOverdue = (dueDateIso: string, reference = new Date()): boolean => {
  const dueDay = parseIsoDateLocal(dueDateIso);
  if (!dueDay) {
    return false;
  }
  return startOfLocalDay(reference).getTime() > startOfLocalDay(dueDay).getTime();
};

export type SettlementDueStatus = 'pending' | 'overdue';

export const settlementDueStatus = (dueDateIso: string, reference = new Date()): SettlementDueStatus =>
  isSettlementOverdue(dueDateIso, reference) ? 'overdue' : 'pending';

export const buildSettlementReminderMailto = (params: {
  toEmail: string;
  debtorName: string;
  amountFormatted: string;
  householdName: string;
  periodLabel: string;
  dueDateLabel: string;
  viewerName: string;
}): string => {
  const subject = `Settlement reminder: ${params.householdName}`;
  const body = [
    `Hi ${params.debtorName},`,
    '',
    `This is a friendly reminder that you owe ${params.amountFormatted} for ${params.periodLabel} in ${params.householdName}.`,
    `The due date was ${params.dueDateLabel}.`,
    '',
    `Thanks,`,
    params.viewerName,
  ].join('\n');
  return `mailto:${params.toEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

export const groupPaymentsByMonth = (
  payments: SettlementPayment[],
): Array<{ monthKey: string; label: string; payments: SettlementPayment[]; total: number }> => {
  const byMonth = new Map<string, SettlementPayment[]>();
  payments.forEach((payment) => {
    const date = new Date(payment.settledAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const existing = byMonth.get(monthKey) ?? [];
    existing.push(payment);
    byMonth.set(monthKey, existing);
  });

  return Array.from(byMonth.entries())
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([monthKey, monthPayments]) => {
      const sampleDate = new Date(monthPayments[0].settledAt);
      return {
        monthKey,
        label: sampleDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        payments: monthPayments.sort((a, b) => b.settledAt.localeCompare(a.settledAt)),
        total: monthPayments.reduce((sum, payment) => sum + payment.amount, 0),
      };
    });
};
