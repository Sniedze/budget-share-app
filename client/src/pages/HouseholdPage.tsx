import { Plus } from 'lucide-react';
import styled from 'styled-components';
import { Sidebar } from '../components/sections/Sidebar';
import { AppLayout, Badge, Button, Card, ErrorText, HeaderRow, HeaderText, MutedText, PageSurface, SectionSubtitle, SectionTitle, Table, TableWrapper, Tbody, Td, Th, Thead, Tr, UserMenu } from '../components/ui';
import { AddExpenseModal } from './household/AddExpenseModal';
import { CreateExpenseGroupModal } from './household/CreateExpenseGroupModal';
import { CreateHouseholdModal } from './household/CreateHouseholdModal';
import { PendingInvitationsPanel } from './household/PendingInvitationsPanel';
import { useHouseholdPageState } from './household/useHouseholdPageState';
import { resolveExpenseGroupFromSuggestion } from '../features/expenses';
import { formatAppCurrency, formatCurrency } from '../format/currency';
import { splitExpenseTitleForDisplay } from '../format/expenseTitle';
import { colors, spacing } from '../styles/tokens';

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

const GroupSectionTitle = styled(SectionTitle)`
  text-align: center;
  font-size: 20px;
  margin: 0 0 ${spacing.md};
`;

const GroupCard = styled(Card)<{ $active: boolean }>`
  cursor: pointer;
  border-color: ${({ $active }) => ($active ? colors.accent : colors.border)};
  box-shadow: ${({ $active }) => ($active ? '0 8px 18px rgba(79,70,229,0.12)' : 'none')};
`;

const HouseholdSummaryCard = styled(Card)`
  margin-bottom: ${spacing.lg};
  border: 1px solid ${colors.border};
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${spacing.md};
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.sm};
  margin-left: auto;
`;

const ExpenseGroupHeading = styled.h2`
  margin: 0;
  font-size: 30px;
  line-height: 1.2;
  color: ${colors.textPrimary};
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

const DetailHeader = styled(Row)`
  margin-bottom: ${spacing.md};
`;

const ExpenseGroupsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: ${spacing.md};
  margin: ${spacing.md} 0 ${spacing.lg};
`;

const ExpenseGroupCard = styled(Card)`
  display: grid;
  gap: ${spacing.xs};
  padding: ${spacing.md};
`;

const ExpenseGroupMembersGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: ${spacing.sm};
  margin-top: ${spacing.xs};
`;

const ExpenseGroupMemberCard = styled(Card)`
  display: grid;
  gap: 2px;
  padding: ${spacing.sm};
