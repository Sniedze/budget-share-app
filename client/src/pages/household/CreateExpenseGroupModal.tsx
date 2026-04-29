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

type TemplateMember = {
  name: string;
  selected: boolean;
  ratio: string;
};

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
  isTemplateSubmitDisabled: boolean;
  isSavingTemplate: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
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
  isTemplateSubmitDisabled,
  isSavingTemplate,
  onClose,
  onSubmit,
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
  if (!isOpen) {
    return null;
  }

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
      </ModalCard>
    </ModalOverlay>
  );
};
