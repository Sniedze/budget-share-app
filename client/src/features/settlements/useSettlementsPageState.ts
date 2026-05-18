import { useMutation, useQuery } from '@apollo/client/react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth';
import { GET_GROUPS } from '../groups/graphql';
import type { GetGroupsQueryResult } from '../../graphql/operationTypes';
import { formatAppCurrency, formatCurrency } from '../../format/currency';
import type { RecordSettlementPaymentMutation } from '../../graphql/generated/graphql';
import { mergeHouseholdSettlementInCache } from './settlementCacheUpdates';
import { GET_HOUSEHOLD_SETTLEMENTS, RECORD_SETTLEMENT_PAYMENT } from './graphql';
import {
  formatSettlementPeriodLabel,
  SETTLEMENT_PERIOD_OPTIONS,
  settlementPeriodRange,
  suggestSettlementDueDate,
  type SettlementPeriodValue,
} from './settlementPeriod';
import {
  buildMemberBalanceRows,
  buildSettlementReminderMailto,
  buildSettlementSummary,
  filterPaymentsInPeriod,
  filterTransfersSettledByPayments,
  groupPaymentsByMonth,
  isSettlementOverdue,
  resolveViewerMemberName,
  settlementDueStatus,
} from './settlementSelectors';
import type { GetHouseholdSettlementsResponse, SettlementTransfer } from '../../graphql/operationTypes';
import { isPersonalCustomSettlement } from './constants';

export type SettlementDetailsTab = 'pending' | 'history' | 'monthly';

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
};

