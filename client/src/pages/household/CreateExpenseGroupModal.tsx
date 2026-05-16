import { useEffect, useState, type FormEvent } from 'react';
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

const FieldLabel = styled.label`
  font-size: 13px;
  color: ${colors.textPrimary};
  font-weight: 600;
`;

const RequiredMark = styled.span`
  color: ${colors.danger};
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

const RatioPresetRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing.sm};
`;

const SplitMemberRow = styled.div`
  display: grid;
  grid-template-columns: 24px 1fr 120px;
  align-items: center;
  gap: ${spacing.sm};
`;

const ActionsRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${spacing.md};
`;

const DangerZone = styled.div`
  display: grid;
  gap: ${spacing.sm};
  padding: ${spacing.md};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  background: #fef2f2;
`;

const DangerZoneTitle = styled.p`
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: ${colors.danger};
`;

const DangerActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing.sm};
`;

const ConfirmPanel = styled.div`
  display: grid;
  gap: ${spacing.md};
  padding: ${spacing.md};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  background: ${colors.surface};
`;

const SuccessPanel = styled.div`
  display: grid;
  gap: ${spacing.md};
  padding: ${spacing.md};
  border: 1px solid #86efac;
  border-radius: 8px;
  background: #f0fdf4;
  color: #166534;
`;

type TemplateMember = {
  name: string;
  selected: boolean;
  ratio: string;
};

type PendingConfirm = 'opt-out' | 'delete';

type CreateExpenseGroupModalProps = {
  isOpen: boolean;
  householdName?: string;
  editingTemplateCategory: string | null;
  templateCategory: string;
  customTemplateCategory: string;
  createTemplateCategoryOptions: string[];
  existingTemplateForSelectedCategory: boolean;
  selectedTemplateMembersCount: number;
  templateMembers: TemplateMember[];
  templateError: string | null;
  templateSuccessMessage: string | null;
  isTemplateSubmitDisabled: boolean;
  isSavingTemplate: boolean;
  isDecliningExpenseGroup: boolean;
  isDeletingExpenseGroup: boolean;
  canOptOutOfExpenseGroup: boolean;
  linkedExpenseCount: number;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onConfirmOptOut: () => Promise<void>;
  onConfirmDelete: () => Promise<void>;
  onTemplateCategoryChange: (value: string) => void;
  onCustomTemplateCategoryChange: (value: string) => void;
  onSplitModeEqual: () => void;
  onSplitMode5050: () => void;
  onSplitMode6040: () => void;
  onSplitMode7030: () => void;
  onSplitModeCustom: () => void;
  onTemplateMemberToggle: (index: number, selected: boolean) => void;
  onTemplateMemberRatioChange: (index: number, ratio: string) => void;
};

