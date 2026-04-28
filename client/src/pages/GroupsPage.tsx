import { Plus, Users } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Sidebar } from '../components/sections';
import { AppLayout, Badge, Button, Card, ErrorText, HeaderRow, HeaderText, Input, MutedText, PageSurface, SectionSubtitle, SectionTitle, Table, TableWrapper, Tbody, Td, Th, Thead, Tr } from '../components/ui';
import { colors, spacing } from '../styles/tokens';

type GroupMember = {
  name: string;
  email: string;
  ratio: number;
};

type GroupExpense = {
  date: string;
  description: string;
  paidBy: string;
  total: number;
  yourShare: number;
};

type GroupSummary = {
  id: string;
  name: string;
  description?: string;
  members: GroupMember[];
  totalSpent: number;
  yourShare: number;
  expenses: GroupExpense[];
};

const DEFAULT_MEMBERS: GroupMember[] = [
  { name: 'You', email: 'you@example.com', ratio: 50 },
  { name: '', email: '', ratio: 50 },
];

const getInitialMembers = (): GroupMember[] => {
  return DEFAULT_MEMBERS.map((member) => ({ ...member }));
};

const GroupsGrid = styled.div`
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: ${spacing.lg};

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
`;

const GroupList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
`;

const GroupCard = styled(Card)<{ $active: boolean }>`
  cursor: pointer;
  border-color: ${({ $active }) => ($active ? colors.accent : colors.border)};
  box-shadow: ${({ $active }) => ($active ? '0 8px 18px rgba(79,70,229,0.12)' : 'none')};
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${spacing.md};
`;

const StatCard = styled(Card)`
  display: grid;
  gap: ${spacing.xs};
  padding: ${spacing.md};
`;

const StatGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${spacing.md};
  margin: ${spacing.md} 0;

  @media (max-width: 780px) {
    grid-template-columns: 1fr;
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${spacing.xl};
  z-index: 20;
`;

const ModalCard = styled(Card)`
  width: min(860px, 95vw);
  max-height: 90vh;
  overflow: auto;
  padding: ${spacing.xl};
`;

const FormGrid = styled.div`
  display: grid;
  gap: ${spacing.md};
`;

const RatioRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 120px auto;
  gap: ${spacing.sm};
`;

const SectionBlock = styled.div`
  display: grid;
  gap: ${spacing.sm};
`;

const PresetRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing.sm};
`;

const DetailHeader = styled(Row)`
  margin-bottom: ${spacing.md};
`;

const FieldLabel = styled.label`
  font-size: 13px;
  color: ${colors.textPrimary};
  font-weight: 600;
`;

const RequiredMark = styled.span`
  color: ${colors.danger};
`;

const initialGroups: GroupSummary[] = [
  {
    id: 'g-1',
    name: 'Household',
    description: 'Main household costs',
    members: [
      { name: 'You', email: 'you@example.com', ratio: 50 },
      { name: 'Sarah', email: 'sarah@example.com', ratio: 30 },
      { name: 'Mike', email: 'mike@example.com', ratio: 20 },
    ],
    totalSpent: 2340.5,
    yourShare: 780.17,
    expenses: [
      { date: '2026-04-01', description: 'Rent Payment', paidBy: 'Sarah', total: 1500, yourShare: 500 },
      { date: '2026-04-15', description: 'Internet Bill', paidBy: 'You', total: 89.99, yourShare: 45 },
      { date: '2026-04-22', description: 'Water Bill', paidBy: 'Sarah', total: 67.51, yourShare: 33.76 },
    ],
  },
  {
    id: 'g-2',
    name: 'Utilities',
    description: 'Shared utility bills',
    members: [
      { name: 'You', email: 'you@example.com', ratio: 50 },
      { name: 'Sarah', email: 'sarah@example.com', ratio: 50 },
    ],
    totalSpent: 450,
    yourShare: 225,
    expenses: [{ date: '2026-04-09', description: 'Electricity', paidBy: 'You', total: 130.7, yourShare: 65.35 }],
  },
];