`;

export const HouseholdPage = (): JSX.Element => {
  const {
    currentUserName,
    PREDEFINED_EXPENSE_GROUPS,
    loading,
    error,
    activeGroup,
    setModalOpen,
    openAddExpenseModal,
    activeExpenseGroup,
    openEditHouseholdModal,
    openTemplateModal,
    splitTemplates,
    ALL_HOUSEHOLD_EXPENSE_GROUPS,
    isViewingAllExpenseGroups,
    expenseCountByGroupCategory,
    setActiveExpenseGroupCategory,
    activeExpenseGroupExpenses,
    activeExpenseGroupTotals,
    openEditTemplateModal,
    templateSuccessMessage,
    canOptOutOfEditingTemplate,
    linkedExpenseCountForEditingTemplate,
    confirmOptOutOfEditingTemplate,
    confirmDeleteEditingTemplate,
    isDecliningExpenseGroup,
    isDeletingExpenseGroup,
    isModalOpen,
    editingHouseholdId,
    groupName,
    setGroupName,
    description,
    setDescription,
    members,
    createExpenseGroupsOnHouseholdCreate,
    householdExpenseGroups,
    formError,
    creatingGroup,
    updatingGroup,
    savingTemplate,
    closeCreateModal,
    onCreateGroup,
    updateMember,
    setMembers,
    setCreateExpenseGroupsOnHouseholdCreate,
    setHouseholdExpenseGroups,
    isExpenseModalOpen,
    expenseTitle,
    expenseAmount,
    expenseDate,
    expenseGroup,
    expenseCategory,
    merchantOptions,
    expenseGroupOptions,
    sortedExpenseCategories,
    expenseMembers,
    selectedExpenseTemplate,
    expenseIsPrivate,
    setExpenseIsPrivate,
    expenseError,
    isCreatingExpense,
    isExpenseSubmitDisabled,
    closeExpenseModal,
    onAddExpense,
    merchantCategoryLookup,
    onMerchantSearchEnter,
    setExpenseAmount,
    setExpenseDate,
    setExpenseGroup,
    setExpenseCategory,
    setExpenseMembers,
    setExpenseTitle,
    isTemplateModalOpen,
    templateCategory,
    customTemplateCategory,
    createTemplateCategoryOptions,
    existingTemplateForSelectedCategory,
    selectedTemplateMembersCount,
    templateMembers,
    templateError,
    isTemplateSubmitDisabled,
    closeTemplateModal,
    onCreateExpenseGroup,
    setTemplateCategory,
    setCustomTemplateCategory,
    setTemplateSplitMode,
    clearTemplateRatiosForCustom,
    setTemplateMembers,
    editingTemplateCategory,
  } = useHouseholdPageState();

  const getExpenseRatioLabel = (
    total: number,
    yourShare: number,
    explicitRatio?: number,
  ): string => {
    if (Number.isFinite(explicitRatio) && (explicitRatio ?? 0) > 0) {
      return `${Number(explicitRatio).toFixed(2)}%`;
    }
    if (!Number.isFinite(total) || total <= 0) {
      return '-';
    }
    return `${((yourShare / total) * 100).toFixed(2)}%`;
  };

  return (
    <AppLayout>
      <Sidebar />
      <PageSurface>
        <HeaderRow>
          <HeaderText>
            <SectionTitle>{activeGroup?.name ?? 'Households'}</SectionTitle>
            <SectionSubtitle>
              {activeGroup ? 'Household overview and expense groups.' : 'Manage households and expense groups.'}
            </SectionSubtitle>
          </HeaderText>
          <HeaderActions>
            <Button
              type="button"
              $variant="secondary"
              $weight="semibold"
              onClick={() => openAddExpenseModal(activeExpenseGroup?.category)}
              disabled={!activeExpenseGroup}
            >
              + Add Expense
            </Button>
            <Button type="button" $variant="secondary" $weight="semibold" onClick={openEditHouseholdModal} disabled={!activeGroup}>
              Edit Household
            </Button>
            <Button type="button" $variant="accent" $weight="semibold" onClick={() => setModalOpen(true)}>
              <Plus size={14} /> Create Household
            </Button>
            <UserMenu />
          </HeaderActions>
        </HeaderRow>

        {activeGroup ? (
          <HouseholdSummaryCard>
            <DetailHeader>
              <div>
                <SectionSubtitle style={{ margin: 0 }}>Household Summary</SectionSubtitle>
                <MutedText style={{ margin: 0 }}>
                  Members: {activeGroup.members.map((member) => member.name).join(', ')}
                </MutedText>
                {activeGroup.description ? <MutedText>{activeGroup.description}</MutedText> : null}
              </div>
            </DetailHeader>

            <StatGrid>
              <StatCard>
                <MutedText>Total Spent</MutedText>
                <strong>{formatAppCurrency(activeGroup.totalSpent)}</strong>
              </StatCard>
              <StatCard>
                <MutedText>Your Share</MutedText>
                <strong>{formatAppCurrency(activeGroup.yourShare)}</strong>
              </StatCard>
              <StatCard>
                <MutedText>Members</MutedText>
                <strong>{activeGroup.members.length}</strong>
              </StatCard>
            </StatGrid>
            <PendingInvitationsPanel
              groupId={activeGroup.id}
              invitations={activeGroup.pendingInvitations ?? []}
            />
          </HouseholdSummaryCard>
        ) : null}

        <GroupSectionTitle>Household Expense Groups</GroupSectionTitle>
        <GroupsGrid>
          <GroupList>
            <Button
              type="button"
              $variant="secondary"
              $weight="semibold"
              onClick={openTemplateModal}
              disabled={!activeGroup}
            >
              + Create Expense Group
            </Button>
            {loading ? <MutedText>Loading expense groups...</MutedText> : null}
            {error ? <ErrorText>{error.message}</ErrorText> : null}
            {!loading && !error && !activeGroup ? <MutedText>No households yet. Create your first one.</MutedText> : null}
            {!loading && !error && activeGroup && splitTemplates.length === 0 ? (
              <MutedText>No expense groups yet. Create your first one.</MutedText>
            ) : null}
            {activeGroup ? (
              <GroupCard
                $active={isViewingAllExpenseGroups}
                onClick={() => setActiveExpenseGroupCategory(ALL_HOUSEHOLD_EXPENSE_GROUPS)}
              >
                <Row>
                  <strong>All expenses</strong>
                  <Badge $variant="accent">{activeGroup.expenses.length}</Badge>
                </Row>
                <MutedText>Every household expense, including from Personal Finances.</MutedText>
              </GroupCard>
            ) : null}
            {splitTemplates.map((template) => {
              const expenseCount =
                expenseCountByGroupCategory.get(template.category.trim().toLowerCase()) ?? 0;
              return (
              <GroupCard
                key={template.id}
                $active={!isViewingAllExpenseGroups && template.category === activeExpenseGroup?.category}
                onClick={() => setActiveExpenseGroupCategory(template.category)}
              >
                <Row>
                  <strong>{template.category}</strong>
                  <Badge $variant="accent">
                    {expenseCount} {expenseCount === 1 ? 'expense' : 'expenses'}
                  </Badge>
                </Row>
                <MutedText>{template.splitDetails.map((item) => item.participant).join(', ')}</MutedText>
              </GroupCard>
            );
            })}
          </GroupList>

          {activeGroup ? (
            <Card>
              <Row>
                <ExpenseGroupHeading>
                  {isViewingAllExpenseGroups
                    ? 'All household expenses'
                    : activeExpenseGroup
                      ? `${activeExpenseGroup.category} Expense Group`
                      : 'Select Expense Group'}
                </ExpenseGroupHeading>
                {isViewingAllExpenseGroups || activeExpenseGroup ? (
                  <Row>
                    {!isViewingAllExpenseGroups && activeExpenseGroup ? (
                      <Button
                        type="button"
                        $variant="secondary"
                        $size="sm"
                        onClick={() => openEditTemplateModal(activeExpenseGroup)}
                      >
                        Edit Expense Group
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      $variant="secondary"
                      $size="sm"
                      onClick={() => openAddExpenseModal(activeExpenseGroup?.category)}
                    >
                      + Add Expense
                    </Button>
                  </Row>
                ) : null}
              </Row>
              {isViewingAllExpenseGroups || activeExpenseGroup ? (
                <>
                  {isViewingAllExpenseGroups ? (
                    <MutedText>
                      Expenses added on Personal Finances appear here when split type is Shared and a household is
                      selected.
                    </MutedText>
                  ) : activeExpenseGroup ? (
                    <ExpenseGroupsGrid>
                      <ExpenseGroupCard>
                        <strong>Members</strong>
                        <ExpenseGroupMembersGrid>
                          {activeExpenseGroup.splitDetails.map((allocation) => (
                            <ExpenseGroupMemberCard key={`${activeExpenseGroup.id}-${allocation.participant}`}>
                              <strong>{allocation.participant}</strong>
                              <MutedText style={{ margin: 0 }}>{allocation.ratio}% share</MutedText>
                            </ExpenseGroupMemberCard>
                          ))}
                        </ExpenseGroupMembersGrid>
                      </ExpenseGroupCard>
                      <ExpenseGroupCard>
                        <strong>Summary</strong>
                        <MutedText style={{ margin: 0 }}>Expenses: {activeExpenseGroupExpenses.length}</MutedText>
                        <MutedText style={{ margin: 0 }}>
                          Total spent: {formatAppCurrency(activeExpenseGroupTotals.total)}
                        </MutedText>
                        <MutedText style={{ margin: 0 }}>
                          Your share: {formatAppCurrency(activeExpenseGroupTotals.yourShare)}
                        </MutedText>
                      </ExpenseGroupCard>
                    </ExpenseGroupsGrid>
                  ) : null}
                  <SectionSubtitle>
                    {isViewingAllExpenseGroups ? 'All Expenses' : 'Expense Group Expenses'}
                  </SectionSubtitle>
                  <TableWrapper>
                    <Table>
                      <Thead>
                        <Tr>
                          <Th>Date</Th>
                          <Th>Merchant</Th>
                          <Th>Description</Th>
                          <Th>Category</Th>
                          {isViewingAllExpenseGroups ? <Th>Expense Group</Th> : null}
                          <Th>Paid By</Th>
                          <Th>Total</Th>
                          <Th>Expense Ratio</Th>
                          <Th>Your Share</Th>
                          <Th>Private</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {activeExpenseGroupExpenses.map((expense) => {
                          const { merchant, description } = splitExpenseTitleForDisplay(expense.description);
                          return (
                          <Tr key={`${expense.date}-${expense.description}-${expense.total}`}>
                            <Td>{expense.date}</Td>
                            <Td>{merchant}</Td>
                            <Td>{description || '—'}</Td>
                            <Td>{expense.category}</Td>
                            {isViewingAllExpenseGroups ? (
                              <Td>{expense.expenseGroup ?? expense.category}</Td>
                            ) : null}
                            <Td>{expense.paidBy}</Td>
                            <Td>{formatCurrency(expense.total, expense.currency)}</Td>
                            <Td>{getExpenseRatioLabel(
                              expense.total,
                              expense.yourShare,
                              isViewingAllExpenseGroups
                                ? undefined
                                : activeExpenseGroup?.splitDetails.find(
                                    (allocation) =>
                                      currentUserName !== null &&
                                      allocation.participant.trim().toLowerCase() ===
                                        currentUserName.trim().toLowerCase(),
                                  )?.ratio,
                            )}</Td>
                            <Td>{formatCurrency(expense.yourShare, expense.currency)}</Td>
                            <Td>{expense.isPrivate ? 'Yes' : '—'}</Td>
                          </Tr>
                          );
                        })}
                        {activeExpenseGroupExpenses.length === 0 ? (
                          <Tr key="no-expense-group-expenses">
                            <Td colSpan={isViewingAllExpenseGroups ? 10 : 9}>
                              {isViewingAllExpenseGroups
                                ? 'No household expenses yet. Add one here or on Personal Finances with split type Shared.'
                                : 'No expenses for this expense group yet.'}
                            </Td>
                          </Tr>
                        ) : null}
                      </Tbody>
                    </Table>
                  </TableWrapper>
                </>
              ) : (
                <MutedText>Select an expense group from the left.</MutedText>
              )}
            </Card>
          ) : null}
        </GroupsGrid>
      </PageSurface>

      <CreateHouseholdModal
        isOpen={isModalOpen}
        editingHouseholdId={editingHouseholdId}
        groupName={groupName}
        description={description}
        members={members}
        createExpenseGroupsOnHouseholdCreate={createExpenseGroupsOnHouseholdCreate}
        householdExpenseGroups={householdExpenseGroups}
        predefinedExpenseGroups={PREDEFINED_EXPENSE_GROUPS}
        formError={formError}
        isSaving={creatingGroup || updatingGroup || savingTemplate}
        onClose={closeCreateModal}
        onSubmit={onCreateGroup}
        onGroupNameChange={setGroupName}
        onDescriptionChange={setDescription}
        onMemberChange={updateMember}
        onAddMember={() => setMembers((prev) => [...prev, { userId: null, name: '', email: '', ratio: 0 }])}
        onRemoveMember={(index) => setMembers((prev) => prev.filter((_, idx) => idx !== index))}
        onToggleCreateExpenseGroups={(enabled) => {
          setCreateExpenseGroupsOnHouseholdCreate(enabled);
          if (enabled && householdExpenseGroups.length === 0) {
            setHouseholdExpenseGroups([{ category: PREDEFINED_EXPENSE_GROUPS[0], customCategory: '' }]);
          }
          if (!enabled) {
            setHouseholdExpenseGroups([]);
          }
        }}
        onExpenseGroupChange={(index, next) =>
          setHouseholdExpenseGroups((previous) =>
            previous.map((item, itemIndex) => (itemIndex === index ? { ...item, ...next } : item)),
          )
        }
        onAddExpenseGroup={() =>
          setHouseholdExpenseGroups((previous) => [
            ...previous,
            { category: PREDEFINED_EXPENSE_GROUPS[0], customCategory: '' },
          ])
        }
        onRemoveExpenseGroup={(index) =>
          setHouseholdExpenseGroups((previous) =>
            previous.filter((_, itemIndex) => itemIndex !== index),
          )
        }
      />

      <AddExpenseModal
        isOpen={isExpenseModalOpen}
        householdName={activeGroup?.name}
        expenseTitle={expenseTitle}
        expenseAmount={expenseAmount}
        expenseDate={expenseDate}
        expenseGroup={expenseGroup}
        expenseCategory={expenseCategory}
        merchantOptions={merchantOptions}
        expenseGroupOptions={expenseGroupOptions}
        categoryOptions={sortedExpenseCategories}
        expenseMembers={expenseMembers}
        hasPredefinedSplit={Boolean(selectedExpenseTemplate)}
        expenseIsPrivate={expenseIsPrivate}
        onExpensePrivateChange={setExpenseIsPrivate}
        expenseError={expenseError}
        isSubmitting={isCreatingExpense}
        isSubmitDisabled={isExpenseSubmitDisabled}
        onClose={closeExpenseModal}
        onSubmit={onAddExpense}
        onMerchantChange={(merchant) => {
          setExpenseTitle(merchant);
          const matched = merchantCategoryLookup.get(merchant.trim().toLowerCase());
          if (!matched) {
            return;
          }
          setExpenseCategory(matched.category);
          const resolvedGroup = resolveExpenseGroupFromSuggestion(matched, expenseGroupOptions);
          if (resolvedGroup) {
            setExpenseGroup(resolvedGroup);
          }
        }}
        onMerchantKeyDown={onMerchantSearchEnter}
        onAmountChange={setExpenseAmount}
        onDateChange={setExpenseDate}
        onExpenseGroupChange={setExpenseGroup}
        onCategoryChange={setExpenseCategory}
        onMemberToggle={(index, selected) =>
          setExpenseMembers((previous) =>
            previous.map((item, itemIndex) => (itemIndex === index ? { ...item, selected } : item)),
          )
        }
        onMemberRatioChange={(index, ratio) =>
          setExpenseMembers((previous) =>
            previous.map((item, itemIndex) => (itemIndex === index ? { ...item, ratio } : item)),
          )
        }
      />

      <CreateExpenseGroupModal
        isOpen={isTemplateModalOpen}
        householdName={activeGroup?.name}
        editingTemplateCategory={editingTemplateCategory}
        templateCategory={templateCategory}
        customTemplateCategory={customTemplateCategory}
        createTemplateCategoryOptions={createTemplateCategoryOptions}
        existingTemplateForSelectedCategory={Boolean(existingTemplateForSelectedCategory)}
        selectedTemplateMembersCount={selectedTemplateMembersCount}
        templateMembers={templateMembers}
        templateError={templateError}
        templateSuccessMessage={templateSuccessMessage}
        isTemplateSubmitDisabled={isTemplateSubmitDisabled}
        isSavingTemplate={savingTemplate}
        isDecliningExpenseGroup={isDecliningExpenseGroup}
        isDeletingExpenseGroup={isDeletingExpenseGroup}
        canOptOutOfExpenseGroup={canOptOutOfEditingTemplate}
        linkedExpenseCount={linkedExpenseCountForEditingTemplate}
        onClose={closeTemplateModal}
        onSubmit={onCreateExpenseGroup}
        onConfirmOptOut={confirmOptOutOfEditingTemplate}
        onConfirmDelete={confirmDeleteEditingTemplate}
        onTemplateCategoryChange={setTemplateCategory}
        onCustomTemplateCategoryChange={setCustomTemplateCategory}
        onSplitModeEqual={() => setTemplateSplitMode('equal')}
        onSplitMode5050={() => setTemplateSplitMode('ratio_50_50')}
        onSplitMode6040={() => setTemplateSplitMode('ratio_60_40')}
        onSplitMode7030={() => setTemplateSplitMode('ratio_70_30')}
        onSplitModeCustom={() => {
          setTemplateSplitMode('custom');
          clearTemplateRatiosForCustom();
        }}
        onTemplateMemberToggle={(index, selected) =>
          setTemplateMembers((previous) =>
            previous.map((item, itemIndex) =>
              itemIndex === index
                ? {
                    ...item,
                    selected,
                    ratio: selected ? item.ratio : '',
                  }
                : item,
            ),
          )
        }
        onTemplateMemberRatioChange={(index, ratio) =>
          setTemplateMembers((previous) =>
            previous.map((item, itemIndex) =>
              itemIndex === index ? { ...item, ratio } : item,
            ),
          )
        }
      />
    </AppLayout>
  );
};
