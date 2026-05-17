import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, DollarSign, TrendingDown, TrendingUp } from 'lucide-react';
import styled from 'styled-components';
import { Sidebar } from '../components/sections/Sidebar';
import {
  AppLayout,
  Button,
  ErrorText,
  HeaderRow,
  HeaderText,
  Input,
  MutedText,
  PageSurface,
  SectionSubtitle,
  SectionTitle,
  Table,
  TableWrapper,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  UserMenu,
} from '../components/ui';
import { useSettlementsPageState } from '../features/settlements/useSettlementsPageState';
import type { SettlementPeriodValue } from '../features/settlements/settlementPeriod';
import type { SettlementTransfer } from '../features/settlements/types';
import {
  ActionCell,
  Avatar,
  BalanceAmount,
  BalanceIdentity,
  BalanceList,
  BalanceName,
  BalanceRow,
  BalanceStatus,
  IconBadge,
  MonthlyGroup,
  MonthlyGroupTitle,
  Panel,
  PanelHeader,
  PanelTitle,
  RecordFormGrid,
  RecordPanel,
  StatusPill,
  SummaryCard,
  SummaryGrid,
  SummaryCardTop,
  SummaryHint,
  SummaryLabel,
  SummaryValue,
  TabButton,
  TabGroup,
  ToolbarField,
  ToolbarRow,
  ToolbarSelect,
} from '../features/settlements/settlementsPageStyles';
import { spacing } from '../styles/tokens';

const formatSignedCurrency = (value: number, formatAmount: (amount: number) => string): string => {
  const formatted = formatAmount(Math.abs(value));
  if (value > 0.01) {
    return `+${formatted}`;
  }
  if (value < -0.01) {
    return `-${formatted}`;
  }
  return formatted;
};

const EmptyBalances = styled.p`
  margin: 0;
  color: #6b7280;
  font-size: 14px;
`;

