import type {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
} from 'react';
import styled from 'styled-components';
import {
  Button,
  Card,
  Input,
  MutedText,
} from '../../../components/ui';
import type {
  SplitAllocationInput,
  SplitType,
} from '../types';
import { APP_CURRENCY_CODE, formatAppCurrency } from '../../../format/currency';
import { spacing } from '../../../styles/tokens';

const Form = styled.form`
  display: grid;
  gap: ${spacing.md};
`;

const FormCard = styled(Card)`
  margin-bottom: ${spacing.xl};
  background: #f8faff;
  border-color: #dbe5ff;
`;

const FormHeader = styled.div`
  display: grid;
  gap: 2px;
  margin-bottom: ${spacing.md};
`;

const FormTitle = styled.h3`
  margin: 0;
  font-size: 18px;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: ${spacing.sm};

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`;

const ModeRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${spacing.sm};

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`;

const Actions = styled.div`
  display: flex;
  gap: ${spacing.sm};
`;

const SectionLabel = styled.p`
  margin: 0;
  font-size: 13px;
  font-weight: 600;
`;

const FieldGroup = styled.label`
  display: grid;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
`;

const LabelText = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
`;

const RequiredMark = styled.span`
  color: #dc2626;
`;

const SplitDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SplitRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 120px auto;
  gap: 8px;
`;

const QueuedTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
`;

const QueuedHeadCell = styled.th`
  text-align: left;
  padding: 6px 8px;
  border-bottom: 1px solid #dbe5ff;
  color: #4b5563;
`;

const QueuedCell = styled.td`
  padding: 8px;
  border-bottom: 1px solid #e5edff;
`;

type ExpenseFormProps = {
  title: string;
  amount: string;
  transactionDate: string;
  category: string;
  groupId: string;
  expenseGroup: string;
  isPrivate: boolean;
  split: SplitType;
  splitDetails: SplitAllocationInput[];
  categoryOptions: string[];
  merchantOptions: string[];
  householdOptions: Array<{ id: string; name: string }>;
  expenseGroupOptions: string[];
  editingId: string | null;
  isMutating: boolean;
  onInputChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSplitDetailChange: (index: number, field: 'participant' | 'ratio', value: string) => void;
  onAddSplitDetail: () => void;
  onRemoveSplitDetail: (index: number) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  queuedExpenses: Array<{
    title: string;
    amount: string;
    transactionDate: string;
    category: string;
    split: SplitType;
    expenseGroup: string;
    isPrivate: boolean;
  }>;
  queuedExpensesCount: number;
  onQueueExpense: () => void;
  onClearQueuedExpenses: () => void;
  onRemoveQueuedExpense: (index: number) => void;
};