export const CreateExpenseGroupModal = ({
  isOpen,
  householdName,
  editingTemplateCategory,
  templateCategory,
  customTemplateCategory,
  createTemplateCategoryOptions,
  existingTemplateForSelectedCategory,
  selectedTemplateMembersCount,
  templateMembers,
  templateError,
  templateSuccessMessage,
  isTemplateSubmitDisabled,
  isSavingTemplate,
  isDecliningExpenseGroup,
  isDeletingExpenseGroup,
  canOptOutOfExpenseGroup,
  linkedExpenseCount,
  onClose,
  onSubmit,
  onConfirmOptOut,
  onConfirmDelete,
  onTemplateCategoryChange,
  onCustomTemplateCategoryChange,
  onSplitModeEqual,
  onSplitMode5050,
  onSplitMode6040,
  onSplitMode7030,
  onSplitModeCustom,
  onTemplateMemberToggle,
  onTemplateMemberRatioChange,
}: CreateExpenseGroupModalProps): JSX.Element | null => {
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPendingConfirm(null);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const isPerformingDangerAction = isDecliningExpenseGroup || isDeletingExpenseGroup;
  const expenseGroupLabel = editingTemplateCategory ?? 'this expense group';

  const handleConfirm = async (): Promise<void> => {
    if (pendingConfirm === 'opt-out') {
      await onConfirmOptOut();
    } else if (pendingConfirm === 'delete') {
      await onConfirmDelete();
    }
    setPendingConfirm(null);
  };

  return (
    <ModalOverlay>
      <ModalCard>
        <HeaderRow>
          <HeaderText>
            <SectionTitle>{editingTemplateCategory ? 'Edit Expense Group' : 'Create Expense Group'}</SectionTitle>
            <SectionSubtitle>{householdName ?? 'Household'}</SectionSubtitle>
          </HeaderText>
          <Button type="button" $variant="secondary" $size="sm" onClick={onClose} aria-label="Close modal">
            <X size={14} />
          </Button>
        </HeaderRow>

        {templateSuccessMessage ? (
          <SuccessPanel role="status">
            <strong>Done</strong>
            <p style={{ margin: 0 }}>{templateSuccessMessage}</p>
            <Button type="button" $variant="accent" $weight="semibold" onClick={onClose}>
              Close
            </Button>
          </SuccessPanel>
        ) : pendingConfirm ? (
          <ConfirmPanel>
            <strong>
              {pendingConfirm === 'opt-out' ? 'Opt out of expense group?' : 'Delete expense group?'}
            </strong>
            {pendingConfirm === 'opt-out' ? (
              <MutedText style={{ margin: 0 }}>
                You will be removed from the split for <strong>{expenseGroupLabel}</strong>. Other members are not
                affected. Existing expenses stay as they are.
              </MutedText>
            ) : (
              <MutedText style={{ margin: 0 }}>
                This removes <strong>{expenseGroupLabel}</strong> and its default split settings.
                {linkedExpenseCount > 0
                  ? ` ${linkedExpenseCount} existing ${linkedExpenseCount === 1 ? 'expense remains' : 'expenses remain'} in the household history.`
                  : ' No expenses are linked to this group yet.'}
              </MutedText>
            )}
            <ActionsRow>
              <Button
                type="button"
                $variant="secondary"
                disabled={isPerformingDangerAction}
                onClick={() => setPendingConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                $variant="danger"
                $weight="semibold"
                disabled={isPerformingDangerAction}
                onClick={() => void handleConfirm()}
              >
                {isPerformingDangerAction
                  ? 'Working...'
                  : pendingConfirm === 'opt-out'
                    ? 'Yes, opt out'
                    : 'Yes, delete'}
              </Button>
            </ActionsRow>
          </ConfirmPanel>
        ) : (
          <form onSubmit={onSubmit}>
            <FormGrid>
              <SectionBlock>
                <FieldLabel>
                  Expense Group Category <RequiredMark>*</RequiredMark>
                </FieldLabel>
                <ExpenseCategorySelect
                  value={templateCategory}
                  onChange={(event) => onTemplateCategoryChange(event.target.value)}
                  disabled={Boolean(editingTemplateCategory)}
                >
                  {createTemplateCategoryOptions.map((categoryOption) => (
                    <option key={categoryOption} value={categoryOption}>
                      {categoryOption}
                    </option>
                  ))}
                  <option value="__custom__">Custom subcategory...</option>
                </ExpenseCategorySelect>
                {templateCategory === '__custom__' ? (
                  <Input
                    value={customTemplateCategory}
                    onChange={(event) => onCustomTemplateCategoryChange(event.target.value)}
                    placeholder="e.g., Kids activities"
                  />
                ) : null}
                {existingTemplateForSelectedCategory ? (
                  <MutedText style={{ margin: 0 }}>
                    This expense group already exists. Saving will update its split configuration.
                  </MutedText>
                ) : null}
              </SectionBlock>

              <SectionBlock>
                <FieldLabel>
                  Members and Ratios <RequiredMark>*</RequiredMark>
                </FieldLabel>
                {selectedTemplateMembersCount < 2 ? (
                  <ErrorText>Choose at least two members.</ErrorText>
                ) : null}
                <RatioPresetRow>
                  <Button type="button" $variant="secondary" $size="sm" onClick={onSplitModeEqual}>
                    Equal
                  </Button>
                  {selectedTemplateMembersCount === 2 ? (
                    <>
                      <Button type="button" $variant="secondary" $size="sm" onClick={onSplitMode5050}>
                        50/50
                      </Button>
                      <Button type="button" $variant="secondary" $size="sm" onClick={onSplitMode6040}>
                        60/40
                      </Button>
                      <Button type="button" $variant="secondary" $size="sm" onClick={onSplitMode7030}>
                        70/30
                      </Button>
                    </>
                  ) : null}
                  <Button type="button" $variant="secondary" $size="sm" onClick={onSplitModeCustom}>
                    Custom
                  </Button>
                </RatioPresetRow>
                {templateMembers.map((member, index) => (
                  <SplitMemberRow key={`${member.name}-template-${index}`}>
                    <input
                      type="checkbox"
                      checked={member.selected}
                      onChange={(event) => onTemplateMemberToggle(index, event.target.checked)}
                    />
                    <MutedText style={{ margin: 0 }}>{member.name}</MutedText>
                    <Input
                      type="number"
                      value={member.selected ? String(member.ratio) : ''}
                      onChange={(event) => onTemplateMemberRatioChange(index, event.target.value)}
                      disabled={!member.selected}
                      placeholder="%"
                    />
                  </SplitMemberRow>
                ))}
              </SectionBlock>

              {editingTemplateCategory ? (
                <DangerZone>
                  <DangerZoneTitle>Member actions</DangerZoneTitle>
                  {canOptOutOfExpenseGroup ? (
                    <MutedText style={{ margin: 0 }}>
                      Opt out if you should not be part of this expense group&apos;s default split.
                    </MutedText>
                  ) : (
                    <MutedText style={{ margin: 0 }}>
                      You are not currently included in this expense group&apos;s split.
                    </MutedText>
                  )}
                  <DangerActions>
                    <Button
                      type="button"
                      $variant="danger"
                      $size="sm"
                      disabled={!canOptOutOfExpenseGroup || isPerformingDangerAction}
                      onClick={() => setPendingConfirm('opt-out')}
                    >
                      Opt out of expense group
                    </Button>
                  </DangerActions>
                  <DangerZoneTitle style={{ marginTop: spacing.sm }}>Delete expense group</DangerZoneTitle>
                  <MutedText style={{ margin: 0 }}>
                    Removes this expense group and its default split. Past expenses are kept in the household.
                  </MutedText>
                  <DangerActions>
                    <Button
                      type="button"
                      $variant="danger"
                      $size="sm"
                      disabled={isPerformingDangerAction}
                      onClick={() => setPendingConfirm('delete')}
                    >
                      Delete expense group
                    </Button>
                  </DangerActions>
                </DangerZone>
              ) : null}

              {templateError ? <ErrorText>{templateError}</ErrorText> : null}
              <ActionsRow>
                <Button type="button" $variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" $variant="accent" $weight="semibold" disabled={isTemplateSubmitDisabled}>
                  {isSavingTemplate
                    ? 'Saving...'
                    : editingTemplateCategory
                      ? 'Save Expense Group'
                      : existingTemplateForSelectedCategory
                        ? 'Update Expense Group'
                        : 'Create Expense Group'}
                </Button>
              </ActionsRow>
            </FormGrid>
          </form>
        )}
      </ModalCard>
    </ModalOverlay>
  );
};