export const useSettlementsPageState = () => {
  const { user } = useAuth();
  const [settlementPeriod, setSettlementPeriod] = useState<SettlementPeriodValue>('CurrentMonth');
  const { data, loading, error } = useQuery<GetHouseholdSettlementsResponse>(GET_HOUSEHOLD_SETTLEMENTS, {
    variables: { period: settlementPeriod },
  });
  const { data: groupsData } = useQuery<GetGroupsQueryResult>(GET_GROUPS);
  const [recordPayment, { loading: isSaving }] = useMutation<RecordSettlementPaymentMutation>(
    RECORD_SETTLEMENT_PAYMENT,
    {
      update(cache, { data }) {
        const settlement = data?.recordSettlementPayment?.householdSettlement;
        if (settlement) {
          mergeHouseholdSettlementInCache(cache, settlementPeriod, settlement);
        }
      },
    },
  );

  const households = useMemo(() => data?.householdSettlements ?? [], [data?.householdSettlements]);
  const [activeGroupId, setActiveGroupId] = useState('');
  const [detailsTab, setDetailsTab] = useState<SettlementDetailsTab>('pending');
  const [fromMember, setFromMember] = useState('');
  const [toMember, setToMember] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [settledAt, setSettledAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [formError, setFormError] = useState<string | null>(null);
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [settlementCurrency, setSettlementCurrency] = useState<string | null>(null);

  useEffect(() => {
    if (!households.length) {
      setActiveGroupId('');
      return;
    }
    if (!households.some((item) => item.groupId === activeGroupId)) {
      setActiveGroupId(households[0].groupId);
    }
  }, [activeGroupId, households]);

  const activeHousehold = useMemo(
    () => households.find((item) => item.groupId === activeGroupId) ?? households[0],
    [activeGroupId, households],
  );
  const isPersonalCustomSettlementActive = useMemo(
    () => (activeHousehold ? isPersonalCustomSettlement(activeHousehold.groupId) : false),
    [activeHousehold],
  );

  useEffect(() => {
    if (!activeHousehold) {
      setSettlementCurrency(null);
      return;
    }
    const scopes = activeHousehold.currencyScopes ?? [];
    setSettlementCurrency((current) => {
      if (current && scopes.some((entry) => entry.currency === current)) {
        return current;
      }
      return scopes[0]?.currency ?? null;
    });
  }, [activeHousehold]);

  const activeCurrencyScope = useMemo(() => {
    if (!activeHousehold?.currencyScopes?.length) {
      return null;
    }
    return (
      activeHousehold.currencyScopes.find((entry) => entry.currency === settlementCurrency) ??
      activeHousehold.currencyScopes[0]
    );
  }, [activeHousehold, settlementCurrency]);

  const settlementBalancesSource = activeCurrencyScope ?? activeHousehold;

  const balances = useMemo(() => settlementBalancesSource?.balances ?? [], [settlementBalancesSource?.balances]);

  const payments = useMemo(() => activeHousehold?.payments ?? [], [activeHousehold?.payments]);

  const rawTransfers = useMemo(
    () => settlementBalancesSource?.transfers ?? [],
    [settlementBalancesSource?.transfers],
  );

  const transfers = useMemo(
    () => filterTransfersSettledByPayments(rawTransfers, payments),
    [payments, rawTransfers],
  );

  const mixedCurrencyWarning = Boolean(activeHousehold?.mixedCurrencyWarning);
  const settlementCurrencyCodes = useMemo(
    () => activeHousehold?.currencyScopes?.map((entry) => entry.currency) ?? [],
    [activeHousehold?.currencyScopes],
  );
  const formatSettlementAmount = (value: number): string =>
    settlementCurrency ? formatCurrency(value, settlementCurrency) : formatAppCurrency(value);

  const memberNames = useMemo(() => balances.map((entry) => entry.memberName), [balances]);
  const viewerName = useMemo(
    () => resolveViewerMemberName(user?.fullName, memberNames),
    [memberNames, user?.fullName],
  );

  const summary = useMemo(() => buildSettlementSummary(viewerName, transfers), [transfers, viewerName]);
  const memberRows = useMemo(() => buildMemberBalanceRows(viewerName, transfers), [transfers, viewerName]);
  const periodLabel = useMemo(() => formatSettlementPeriodLabel(settlementPeriod), [settlementPeriod]);
  const dueDateLabel = useMemo(() => suggestSettlementDueDate(settlementPeriod), [settlementPeriod]);
  const periodRange = useMemo(() => settlementPeriodRange(settlementPeriod), [settlementPeriod]);
  const monthlyGroups = useMemo(() => groupPaymentsByMonth(payments), [payments]);
  const periodPayments = useMemo(
    () => filterPaymentsInPeriod(payments, periodRange.startIso, periodRange.endIso),
    [payments, periodRange.endIso, periodRange.startIso],
  );

  const memberEmailByName = useMemo(() => {
    const group = groupsData?.groups.find((item) => item.id === activeGroupId);
    const map = new Map<string, string>();
    group?.members.forEach((member) => {
      map.set(member.name, member.email);
    });
    return map;
  }, [activeGroupId, groupsData?.groups]);

  const sendReminder = (transfer: SettlementTransfer): string | null => {
    if (!isSettlementOverdue(dueDateLabel)) {
      return 'Reminders are available after the due date.';
    }
    if (!activeHousehold || !viewerName) {
      return 'Unable to send a reminder right now.';
    }
    const debtorEmail = memberEmailByName.get(transfer.fromMember)?.trim();
    if (!debtorEmail) {
      return `No email on file for ${transfer.fromMember}.`;
    }
    const mailto = buildSettlementReminderMailto({
      toEmail: debtorEmail,
      debtorName: transfer.fromMember,
      amountFormatted: formatSettlementAmount(transfer.amount),
      householdName: activeHousehold.groupName,
      periodLabel,
      dueDateLabel,
      viewerName,
    });
    window.location.href = mailto;
    return null;
  };

  const prefillPayment = (transfer: SettlementTransfer) => {
    setFromMember(transfer.fromMember);
    setToMember(transfer.toMember);
    setAmount(String(transfer.amount));
    setShowRecordForm(true);
    setFormError(null);
  };

  const markAsPaid = async (transfer: SettlementTransfer): Promise<string | null> => {
    if (!activeHousehold) {
      return 'No household selected.';
    }
    if (isPersonalCustomSettlementActive) {
      return 'Recording payments for personal custom splits is not supported yet.';
    }
    const confirmed = window.confirm(
      `Mark ${formatSettlementAmount(transfer.amount)} as paid from ${transfer.fromMember} to ${transfer.toMember}?\n\nThis records a settlement for ${activeHousehold.groupName} (${periodLabel}).`,
    );
    if (!confirmed) {
      return null;
    }
    try {
      await recordPayment({
        variables: {
          input: {
            groupId: activeHousehold.groupId,
            expenseGroup: null,
            fromMember: transfer.fromMember,
            toMember: transfer.toMember,
            amount: transfer.amount,
            note: null,
            settledAt: new Date().toISOString().slice(0, 10),
          },
          period: settlementPeriod,
        },
      });
      return null;
    } catch (mutationError) {
      return mutationError instanceof Error ? mutationError.message : 'Unable to record settlement.';
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (isPersonalCustomSettlementActive) {
      setFormError('Recording payments for personal custom splits is not supported yet.');
      return;
    }
    const parsedAmount = Number(amount);
    if (
      !activeHousehold ||
      !fromMember ||
      !toMember ||
      fromMember === toMember ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0
    ) {
      setFormError('Fill valid payer, recipient, and amount.');
      return;
    }
    try {
      await recordPayment({
        variables: {
          input: {
            groupId: activeHousehold.groupId,
            expenseGroup: null,
            fromMember,
            toMember,
            amount: parsedAmount,
            note: note.trim() || null,
            settledAt,
          },
          period: settlementPeriod,
        },
      });
      setAmount('');
      setNote('');
      setFromMember('');
      setToMember('');
      setShowRecordForm(false);
    } catch (mutationError) {
      setFormError(mutationError instanceof Error ? mutationError.message : 'Unable to record settlement.');
    }
  };

  return {
    loading,
    error,
    households,
    activeHousehold,
    isPersonalCustomSettlementActive,
    mixedCurrencyWarning,
    settlementCurrency,
    setSettlementCurrency,
    settlementCurrencyCodes,
    formatSettlementAmount,
    activeGroupId,
    setActiveGroupId,
    detailsTab,
    setDetailsTab,
    balances,
    transfers,
    payments,
    periodPayments,
    settlementPeriod,
    setSettlementPeriod,
    settlementPeriodOptions: SETTLEMENT_PERIOD_OPTIONS,
    monthlyGroups,
    viewerName,
    summary,
    memberRows,
    periodLabel,
    dueDateLabel,
    showRecordForm,
    setShowRecordForm,
    fromMember,
    setFromMember,
    toMember,
    setToMember,
    amount,
    setAmount,
    note,
    setNote,
    settledAt,
    setSettledAt,
    formError,
    isSaving,
    prefillPayment,
    markAsPaid,
    sendReminder,
    settlementDueStatus,
    onSubmit,
    getInitials,
  };
};