export const ExpenseForm = ({
  title,
  amount,
  transactionDate,
  category,
  groupId,
  expenseGroup,
  isPrivate,
  split,
  splitDetails,
  categoryOptions,
  merchantOptions,
  householdOptions,
  expenseGroupOptions,
  editingId,
  isMutating,
  onInputChange,
  onSplitDetailChange,
  onAddSplitDetail,
  onRemoveSplitDetail,
  onSubmit,
  onCancel,
  queuedExpenses,
  queuedExpensesCount,
  onQueueExpense,
  onClearQueuedExpenses,
  onRemoveQueuedExpense,
}: ExpenseFormProps): JSX.Element => {
  const hasBaseFields =
    title.trim().length > 0 &&
    amount.trim().length > 0 &&
    transactionDate.trim().length > 0 &&
    category.trim().length > 0;
  const isSharedIncomplete = split === 'Shared' && (!groupId || !expenseGroup);
  const isSubmitDisabled = isMutating || !hasBaseFields || isSharedIncomplete;
  const canQueueExpense = !editingId && !isSubmitDisabled;
  const queuedTotalAmount = queuedExpenses.reduce((sum, queuedExpense) => {
    const amount = Number(queuedExpense.amount);
    if (!Number.isFinite(amount)) {
      return sum;
    }
    return sum + amount;
  }, 0);
  const pickClosestOption = (rawValue: string, options: string[]): string => {
    const value = rawValue.trim().toLowerCase();
    if (!value) {
      return rawValue;
    }
    const exact = options.find((option) => option.toLowerCase() === value);
    if (exact) {
      return exact;
    }
    const startsWith = options.find((option) => option.toLowerCase().startsWith(value));
    return startsWith ?? rawValue;
  };
  const onSearchableEnter = (
    event: KeyboardEvent<HTMLInputElement>,
    name: 'title' | 'category' | 'expenseGroup',
    options: string[],
  ) => {
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    const nextValue = pickClosestOption(event.currentTarget.value, options);
    onInputChange({
      target: { name, value: nextValue },
    } as ChangeEvent<HTMLInputElement>);
  };

  return (
    <FormCard>
    <Form onSubmit={onSubmit}>
      <FormHeader>
        <FormTitle>{editingId ? 'Edit Expense' : 'Add Expense'}</FormTitle>
        <MutedText>Enter details and choose how to split this expense.</MutedText>
      </FormHeader>
      <SectionLabel>Details</SectionLabel>
      <Row>
        <FieldGroup>
          <LabelText>
            Merchant
            <RequiredMark>*</RequiredMark>
          </LabelText>
          <Input
            name="title"
            value={title}
            onChange={onInputChange}
            placeholder="Merchant"
            list="merchant-options"
            onKeyDown={(event) => onSearchableEnter(event, 'title', merchantOptions)}
          />
          {merchantOptions.length > 0 ? (
            <datalist id="merchant-options">
              {merchantOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          ) : null}
        </FieldGroup>
        <FieldGroup>
          <LabelText>
            Amount ({APP_CURRENCY_CODE})
            <RequiredMark>*</RequiredMark>
          </LabelText>
          <Input
            name="amount"
            value={amount}
            onChange={onInputChange}
            placeholder={`Amount in ${APP_CURRENCY_CODE}`}
            type="number"
            step="0.01"
          />
        </FieldGroup>
        <FieldGroup>
          <LabelText>
            Date
            <RequiredMark>*</RequiredMark>
          </LabelText>
          <Input
            name="transactionDate"
            value={transactionDate}
            onChange={onInputChange}
            type="date"
          />
        </FieldGroup>
        <FieldGroup>
          <LabelText>
            Expense Category
            <RequiredMark>*</RequiredMark>
          </LabelText>
          <Input as="select" name="category" value={category} onChange={onInputChange}>
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Input>
        </FieldGroup>
      </Row>

      <ModeRow>
        <FieldGroup>
          <LabelText>
            Split Type
            <RequiredMark>*</RequiredMark>
          </LabelText>
          <Input
            as="select"
            name="split"
            value={split}
            onChange={onInputChange}
          >
            <option value="Personal">Personal</option>
            <option value="Shared">Shared</option>
            <option value="Custom">One-time custom split</option>
          </Input>
        </FieldGroup>
      </ModeRow>
      {split === 'Personal' ? (
        <MutedText>Personal expense for your own tracking.</MutedText>
      ) : null}

      {split === 'Shared' ? (
        <>
          <ModeRow>
            <FieldGroup>
              <LabelText>
                Household
                <RequiredMark>*</RequiredMark>
              </LabelText>
              <Input as="select" name="groupId" value={groupId} onChange={onInputChange}>
                <option value="">Select household</option>
                {householdOptions.map((household) => (
                  <option key={household.id} value={household.id}>
                    {household.name}
                  </option>
                ))}
              </Input>
            </FieldGroup>
            <FieldGroup>
              <LabelText>
                Expense Group
                <RequiredMark>*</RequiredMark>
              </LabelText>
              <Input as="select" name="expenseGroup" value={expenseGroup} onChange={onInputChange} disabled={!groupId}>
                <option value="">Select expense group</option>
                {expenseGroupOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Input>
            </FieldGroup>
          </ModeRow>
          <MutedText>Shared expense requires both household and expense group.</MutedText>
          <FieldGroup>
            <LabelText style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
              <Input
                type="checkbox"
                name="isPrivate"
                checked={isPrivate}
                onChange={onInputChange}
                style={{ minWidth: 'auto', width: 'auto' }}
              />
              Private in this household (only you see it; excluded from household total and settlements)
            </LabelText>
          </FieldGroup>
        </>
      ) : null}
      {split === 'Custom' ? (
        <SplitDetails>
          <MutedText>One-time custom split for this expense only.</MutedText>
          {splitDetails.map((detail, index) => (
            <SplitRow key={`split-detail-${index}`}>
              <Input
                value={detail.participant}
                onChange={(event) => onSplitDetailChange(index, 'participant', event.target.value)}
                placeholder="Participant"
              />
              <Input
                value={String(detail.ratio)}
                onChange={(event) => onSplitDetailChange(index, 'ratio', event.target.value)}
                placeholder="Ratio %"
                type="number"
                min="0"
                step="0.01"
              />
              <Button
                type="button"
                $variant="secondary"
                $size="sm"
                onClick={() => onRemoveSplitDetail(index)}
                disabled={isMutating || splitDetails.length <= 1}
              >
                Remove
              </Button>
            </SplitRow>
          ))}
          <Button type="button" $variant="secondary" $size="sm" onClick={onAddSplitDetail}>
            + Add Split Row
          </Button>
        </SplitDetails>
      ) : null}
      {!editingId && queuedExpensesCount > 0 ? (
        <>
          <SectionLabel>Queued Expenses</SectionLabel>
          <QueuedTable>
            <thead>
              <tr>
                <QueuedHeadCell>Merchant</QueuedHeadCell>
                <QueuedHeadCell>Amount ({APP_CURRENCY_CODE})</QueuedHeadCell>
                <QueuedHeadCell>Date</QueuedHeadCell>
                <QueuedHeadCell>Category</QueuedHeadCell>
                <QueuedHeadCell>Split</QueuedHeadCell>
                <QueuedHeadCell>Expense Group</QueuedHeadCell>
                <QueuedHeadCell>Private</QueuedHeadCell>
                <QueuedHeadCell>Action</QueuedHeadCell>
              </tr>
            </thead>
            <tbody>
              {queuedExpenses.map((queuedExpense, index) => (
                <tr key={`${queuedExpense.title}-${queuedExpense.transactionDate}-${index}`}>
                  <QueuedCell>{queuedExpense.title}</QueuedCell>
                  <QueuedCell>{queuedExpense.amount}</QueuedCell>
                  <QueuedCell>{queuedExpense.transactionDate}</QueuedCell>
                  <QueuedCell>{queuedExpense.category}</QueuedCell>
                  <QueuedCell>{queuedExpense.split}</QueuedCell>
                  <QueuedCell>{queuedExpense.expenseGroup || '-'}</QueuedCell>
                  <QueuedCell>{queuedExpense.split === 'Shared' && queuedExpense.isPrivate ? 'Yes' : '—'}</QueuedCell>
                  <QueuedCell>
                    <Button
                      type="button"
                      $variant="secondary"
                      $size="sm"
                      onClick={() => onRemoveQueuedExpense(index)}
                      disabled={isMutating}
                    >
                      Remove
                    </Button>
                  </QueuedCell>
                </tr>
              ))}
            </tbody>
          </QueuedTable>
          <MutedText>Queued total: {formatAppCurrency(queuedTotalAmount)}</MutedText>
        </>
      ) : null}
      <Actions>
        <Button $variant="primary" type="submit" disabled={isSubmitDisabled}>
          {editingId
            ? 'Save'
            : queuedExpensesCount > 0
              ? `Add ${queuedExpensesCount + 1} expenses`
              : 'Add expense'}
        </Button>
        {!editingId ? (
          <Button type="button" $variant="secondary" onClick={onQueueExpense} disabled={!canQueueExpense}>
            + Queue expense
          </Button>
        ) : null}
        <Button $variant="secondary" type="button" onClick={onCancel} disabled={isMutating}>
          Cancel
        </Button>
        {!editingId && queuedExpensesCount > 0 ? (
          <Button type="button" $variant="secondary" onClick={onClearQueuedExpenses} disabled={isMutating}>
            Clear queued ({queuedExpensesCount})
          </Button>
        ) : null}
      </Actions>
      {!editingId && queuedExpensesCount > 0 ? (
        <MutedText>{queuedExpensesCount} expense(s) queued for batch add.</MutedText>
      ) : null}
    </Form>
    </FormCard>
  );
};