export const SettlementsPage = (): JSX.Element => {
  const {
    loading,
    error,
    households,
    activeHousehold,
    mixedCurrencyWarning,
    settlementCurrency,
    setSettlementCurrency,
    settlementCurrencyCodes,
    formatSettlementAmount,
    scopeExpenseGroups,
    activeGroupId,
    setActiveGroupId,
    scope,
    setScope,
    detailsTab,
    setDetailsTab,
    balances,
    transfers,
    payments,
    periodPayments,
    settlementPeriod,
    setSettlementPeriod,
    settlementPeriodOptions,
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
    markAsPaid,
    sendReminder,
    settlementDueStatus,
    onSubmit,
    getInitials,
  } = useSettlementsPageState();

  const [reminderError, setReminderError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const handleMarkAsPaid = async (transfer: SettlementTransfer) => {
    setPaymentError(null);
    const issue = await markAsPaid(transfer);
    if (issue) {
      setPaymentError(issue);
    }
  };

  const netHint =
    summary.netBalance > 0.01 ? 'You are owed' : summary.netBalance < -0.01 ? 'You owe' : 'All settled';

  return (
    <AppLayout>
      <Sidebar />
      <PageSurface>
        <HeaderRow>
          <HeaderText>
            <SectionTitle>Settlements</SectionTitle>
            <SectionSubtitle>Track and settle shared expenses with household members</SectionSubtitle>
          </HeaderText>
          <UserMenu />
        </HeaderRow>

        {loading ? <MutedText>Loading settlements…</MutedText> : null}
        {error ? (
          <ErrorText>
            {error.message}
            {import.meta.env.DEV &&
            'graphQLErrors' in error &&
            Array.isArray(error.graphQLErrors) &&
            error.graphQLErrors[0]?.extensions?.requestId
              ? ` (requestId: ${String(error.graphQLErrors[0].extensions.requestId)})`
              : null}
          </ErrorText>
        ) : null}

        {!loading && !error && households.length === 0 ? (
          <Panel>
            <MutedText>
              Settlements need at least one household. Create a household, add members, and log shared expenses —
              then return here.
            </MutedText>
            <Button as={Link} to="/groups" $variant="accent" style={{ marginTop: spacing.md, width: 'fit-content' }}>
              Go to Household
            </Button>
          </Panel>
        ) : null}

        {activeHousehold ? (
          <>
            <ToolbarRow>
              <ToolbarField>
                Period
                <ToolbarSelect
                  value={settlementPeriod}
                  onChange={(event) =>
                    setSettlementPeriod(event.currentTarget.value as SettlementPeriodValue)
                  }
                >
                  {settlementPeriodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </ToolbarSelect>
              </ToolbarField>
              {households.length > 1 ? (
                <ToolbarField>
                  Household
                  <ToolbarSelect
                    value={activeGroupId}
                    onChange={(event) => setActiveGroupId(event.currentTarget.value)}
                  >
                    {households.map((household) => (
                      <option key={household.groupId} value={household.groupId}>
                        {household.groupName}
                      </option>
                    ))}
                  </ToolbarSelect>
                </ToolbarField>
              ) : null}
              {mixedCurrencyWarning && settlementCurrencyCodes.length > 1 ? (
                <ToolbarField>
                  Currency
                  <ToolbarSelect
                    value={settlementCurrency ?? settlementCurrencyCodes[0]}
                    onChange={(event) => setSettlementCurrency(event.currentTarget.value)}
                  >
                    {settlementCurrencyCodes.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </ToolbarSelect>
                </ToolbarField>
              ) : null}
              {scopeExpenseGroups.length > 0 ? (
                <ToolbarField>
                  Scope
                  <ToolbarSelect value={scope} onChange={(event) => setScope(event.currentTarget.value)}>
                    <option value="__household__">Total household</option>
                    {scopeExpenseGroups.map((group) => (
                      <option key={`${activeHousehold.groupId}-${group.expenseGroup}`} value={group.expenseGroup}>
                        {group.expenseGroup}
                      </option>
                    ))}
                  </ToolbarSelect>
                </ToolbarField>
              ) : null}
            </ToolbarRow>

            {mixedCurrencyWarning ? (
              <MutedText style={{ marginBottom: spacing.md }}>
                This household has expenses in more than one currency. Balances and transfers are shown per currency —
                switch the currency selector to see each total.
              </MutedText>
            ) : null}

            <SummaryGrid>
              <SummaryCard $featured>
                <SummaryCardTop>
                  <SummaryLabel $featured>Net Balance</SummaryLabel>
                  <IconBadge $featured>
                    <DollarSign size={18} />
                  </IconBadge>
                </SummaryCardTop>
                <div>
                  <SummaryValue $featured>
                    {formatSignedCurrency(summary.netBalance, formatSettlementAmount)}
                  </SummaryValue>
                  <SummaryHint $featured>{netHint}</SummaryHint>
                </div>
              </SummaryCard>

              <SummaryCard>
                <SummaryCardTop>
                  <SummaryLabel>You Are Owed</SummaryLabel>
                  <IconBadge $tone="green">
                    <TrendingUp size={18} />
                  </IconBadge>
                </SummaryCardTop>
                <div>
                  <SummaryValue $tone="positive">
                    {formatSignedCurrency(summary.youAreOwed, formatSettlementAmount)}
                  </SummaryValue>
                  <SummaryHint>
                    From {summary.owedByCount} {summary.owedByCount === 1 ? 'person' : 'people'}
                  </SummaryHint>
                </div>
              </SummaryCard>

              <SummaryCard>
                <SummaryCardTop>
                  <SummaryLabel>You Owe</SummaryLabel>
                  <IconBadge $tone="red">
                    <TrendingDown size={18} />
                  </IconBadge>
                </SummaryCardTop>
                <div>
                  <SummaryValue $tone="negative">
                    -{formatSettlementAmount(summary.youOwe)}
                  </SummaryValue>
                  <SummaryHint>
                    To {summary.oweToCount} {summary.oweToCount === 1 ? 'person' : 'people'}
                  </SummaryHint>
                </div>
              </SummaryCard>

              <SummaryCard>
                <SummaryCardTop>
                  <SummaryLabel>Pending Settlements</SummaryLabel>
                  <IconBadge $tone="amber">
                    <Clock size={18} />
                  </IconBadge>
                </SummaryCardTop>
                <div>
                  <SummaryValue>{String(summary.pendingCount)}</SummaryValue>
                  <SummaryHint>In selected period</SummaryHint>
                </div>
              </SummaryCard>
            </SummaryGrid>

            <Panel>
              <PanelTitle>Current Balances</PanelTitle>
              {memberRows.length === 0 ? (
                <EmptyBalances>No outstanding balances between members for this scope.</EmptyBalances>
              ) : (
                <BalanceList>
                  {memberRows.map((row) => (
                    <BalanceRow key={row.memberName}>
                      <BalanceIdentity>
                        <Avatar>{getInitials(row.memberName)}</Avatar>
                        <div>
                          <BalanceName>{row.memberName}</BalanceName>
                          <BalanceStatus>{row.label}</BalanceStatus>
                        </div>
                      </BalanceIdentity>
                      <BalanceAmount $tone={row.netRelativeToViewer >= 0 ? 'positive' : 'negative'}>
                        {formatSignedCurrency(row.netRelativeToViewer, formatSettlementAmount)}
                      </BalanceAmount>
                    </BalanceRow>
                  ))}
                </BalanceList>
              )}
            </Panel>

            <Panel>
              <PanelHeader>
                <PanelTitle>Settlement Details</PanelTitle>
                <TabGroup>
                  <TabButton type="button" $active={detailsTab === 'pending'} onClick={() => setDetailsTab('pending')}>
                    Pending
                  </TabButton>
                  <TabButton type="button" $active={detailsTab === 'history'} onClick={() => setDetailsTab('history')}>
                    History
                  </TabButton>
                  <TabButton type="button" $active={detailsTab === 'monthly'} onClick={() => setDetailsTab('monthly')}>
                    Monthly View
                  </TabButton>
                </TabGroup>
              </PanelHeader>

              {detailsTab === 'pending' ? (
                <TableWrapper>
                  <Table>
                    <Thead>
                      <Tr>
                        <Th>From</Th>
                        <Th>To</Th>
                        <Th>Amount</Th>
                        <Th>Period</Th>
                        <Th>Due date</Th>
                        <Th>Status</Th>
                        <Th>Action</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {transfers.map((transfer, index) => {
                        const viewerReceives = viewerName === transfer.toMember;
                        const dueStatus = settlementDueStatus(dueDateLabel);
                        const isOverdue = dueStatus === 'overdue';
                        return (
                          <Tr key={`${transfer.fromMember}-${transfer.toMember}-${index}`}>
                            <Td>{transfer.fromMember}</Td>
                            <Td>{transfer.toMember}</Td>
                            <Td>{formatSettlementAmount(transfer.amount)}</Td>
                            <Td>{periodLabel}</Td>
                            <Td>{dueDateLabel}</Td>
                            <Td>
                              <StatusPill $variant={dueStatus}>
                                {isOverdue ? 'Overdue' : 'Pending'}
                              </StatusPill>
                            </Td>
                            <Td>
                              <ActionCell>
                                <Button
                                  type="button"
                                  $variant="accent"
                                  $size="sm"
                                  disabled={isSaving}
                                  onClick={() => void handleMarkAsPaid(transfer)}
                                >
                                  Mark as Paid
                                </Button>
                                {viewerReceives ? (
                                  <Button
                                    type="button"
                                    $variant="secondary"
                                    $size="sm"
                                    disabled={!isOverdue}
                                    title={
                                      isOverdue
                                        ? 'Open email to remind the payer'
                                        : 'Available after the due date has passed'
                                    }
                                    onClick={() => {
                                      setReminderError(null);
                                      const reminderIssue = sendReminder(transfer);
                                      if (reminderIssue) {
                                        setReminderError(reminderIssue);
                                      }
                                    }}
                                  >
                                    Send Reminder
                                  </Button>
                                ) : null}
                              </ActionCell>
                            </Td>
                          </Tr>
                        );
                      })}
                      {transfers.length === 0 ? (
                        <Tr>
                          <Td colSpan={7}>No pending transfers. This scope is settled.</Td>
                        </Tr>
                      ) : null}
                    </Tbody>
                  </Table>
                </TableWrapper>
              ) : null}
              {paymentError ? <ErrorText>{paymentError}</ErrorText> : null}
              {reminderError ? <ErrorText>{reminderError}</ErrorText> : null}

              {detailsTab === 'history' ? (
                <TableWrapper>
                  <Table>
                    <Thead>
                      <Tr>
                        <Th>From</Th>
                        <Th>To</Th>
                        <Th>Amount</Th>
                        <Th>Period</Th>
                        <Th>Date</Th>
                        <Th>Status</Th>
                        <Th>Note</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {payments.map((payment) => (
                        <Tr key={payment.id}>
                          <Td>{payment.fromMember}</Td>
                          <Td>{payment.toMember}</Td>
                          <Td>{formatSettlementAmount(payment.amount)}</Td>
                          <Td>{payment.expenseGroup ?? 'Total household'}</Td>
                          <Td>{payment.settledAt}</Td>
                          <Td>
                            <StatusPill $variant="paid">Paid</StatusPill>
                          </Td>
                          <Td>{payment.note ?? '—'}</Td>
                        </Tr>
                      ))}
                      {payments.length === 0 ? (
                        <Tr>
                          <Td colSpan={7}>No settlement payments recorded yet.</Td>
                        </Tr>
                      ) : null}
                    </Tbody>
                  </Table>
                </TableWrapper>
              ) : null}

              {detailsTab === 'monthly' ? (
                <>
                  {monthlyGroups.length === 0 ? (
                    <MutedText>No payments to show by month yet.</MutedText>
                  ) : (
                    monthlyGroups.map((group) => (
                      <MonthlyGroup key={group.monthKey}>
                        <MonthlyGroupTitle>
                          {group.label} · {formatSettlementAmount(group.total)} ({group.payments.length} payments)
                        </MonthlyGroupTitle>
                        <TableWrapper>
                          <Table>
                            <Thead>
                              <Tr>
                                <Th>From</Th>
                                <Th>To</Th>
                                <Th>Amount</Th>
                                <Th>Scope</Th>
                                <Th>Date</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {group.payments.map((payment) => (
                                <Tr key={payment.id}>
                                  <Td>{payment.fromMember}</Td>
                                  <Td>{payment.toMember}</Td>
                                  <Td>{formatSettlementAmount(payment.amount)}</Td>
                                  <Td>{payment.expenseGroup ?? 'Total household'}</Td>
                                  <Td>{payment.settledAt}</Td>
                                </Tr>
                              ))}
                            </Tbody>
                          </Table>
                        </TableWrapper>
                      </MonthlyGroup>
                    ))
                  )}
                </>
              ) : null}

              {showRecordForm || detailsTab === 'pending' ? (
                <RecordPanel>
                  <PanelHeader style={{ marginBottom: spacing.md }}>
                    <PanelTitle style={{ fontSize: 16 }}>Record payment</PanelTitle>
                    {showRecordForm ? (
                      <Button type="button" $variant="secondary" $size="sm" onClick={() => setShowRecordForm(false)}>
                        Cancel
                      </Button>
                    ) : (
                      <Button type="button" $variant="accent" $size="sm" onClick={() => setShowRecordForm(true)}>
                        New payment
                      </Button>
                    )}
                  </PanelHeader>
                  {showRecordForm ? (
                    <RecordFormGrid onSubmit={onSubmit}>
                      <ToolbarField>
                        From
                        <ToolbarSelect value={fromMember} onChange={(event) => setFromMember(event.currentTarget.value)}>
                          <option value="">Select member</option>
                          {balances.map((entry) => (
                            <option key={`from-${entry.memberName}`} value={entry.memberName}>
                              {entry.memberName}
                            </option>
                          ))}
                        </ToolbarSelect>
                      </ToolbarField>
                      <ToolbarField>
                        To
                        <ToolbarSelect value={toMember} onChange={(event) => setToMember(event.currentTarget.value)}>
                          <option value="">Select member</option>
                          {balances.map((entry) => (
                            <option key={`to-${entry.memberName}`} value={entry.memberName}>
                              {entry.memberName}
                            </option>
                          ))}
                        </ToolbarSelect>
                      </ToolbarField>
                      <ToolbarField>
                        Amount
                        <Input value={amount} onChange={(event) => setAmount(event.currentTarget.value)} placeholder="0.00" />
                      </ToolbarField>
                      <ToolbarField>
                        Settled date
                        <Input type="date" value={settledAt} onChange={(event) => setSettledAt(event.currentTarget.value)} />
                      </ToolbarField>
                      <ToolbarField>
                        Note (optional)
                        <Input value={note} onChange={(event) => setNote(event.currentTarget.value)} placeholder="Bank transfer" />
                      </ToolbarField>
                      <Button type="submit" $variant="accent" disabled={isSaving}>
                        {isSaving ? 'Saving…' : 'Record payment'}
                      </Button>
                    </RecordFormGrid>
                  ) : null}
                  {formError ? <ErrorText>{formError}</ErrorText> : null}
                </RecordPanel>
              ) : null}
            </Panel>

            {periodPayments.length > 0 ? (
              <MutedText>
                {periodPayments.length} payment{periodPayments.length === 1 ? '' : 's'} recorded in {periodLabel}.
              </MutedText>
            ) : null}
          </>
        ) : null}
      </PageSurface>
    </AppLayout>
  );
};
