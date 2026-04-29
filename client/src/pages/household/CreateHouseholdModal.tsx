import type { FormEvent } from 'react';
import styled from 'styled-components';
import { X } from 'lucide-react';
import { Button, Card, ErrorText, HeaderRow, HeaderText, Input, MutedText, SectionSubtitle, SectionTitle } from '../../components/ui';
import { colors, spacing } from '../../styles/tokens';

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

const SectionBlock = styled.div`
  display: grid;
  gap: ${spacing.sm};
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${spacing.md};
`;

const FieldLabel = styled.label`
  font-size: 13px;
  color: ${colors.textPrimary};
  font-weight: 600;
`;

const RequiredMark = styled.span`
  color: ${colors.danger};
`;

const MemberRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: ${spacing.sm};
`;

const InlineCheckboxLabel = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${spacing.sm};
  cursor: pointer;
  width: fit-content;
`;

const RatioRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 120px auto;
  gap: ${spacing.sm};
`;

const ExpenseCategorySelect = styled.select`
  font: inherit;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid ${colors.border};
  background: ${colors.surface};
  color: ${colors.textPrimary};
  min-width: 140px;
`;

type GroupMemberDraft = {
  name: string;
  email: string;
  ratio: number;
};

type DraftExpenseGroup = {
  category: string;
  customCategory: string;
};

type CreateHouseholdModalProps = {
  isOpen: boolean;
  editingHouseholdId: string | null;
  groupName: string;
  description: string;
  members: GroupMemberDraft[];
  createExpenseGroupsOnHouseholdCreate: boolean;
  householdExpenseGroups: DraftExpenseGroup[];
  predefinedExpenseGroups: readonly string[];
  formError: string | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onGroupNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onMemberChange: (index: number, next: Partial<GroupMemberDraft>) => void;
  onAddMember: () => void;
  onRemoveMember: (index: number) => void;
  onToggleCreateExpenseGroups: (enabled: boolean) => void;
  onExpenseGroupChange: (index: number, next: Partial<DraftExpenseGroup>) => void;
  onAddExpenseGroup: () => void;
  onRemoveExpenseGroup: (index: number) => void;
};

export const CreateHouseholdModal = ({
  isOpen,
  editingHouseholdId,
  groupName,
  description,
  members,
  createExpenseGroupsOnHouseholdCreate,
  householdExpenseGroups,
  predefinedExpenseGroups,
  formError,
  isSaving,
  onClose,
  onSubmit,
  onGroupNameChange,
  onDescriptionChange,
  onMemberChange,
  onAddMember,
  onRemoveMember,
  onToggleCreateExpenseGroups,
  onExpenseGroupChange,
  onAddExpenseGroup,
  onRemoveExpenseGroup,
}: CreateHouseholdModalProps): JSX.Element | null => {
  if (!isOpen) {
    return null;
  }

  return (
    <ModalOverlay>
      <ModalCard>
        <HeaderRow>
          <HeaderText>
            <SectionTitle>{editingHouseholdId ? 'Edit Household' : 'Create New Household'}</SectionTitle>
            <SectionSubtitle>
              {editingHouseholdId
                ? 'Update household details and members.'
                : 'Set household members and optional expense groups.'}
            </SectionSubtitle>
          </HeaderText>
          <Button type="button" $variant="secondary" $size="sm" onClick={onClose} aria-label="Close modal">
            <X size={14} />
          </Button>
        </HeaderRow>
        <form onSubmit={onSubmit}>
          <FormGrid>
            <SectionBlock>
              <FieldLabel>
                Group Name <RequiredMark>*</RequiredMark>
              </FieldLabel>
              <Input value={groupName} onChange={(event) => onGroupNameChange(event.target.value)} placeholder="Group Name" />
              <FieldLabel>Description (optional)</FieldLabel>
              <Input value={description} onChange={(event) => onDescriptionChange(event.target.value)} placeholder="Description (optional)" />
            </SectionBlock>

            <SectionBlock>
              <Row>
                <SectionSubtitle>
                  Group Members <RequiredMark>*</RequiredMark>
                </SectionSubtitle>
                <Button type="button" $variant="secondary" $size="sm" onClick={onAddMember}>
                  + Add Member
                </Button>
              </Row>
              <MutedText>Each member needs name and email. Ratios are auto-calculated equally.</MutedText>
              {members.map((member, index) => (
                <MemberRow key={`member-${index}`}>
                  <Input value={member.name} onChange={(event) => onMemberChange(index, { name: event.target.value })} placeholder="Name *" />
                  <Input value={member.email} onChange={(event) => onMemberChange(index, { email: event.target.value })} placeholder="Email *" />
                  <Button type="button" $variant="danger" $size="sm" onClick={() => onRemoveMember(index)} disabled={members.length <= 2}>
                    Remove
                  </Button>
                </MemberRow>
              ))}
            </SectionBlock>

            {!editingHouseholdId ? (
              <SectionBlock>
                <InlineCheckboxLabel htmlFor="create-expense-groups-on-household-create">
                  <input
                    id="create-expense-groups-on-household-create"
                    type="checkbox"
                    checked={createExpenseGroupsOnHouseholdCreate}
                    onChange={(event) => onToggleCreateExpenseGroups(event.target.checked)}
                  />
                  <SectionSubtitle style={{ margin: 0 }}>Create expense groups now</SectionSubtitle>
                </InlineCheckboxLabel>
                {createExpenseGroupsOnHouseholdCreate ? (
                  <>
                    <MutedText>
                      These categories will be created as expense groups using the same member ratios.
                    </MutedText>
                    {householdExpenseGroups.map((groupOption, index) => (
                      <RatioRow key={`expense-group-${index}`}>
                        <ExpenseCategorySelect
                          value={groupOption.category}
                          onChange={(event) => onExpenseGroupChange(index, { category: event.target.value })}
                        >
                          {predefinedExpenseGroups.map((categoryOption) => (
                            <option key={categoryOption} value={categoryOption}>
                              {categoryOption}
                            </option>
                          ))}
                          <option value="__custom__">Custom subcategory...</option>
                        </ExpenseCategorySelect>
                        {groupOption.category === '__custom__' ? (
                          <Input
                            value={groupOption.customCategory}
                            onChange={(event) => onExpenseGroupChange(index, { customCategory: event.target.value })}
                            placeholder="Custom category"
                          />
                        ) : (
                          <div />
                        )}
                        <div />
                        <Button
                          type="button"
                          $variant="danger"
                          $size="sm"
                          onClick={() => onRemoveExpenseGroup(index)}
                          disabled={householdExpenseGroups.length <= 1}
                        >
                          Remove
                        </Button>
                      </RatioRow>
                    ))}
                    <Button type="button" $variant="secondary" $size="sm" onClick={onAddExpenseGroup}>
                      + Add Expense Group
                    </Button>
                  </>
                ) : null}
              </SectionBlock>
            ) : null}

            <Row>
              <div />
              <Button type="submit" $variant="accent" $weight="semibold" disabled={isSaving}>
                {isSaving
                  ? editingHouseholdId
                    ? 'Saving...'
                    : 'Creating...'
                  : editingHouseholdId
                    ? 'Save Household'
                    : 'Create Household'}
              </Button>
            </Row>
            {formError ? <ErrorText>{formError}</ErrorText> : null}
          </FormGrid>
        </form>
      </ModalCard>
    </ModalOverlay>
  );
};
