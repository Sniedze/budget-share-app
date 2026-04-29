import type { FormEvent, KeyboardEvent } from 'react';
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

const RatioRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 120px auto;
  gap: ${spacing.sm};
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

type ExpenseMember = {
  name: string;
  selected: boolean;
  ratio: number;
};

type AddExpenseModalProps = {
  isOpen: boolean;
  householdName?: string;
  expenseTitle: string;
  expenseAmount: string;
  expenseDate: string;
  expenseGroup: string;
  expenseCategory: string;
  merchantOptions: string[];
  expenseGroupOptions: string[];
  categoryOptions: readonly string[];
  expenseMembers: ExpenseMember[];
  hasPredefinedSplit: boolean;
  expenseError: string | null;
  isSubmitting: boolean;
  isSubmitDisabled: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onMerchantChange: (value: string) => void;
  onMerchantKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onAmountChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onExpenseGroupChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onMemberToggle: (index: number, selected: boolean) => void;
  onMemberRatioChange: (index: number, ratio: number) => void;
};

export const AddExpenseModal = ({
  isOpen,
  householdName,
  expenseTitle,
  expenseAmount,
  expenseDate,
  expenseGroup,
  expenseCategory,
  merchantOptions,
  expenseGroupOptions,
  categoryOptions,
  expenseMembers,
  hasPredefinedSplit,
  expenseError,
  isSubmitting,
  isSubmitDisabled,
  onClose,
  onSubmit,
  onMerchantChange,
  onMerchantKeyDown,
  onAmountChange,
  onDateChange,
  onExpenseGroupChange,
  onCategoryChange,
  onMemberToggle,
  onMemberRatioChange,
}: AddExpenseModalProps): JSX.Element | null => {
  if (!isOpen) {
    return null;
  }

  return (
    <ModalOverlay>
      <ModalCard>
        <HeaderRow>
          <HeaderText>
            <SectionTitle>Add New Expense</SectionTitle>
            <SectionSubtitle>{householdName ?? 'Group'}</SectionSubtitle>
          </HeaderText>
          <Button type="button" $variant="secondary" $size="sm" onClick={onClose} aria-label="Close modal">
            <X size={14} />
          </Button>
        </HeaderRow>
        <form onSubmit={onSubmit}>
          <FormGrid>
            <SectionBlock>
              <FieldLabel>
                Merchant <RequiredMark>*</RequiredMark>
              </FieldLabel>
              <Input
                value={expenseTitle}
                onChange={(event) => onMerchantChange(event.target.value)}
                placeholder="e.g., Whole Foods Market"
                list="household-merchant-options"
                onKeyDown={onMerchantKeyDown}
              />
              {merchantOptions.length > 0 ? (
                <datalist id="household-merchant-options">
                  {merchantOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              ) : null}
            </SectionBlock>
            <RatioRow>
              <SectionBlock>
                <FieldLabel>
                  Amount <RequiredMark>*</RequiredMark>
                </FieldLabel>
                <Input
                  type="number"
                  value={expenseAmount}
                  onChange={(event) => onAmountChange(event.target.value)}
                  placeholder="0.00"
                />
              </SectionBlock>
              <SectionBlock>
                <FieldLabel>
                  Date <RequiredMark>*</RequiredMark>
                </FieldLabel>
                <Input type="date" value={expenseDate} onChange={(event) => onDateChange(event.target.value)} />
              </SectionBlock>
              <div />
              <div />
            </RatioRow>
            <SectionBlock>
              <FieldLabel>
                Expense Group <RequiredMark>*</RequiredMark>
              </FieldLabel>
              <ExpenseCategorySelect value={expenseGroup} onChange={(event) => onExpenseGroupChange(event.target.value)}>
                {expenseGroupOptions.map((groupOption) => (
                  <option key={groupOption} value={groupOption}>
                    {groupOption}
                  </option>
                ))}
              </ExpenseCategorySelect>
            </SectionBlock>
            <SectionBlock>
              <FieldLabel>
                Category <RequiredMark>*</RequiredMark>
              </FieldLabel>
              <ExpenseCategorySelect value={expenseCategory} onChange={(event) => onCategoryChange(event.target.value)}>
                {categoryOptions.map((categoryOption) => (
                  <option key={categoryOption} value={categoryOption}>
                    {categoryOption}
                  </option>
                ))}
              </ExpenseCategorySelect>
            </SectionBlock>
            <SectionBlock>
              <FieldLabel>Expense Group Split</FieldLabel>
              {hasPredefinedSplit ? (
                expenseMembers.map((member, index) => (
                  <SplitMemberRow key={`${member.name}-${index}`}>
                    <div />
                    <MutedText style={{ margin: 0 }}>{member.name}</MutedText>
                    <Input type="number" value={String(member.ratio)} disabled />
                  </SplitMemberRow>
                ))
              ) : (
                <>
                  <MutedText style={{ margin: 0 }}>
                    No predefined split for this expense group. Define the split below, and a new expense group will be created.
                  </MutedText>
                  {expenseMembers.map((member, index) => (
                    <SplitMemberRow key={`${member.name}-${index}`}>
                      <input
                        type="checkbox"
                        checked={member.selected}
                        onChange={(event) => onMemberToggle(index, event.target.checked)}
                      />
                      <MutedText style={{ margin: 0 }}>{member.name}</MutedText>
                      <Input
                        type="number"
                        value={String(member.ratio)}
                        onChange={(event) => onMemberRatioChange(index, Number(event.target.value))}
                        disabled={!member.selected}
                        placeholder="%"
                      />
                    </SplitMemberRow>
                  ))}
                </>
              )}
            </SectionBlock>
            {expenseError ? <ErrorText>{expenseError}</ErrorText> : null}
            <ActionsRow>
              <Button type="button" $variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" $variant="accent" $weight="semibold" disabled={isSubmitDisabled}>
                {isSubmitting ? 'Adding...' : 'Add Expense'}
              </Button>
            </ActionsRow>
          </FormGrid>
        </form>
      </ModalCard>
    </ModalOverlay>
  );
};
