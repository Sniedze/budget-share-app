import { useMutation, useQuery } from '@apollo/client/react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Sidebar } from '../components/sections';
import {
  AppLayout,
  Button,
  Card,
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
import {
  GET_HOUSEHOLD_SETTLEMENTS,
  RECORD_SETTLEMENT_PAYMENT,
  type GetHouseholdSettlementsResponse,
} from '../features/settlements';
import { formatAppCurrency } from '../format/currency';
import { spacing } from '../styles/tokens';

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${spacing.md};

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const FormGrid = styled.form`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${spacing.sm};
  align-items: end;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const Field = styled.label`
  display: grid;
  gap: 6px;
  font-size: 13px;
`;

const Select = styled.select`
  font: inherit;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
  min-width: 140px;
`;

export const SettlementsPage = (): JSX.Element => {
  const { data, loading, error } = useQuery<GetHouseholdSettlementsResponse>(GET_HOUSEHOLD_SETTLEMENTS);
  const [recordPayment, { loading: isSaving }] = useMutation(RECORD_SETTLEMENT_PAYMENT, {
    refetchQueries: [{ query: GET_HOUSEHOLD_SETTLEMENTS }],
    awaitRefetchQueries: true,
  });
  const households = useMemo(() => data?.householdSettlements ?? [], [data?.householdSettlements]);
  const [activeGroupId, setActiveGroupId] = useState('');
  const [scope, setScope] = useState('__household__');
  const [fromMember, setFromMember] = useState('');
  const [toMember, setToMember] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [settledAt, setSettledAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!households.length) {
      setActiveGroupId('');
      return;
    }
    if (!households.some((item) => item.groupId === activeGroupId)) {
      setActiveGroupId(households[0].groupId);
    }
  }, [activeGroupId, households]);

  const activeHouseholdForScope = useMemo(
    () => households.find((item) => item.groupId === activeGroupId) ?? households[0],
    [activeGroupId, households],
  );
  useEffect(() => {
    if (!activeHouseholdForScope || scope === '__household__') {
      return;
    }
    const hasGroup = activeHouseholdForScope.expenseGroups.some((g) => g.expenseGroup === scope);
    if (!hasGroup) {
      setScope('__household__');
    }
  }, [activeHouseholdForScope, scope]);

  const activeHousehold = activeHouseholdForScope;
  const activeScopeGroup = useMemo(
    () => activeHousehold?.expenseGroups.find((item) => item.expenseGroup === scope),
    [activeHousehold?.expenseGroups, scope],
  );
  const balances = activeScopeGroup ? activeScopeGroup.balances : activeHousehold?.balances ?? [];
  const transfers = activeScopeGroup ? activeScopeGroup.transfers : activeHousehold?.transfers ?? [];

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const parsedAmount = Number(amount);
    if (!activeHousehold || !fromMember || !toMember || fromMember === toMember || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError('Fill valid payer, recipient, and amount.');
      return;
    }
    try {
      await recordPayment({
        variables: {
          input: {
            groupId: activeHousehold.groupId,
            expenseGroup: scope === '__household__' ? null : scope,
            fromMember,
            toMember,
            amount: parsedAmount,
            note: note.trim() || null,
            settledAt,
          },
        },
      });
      setAmount('');
      setNote('');
    } catch (mutationError) {
      setFormError(mutationError instanceof Error ? mutationError.message : 'Unable to record settlement.');
    }
  };

  return (
    <AppLayout>
      <Sidebar />
      <PageSurface>
        <HeaderRow>
          <HeaderText>
            <SectionTitle>Settlements</SectionTitle>
            <SectionSubtitle>Household balances, net-debt optimization, and reconciliation feed.</SectionSubtitle>
          </HeaderText>
          <UserMenu />
        </HeaderRow>

        {loading ? <MutedText>Loading settlements...</MutedText> : null}
        {error ? <ErrorText>{error.message}</ErrorText> : null}
        {!loading && !error && !activeHousehold ? <MutedText>No household data available yet.</MutedText> : null}

        {activeHousehold ? (
          <>
            <Grid>
              <Card>
                <SectionSubtitle style={{ marginTop: 0 }}>Household</SectionSubtitle>
                <Field>
                  Household
                  <Select value={activeHousehold.groupId} onChange={(event) => setActiveGroupId(event.currentTarget.value)}>
                    {households.map((household) => (
                      <option key={household.groupId} value={household.groupId}>
                        {household.groupName}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field>
                  Scope
                  <Select value={scope} onChange={(event) => setScope(event.currentTarget.value)}>
                    <option value="__household__">Total household</option>
                    {activeHousehold.expenseGroups.map((group) => (
                      <option key={`${activeHousehold.groupId}-${group.expenseGroup}`} value={group.expenseGroup}>
                        {group.expenseGroup}
                      </option>
                    ))}
                  </Select>
                </Field>
              </Card>

              <Card>
                <SectionSubtitle style={{ marginTop: 0 }}>Record settled payment</SectionSubtitle>
                <FormGrid onSubmit={onSubmit}>
                  <Field>
                    From (who owed)
                    <Select value={fromMember} onChange={(event) => setFromMember(event.currentTarget.value)}>
                      <option value="">Select member</option>
                      {balances.map((entry) => (
                        <option key={`from-${entry.memberName}`} value={entry.memberName}>
                          {entry.memberName}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field>
                    To (who is owed)
                    <Select value={toMember} onChange={(event) => setToMember(event.currentTarget.value)}>
                      <option value="">Select member</option>
                      {balances.map((entry) => (
                        <option key={`to-${entry.memberName}`} value={entry.memberName}>
                          {entry.memberName}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field>
                    Amount
                    <Input value={amount} onChange={(event) => setAmount(event.currentTarget.value)} placeholder="0.00" />
                  </Field>
                  <Field>
                    Settled date
                    <Input type="date" value={settledAt} onChange={(event) => setSettledAt(event.currentTarget.value)} />
                  </Field>
                  <Field>
                    Note (optional)
                    <Input value={note} onChange={(event) => setNote(event.currentTarget.value)} placeholder="Bank transfer" />
                  </Field>
                  <Button type="submit" $variant="accent" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Record payment'}
                  </Button>
                </FormGrid>
                {formError ? <ErrorText>{formError}</ErrorText> : null}
              </Card>
            </Grid>

            <SectionSubtitle>Balances</SectionSubtitle>
            <TableWrapper>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Member</Th>
                    <Th>Net amount</Th>
                    <Th>Status</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {balances.map((entry) => (
                    <Tr key={`balance-${entry.memberName}`}>
                      <Td>{entry.memberName}</Td>
                      <Td>{formatAppCurrency(Math.abs(entry.amount))}</Td>
                      <Td>{entry.amount > 0.01 ? 'Is owed' : entry.amount < -0.01 ? 'Owes' : 'Settled'}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrapper>

            <SectionSubtitle>Net-debt optimized transfers</SectionSubtitle>
            <TableWrapper>
              <Table>
                <Thead>
                  <Tr>
                    <Th>From</Th>
                    <Th>To</Th>
                    <Th>Amount</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {transfers.map((transfer, index) => (
                    <Tr key={`transfer-${transfer.fromMember}-${transfer.toMember}-${index}`}>
                      <Td>{transfer.fromMember}</Td>
                      <Td>{transfer.toMember}</Td>
                      <Td>{formatAppCurrency(transfer.amount)}</Td>
                    </Tr>
                  ))}
                  {transfers.length === 0 ? (
                    <Tr>
                      <Td colSpan={3}>No transfers needed. This scope is settled.</Td>
                    </Tr>
                  ) : null}
                </Tbody>
              </Table>
            </TableWrapper>

            <SectionSubtitle>Recorded settlement history</SectionSubtitle>
            <TableWrapper>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Date</Th>
                    <Th>Scope</Th>
                    <Th>From</Th>
                    <Th>To</Th>
                    <Th>Amount</Th>
                    <Th>Note</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {activeHousehold.payments.map((payment) => (
                    <Tr key={payment.id}>
                      <Td>{payment.settledAt}</Td>
                      <Td>{payment.expenseGroup ?? 'Total household'}</Td>
                      <Td>{payment.fromMember}</Td>
                      <Td>{payment.toMember}</Td>
                      <Td>{formatAppCurrency(payment.amount)}</Td>
                      <Td>{payment.note ?? '-'}</Td>
                    </Tr>
                  ))}
                  {activeHousehold.payments.length === 0 ? (
                    <Tr>
                      <Td colSpan={6}>No settlement payments recorded yet.</Td>
                    </Tr>
                  ) : null}
                </Tbody>
              </Table>
            </TableWrapper>
          </>
        ) : null}
      </PageSurface>
    </AppLayout>
  );
};