export const GroupsPage = (): JSX.Element => {
  const [groups, setGroups] = useState<GroupSummary[]>(initialGroups);
  const [activeGroupId, setActiveGroupId] = useState(initialGroups[0]?.id ?? '');
  const [isModalOpen, setModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [members, setMembers] = useState<GroupMember[]>(() => getInitialMembers());
  const [formError, setFormError] = useState<string | null>(null);

  const activeGroup = useMemo(
    () => groups.find((group) => group.id === activeGroupId) ?? groups[0],
    [activeGroupId, groups],
  );

  const resetCreateGroupForm = () => {
    setGroupName('');
    setDescription('');
    setFormError(null);
    setMembers(getInitialMembers());
  };

  const closeCreateModal = () => {
    setModalOpen(false);
    resetCreateGroupForm();
  };

  const updateMember = (index: number, patch: Partial<GroupMember>) => {
    setMembers((previous) =>
      previous.map((member, memberIndex) => (memberIndex === index ? { ...member, ...patch } : member)),
    );
  };

  const applyPreset = (ratios: number[]) => {
    if (members.length === 2) {
      setMembers((prev) => prev.map((m, index) => ({ ...m, ratio: ratios[index] ?? 0 })));
      return;
    }

    const evenRatio = Number((100 / members.length).toFixed(2));
    setMembers((prev) =>
      prev.map((m, index) => {
        if (index === prev.length - 1) {
          const allocated = evenRatio * (prev.length - 1);
          return { ...m, ratio: Number((100 - allocated).toFixed(2)) };
        }

        return { ...m, ratio: evenRatio };
      }),
    );
  };

  const onCreateGroup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!groupName.trim()) {
      setFormError('Group name is required.');
      return;
    }

    const hasPartialMemberRows = members.some((member) => {
      const hasName = member.name.trim().length > 0;
      const hasEmail = member.email.trim().length > 0;
      return hasName !== hasEmail;
    });
    if (hasPartialMemberRows) {
      setFormError('Each member row must include both name and email.');
      return;
    }

    const validMembers = members.filter((member) => member.name.trim() && member.email.trim());
    if (validMembers.length < 2) {
      setFormError('Please provide at least two complete members.');
      return;
    }

    const duplicateEmails = new Set<string>();
    const hasDuplicateEmails = validMembers.some((member) => {
      const normalizedEmail = member.email.trim().toLowerCase();
      if (duplicateEmails.has(normalizedEmail)) {
        return true;
      }
      duplicateEmails.add(normalizedEmail);
      return false;
    });
    if (hasDuplicateEmails) {
      setFormError('Each group member must have a unique email.');
      return;
    }

    const hasInvalidRatio = validMembers.some((member) => !Number.isFinite(member.ratio) || member.ratio <= 0);
    if (hasInvalidRatio) {
      setFormError('Each member ratio must be greater than 0.');
      return;
    }

    const totalRatio = validMembers.reduce((sum, member) => sum + member.ratio, 0);
    if (Math.abs(totalRatio - 100) > 0.01) {
      setFormError(`Member ratios must add up to 100% (current: ${totalRatio.toFixed(2)}%).`);
      return;
    }

    const newGroup: GroupSummary = {
      id: `g-${Date.now()}`,
      name: groupName.trim(),
      description: description.trim() || undefined,
      members: validMembers,
      totalSpent: 0,
      yourShare: 0,
      expenses: [],
    };
    setGroups((prev) => [newGroup, ...prev]);
    setActiveGroupId(newGroup.id);
    closeCreateModal();
  };

  return (
    <AppLayout>
      <Sidebar />
      <PageSurface>
        <HeaderRow>
          <HeaderText>
            <SectionTitle>Groups</SectionTitle>
            <SectionSubtitle>Manage expenses with household members.</SectionSubtitle>
          </HeaderText>
          <Button type="button" $variant="accent" $weight="semibold" onClick={() => setModalOpen(true)}>
            <Plus size={14} /> Create Group
          </Button>
        </HeaderRow>

        <GroupsGrid>
          <GroupList>
            {groups.map((group) => (
              <GroupCard key={group.id} $active={group.id === activeGroup?.id} onClick={() => setActiveGroupId(group.id)}>
                <Row>
                  <strong>{group.name}</strong>
                  <Badge $variant="accent">{group.members.length} members</Badge>
                </Row>
                <MutedText>Total Spent ${group.totalSpent.toFixed(2)}</MutedText>
                <MutedText>Your Share ${group.yourShare.toFixed(2)}</MutedText>
              </GroupCard>
            ))}
          </GroupList>

          {activeGroup ? (
            <Card>
              <DetailHeader>
                <div>
                  <SectionTitle>{activeGroup.name}</SectionTitle>
                  <MutedText>{activeGroup.members.map((member) => member.name).join(', ')}</MutedText>
                  {activeGroup.description ? <MutedText>{activeGroup.description}</MutedText> : null}
                </div>
                <Users size={16} color={colors.textMuted} />
              </DetailHeader>

              <StatGrid>
                <StatCard>
                  <MutedText>Total Spent</MutedText>
                  <strong>${activeGroup.totalSpent.toFixed(2)}</strong>
                </StatCard>
                <StatCard>
                  <MutedText>Your Share</MutedText>
                  <strong>${activeGroup.yourShare.toFixed(2)}</strong>
                </StatCard>
                <StatCard>
                  <MutedText>Members</MutedText>
                  <strong>{activeGroup.members.length}</strong>
                </StatCard>
              </StatGrid>

              <SectionSubtitle>Group Expenses</SectionSubtitle>
              <TableWrapper>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Date</Th>
                      <Th>Description</Th>
                      <Th>Paid By</Th>
                      <Th>Total</Th>
                      <Th>Your Share</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {activeGroup.expenses.map((expense) => (
                      <Tr key={`${expense.date}-${expense.description}`}>
                        <Td>{expense.date}</Td>
                        <Td>{expense.description}</Td>
                        <Td>{expense.paidBy}</Td>
                        <Td>${expense.total.toFixed(2)}</Td>
                        <Td>${expense.yourShare.toFixed(2)}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableWrapper>
            </Card>
          ) : null}
        </GroupsGrid>
      </PageSurface>

      {isModalOpen ? (
        <ModalOverlay>
          <ModalCard>
            <HeaderRow>
              <HeaderText>
                <SectionTitle>Create New Group</SectionTitle>
                <SectionSubtitle>Set default split ratios for this group.</SectionSubtitle>
              </HeaderText>
              <Button type="button" $variant="secondary" $size="sm" onClick={closeCreateModal}>
                Close
              </Button>
            </HeaderRow>
            <form onSubmit={onCreateGroup}>
              <FormGrid>
                <SectionBlock>
                  <FieldLabel>
                    Group Name <RequiredMark>*</RequiredMark>
                  </FieldLabel>
                  <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group Name" />
                  <FieldLabel>Description (optional)</FieldLabel>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" />
                </SectionBlock>

                <SectionBlock>
                  <FieldLabel>
                    Default Expense Split Ratio <RequiredMark>*</RequiredMark>
                  </FieldLabel>
                  <MutedText>Choose how this group splits shared costs by default.</MutedText>
                  <PresetRow>
                    <Button type="button" $variant="secondary" $size="sm" onClick={() => applyPreset([50, 50])}>50/50</Button>
                    <Button type="button" $variant="secondary" $size="sm" onClick={() => applyPreset([60, 40])}>60/40</Button>
                    <Button type="button" $variant="secondary" $size="sm" onClick={() => applyPreset([70, 30])}>70/30</Button>
                  </PresetRow>
                </SectionBlock>

                <SectionBlock>
                  <Row>
                    <SectionSubtitle>
                      Group Members <RequiredMark>*</RequiredMark>
                    </SectionSubtitle>
                    <Button type="button" $variant="secondary" $size="sm" onClick={() => setMembers((prev) => [...prev, { name: '', email: '', ratio: 0 }])}>
                      + Add Member
                    </Button>
                  </Row>
                  <MutedText>Each member needs name, email, and ratio. Ratios must total 100%.</MutedText>
                  {members.map((member, index) => (
                    <RatioRow key={`member-${index}`}>
                      <Input value={member.name} onChange={(e) => updateMember(index, { name: e.target.value })} placeholder="Name *" />
                      <Input value={member.email} onChange={(e) => updateMember(index, { email: e.target.value })} placeholder="Email *" />
                      <Input type="number" value={String(member.ratio)} onChange={(e) => updateMember(index, { ratio: Number(e.target.value) })} placeholder="% Ratio *" />
                      <Button type="button" $variant="danger" $size="sm" onClick={() => setMembers((prev) => prev.filter((_, idx) => idx !== index))} disabled={members.length <= 2}>
                        Remove
                      </Button>
                    </RatioRow>
                  ))}
                </SectionBlock>

                <Row>
                  <MutedText>Total ratio: {members.reduce((sum, member) => sum + member.ratio, 0)}%</MutedText>
                  <Button type="submit" $variant="accent" $weight="semibold">
                    Create Group
                  </Button>
                </Row>
                {formError ? <ErrorText>{formError}</ErrorText> : null}
              </FormGrid>
            </form>
          </ModalCard>
        </ModalOverlay>
      ) : null}
    </AppLayout>
  );
};
