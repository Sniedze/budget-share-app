import { Button, MutedText } from '../../../components/ui';
import type { SplitType } from '../../expenses';
import type { GroupSummary } from '../../groups';
import type { ImportMerchantRule } from '../types';
import { Actions, InlineInput, RulePanel, RuleRow } from '../importPageStyles';

type ImportMerchantRulesPanelProps = {
  merchantRules: ImportMerchantRule[];
  newRuleMatchType: 'exact' | 'contains';
  setNewRuleMatchType: (value: 'exact' | 'contains') => void;
  categoryOptions: string[];
  incomingCategoryOptions: string[];
  expenseGroupByHousehold: Map<string, string[]>;
  groups: GroupSummary[];
  updateMerchantRule: (id: string, patch: Partial<ImportMerchantRule>) => void;
  deleteMerchantRule: (id: string) => void;
};

export const ImportMerchantRulesPanel = ({
  merchantRules,
  newRuleMatchType,
  setNewRuleMatchType,
  categoryOptions,
  incomingCategoryOptions,
  expenseGroupByHousehold,
  groups,
  updateMerchantRule,
  deleteMerchantRule,
}: ImportMerchantRulesPanelProps): JSX.Element => {
  return (
    <RulePanel>
      <Actions>
        <MutedText style={{ margin: 0 }}>Merchant rules: {merchantRules.length}</MutedText>
        <InlineInput
          as="select"
          value={newRuleMatchType}
          onChange={(event) => setNewRuleMatchType(event.target.value as 'exact' | 'contains')}
          title="Choose rule type for 'Save rule' buttons in table rows."
        >
          <option value="exact">Save as Exact</option>
          <option value="contains">Save as Contains</option>
        </InlineInput>
      </Actions>
      {merchantRules.length === 0 ? (
        <MutedText style={{ margin: 0 }}>
          No custom rules yet. Use “Save rule” in a row to remember mapping automatically.
        </MutedText>
      ) : (
        merchantRules
          .slice()
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
          .slice(0, 12)
          .map((rule) => {
            const isOutgoingRule = rule.flow === 'out';
            const splitValue: SplitType = isOutgoingRule ? rule.split ?? 'Personal' : 'Personal';
            const groupId = isOutgoingRule ? rule.groupId ?? '' : '';
            const groupOptions = groupId ? expenseGroupByHousehold.get(groupId) ?? [] : [];
            const categoryOpts = isOutgoingRule ? categoryOptions : incomingCategoryOptions;
            return (
              <RuleRow key={rule.id}>
                <MutedText style={{ margin: 0 }}>{isOutgoingRule ? 'Outgoing' : 'Incoming'}</MutedText>
                <InlineInput
                  as="select"
                  value={rule.matchType}
                  onChange={(event) =>
                    updateMerchantRule(rule.id, { matchType: event.target.value as 'exact' | 'contains' })
                  }
                >
                  <option value="exact">Exact</option>
                  <option value="contains">Contains</option>
                </InlineInput>
                <InlineInput
                  value={rule.pattern}
                  onChange={(event) => updateMerchantRule(rule.id, { pattern: event.target.value })}
                />
                <InlineInput
                  as="select"
                  value={rule.category}
                  onChange={(event) => updateMerchantRule(rule.id, { category: event.target.value })}
                >
                  {categoryOpts.map((option) => (
                    <option key={`${rule.id}-cat-${option}`} value={option}>
                      {option}
                    </option>
                  ))}
                </InlineInput>
                <InlineInput
                  as="select"
                  value={splitValue}
                  disabled={!isOutgoingRule}
                  onChange={(event) => {
                    const nextSplit = event.target.value as SplitType;
                    updateMerchantRule(rule.id, {
                      split: nextSplit,
                      groupId: nextSplit === 'Shared' ? rule.groupId : '',
                      expenseGroup: nextSplit === 'Shared' ? rule.expenseGroup : '',
                    });
                  }}
                >
                  <option value="Personal">Personal</option>
                  <option value="Shared">Shared</option>
                </InlineInput>
                <InlineInput
                  as="select"
                  value={groupId}
                  disabled={!isOutgoingRule || splitValue !== 'Shared'}
                  onChange={(event) =>
                    updateMerchantRule(rule.id, { groupId: event.target.value, expenseGroup: '' })
                  }
                >
                  <option value="">Household</option>
                  {groups.map((group) => (
                    <option key={`${rule.id}-group-${group.id}`} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </InlineInput>
                <InlineInput
                  as="select"
                  value={isOutgoingRule ? rule.expenseGroup ?? '' : ''}
                  disabled={!isOutgoingRule || splitValue !== 'Shared' || !groupId}
                  onChange={(event) => updateMerchantRule(rule.id, { expenseGroup: event.target.value })}
                >
                  <option value="">Expense Group</option>
                  {groupOptions.map((option) => (
                    <option key={`${rule.id}-eg-${option}`} value={option}>
                      {option}
                    </option>
                  ))}
                </InlineInput>
                <Button type="button" $variant="secondary" onClick={() => deleteMerchantRule(rule.id)}>
                  Delete
                </Button>
              </RuleRow>
            );
          })
      )}
    </RulePanel>
  );
};
