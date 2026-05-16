import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { Button, Input, MutedText } from '../../../components/ui';
import type { BudgetAssumptions } from '../storage';
import { spacing } from '../../../styles/tokens';
import {
  CategoryBudgetRow,
  FormGrid,
  ModalActions,
  ModalBackdrop,
  ModalPanel,
  ModalTitle,
  OverviewTitle,
} from '../budgetPageStyles';

type BudgetSettingsModalProps = {
  monthKey: string;
  categories: string[];
  draftAssumptions: BudgetAssumptions;
  setDraftAssumptions: Dispatch<SetStateAction<BudgetAssumptions>>;
  draftCategoryBudgets: Record<string, string>;
  setDraftCategoryBudgets: Dispatch<SetStateAction<Record<string, string>>>;
  onClose: () => void;
  onSave: (event: FormEvent) => void;
};

export const BudgetSettingsModal = ({
  monthKey,
  categories,
  draftAssumptions,
  setDraftAssumptions,
  draftCategoryBudgets,
  setDraftCategoryBudgets,
  onClose,
  onSave,
}: BudgetSettingsModalProps): JSX.Element => {
  return (
    <ModalBackdrop role="presentation" onMouseDown={onClose}>
      <ModalPanel
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <ModalTitle id="budget-modal-title">Budget &amp; cashflow</ModalTitle>
        <MutedText>
          Values are stored in this browser for your account. Income uses a steady monthly estimate for YTD and
          projections.
        </MutedText>
        <form onSubmit={onSave}>
          <FormGrid>
            <label>
              <MutedText as="span" style={{ display: 'block', marginBottom: 4 }}>
                Starting balance (Jan 1)
              </MutedText>
              <Input
                type="number"
                step="0.01"
                value={draftAssumptions.startingBalance}
                onChange={(e) => setDraftAssumptions((p) => ({ ...p, startingBalance: Number(e.target.value) }))}
              />
            </label>
            <label>
              <MutedText as="span" style={{ display: 'block', marginBottom: 4 }}>
                Monthly income estimate
              </MutedText>
              <Input
                type="number"
                step="0.01"
                value={draftAssumptions.monthlyIncomeEstimate}
                onChange={(e) =>
                  setDraftAssumptions((p) => ({ ...p, monthlyIncomeEstimate: Number(e.target.value) }))
                }
              />
            </label>
          </FormGrid>
          <OverviewTitle style={{ marginTop: spacing.xl, fontSize: 15 }}>
            Category budgets · {monthKey}
          </OverviewTitle>
          <MutedText style={{ marginTop: 4 }}>Leave blank to omit a cap for that category.</MutedText>
          <FormGrid>
            {categories.map((c) => (
              <CategoryBudgetRow key={c}>
                <span>{c}</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  value={draftCategoryBudgets[c] ?? ''}
                  onChange={(e) => setDraftCategoryBudgets((p) => ({ ...p, [c]: e.target.value }))}
                />
              </CategoryBudgetRow>
            ))}
          </FormGrid>
          <ModalActions>
            <Button type="button" $variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" $variant="accent" $weight="semibold">
              Save
            </Button>
          </ModalActions>
        </form>
      </ModalPanel>
    </ModalBackdrop>
  );
};
