import { Check } from 'lucide-react';
import { Button, MutedText, Table, TableWrapper, Tbody, Td, Th, Thead, Tr } from '../../../components/ui';
import type { SplitType } from '../../expenses';
import type { GroupSummary } from '../../groups';
import { normalizeStatementCurrency } from '../../../format/currency';
import { getImportRuleSaveButtonState } from '../merchantRules';
import type { ImportedRow, ImportMerchantRule } from '../types';
import { AmountInput, CategorySelect, CurrencyInput, InlineInput } from '../importPageStyles';

type ImportRowsTableProps = {
  rows: ImportedRow[];
  categoryOptions: string[];
  incomingCategoryOptions: string[];
  expenseGroupByHousehold: Map<string, string[]>;
  groups: GroupSummary[];
  merchantRules: ImportMerchantRule[];
  newRuleMatchType: 'exact' | 'contains';
  updateRow: (id: string, patch: Partial<ImportedRow>) => void;
  upsertRuleFromRow: (row: ImportedRow, matchType: 'exact' | 'contains') => void;
};

export const ImportRowsTable = ({
  rows,
  categoryOptions,
  incomingCategoryOptions,
  expenseGroupByHousehold,
  groups,
  merchantRules,
  newRuleMatchType,
  updateRow,
  upsertRuleFromRow,
}: ImportRowsTableProps): JSX.Element => {
  return (
    <TableWrapper>
      <Table>
        <Thead>
          <Tr>
            <Th style={{ textAlign: 'center' }}>Import</Th>
            <Th style={{ textAlign: 'center' }}>Date</Th>
            <Th style={{ textAlign: 'center' }}>Merchant</Th>
            <Th style={{ textAlign: 'center' }}>Description</Th>
            <Th style={{ textAlign: 'center' }}>Flow</Th>
            <Th style={{ textAlign: 'center' }}>Amount</Th>
            <Th style={{ width: 100, textAlign: 'center' }}>Currency</Th>
            <Th style={{ textAlign: 'center' }}>Category</Th>
            <Th style={{ textAlign: 'center' }}>Split</Th>
            <Th style={{ textAlign: 'center' }}>Household</Th>
            <Th style={{ textAlign: 'center' }}>Expense Group</Th>
            <Th style={{ textAlign: 'center' }}>Confidence</Th>
            <Th style={{ textAlign: 'center' }}>Duplicate</Th>
            <Th style={{ textAlign: 'center' }}>Rule</Th>
          </Tr>
        </Thead>
        <Tbody>
          {rows.map((row) => {
            const isIncoming = row.flow === 'in';
            const selectableCategoryOptions = isIncoming ? incomingCategoryOptions : categoryOptions;
            const expenseGroupOptions = row.groupId ? expenseGroupByHousehold.get(row.groupId) ?? [] : [];
            const saveState = getImportRuleSaveButtonState(merchantRules, row, newRuleMatchType);
            return (
              <Tr key={row.id} style={{ background: isIncoming ? '#f0fdf4' : '#fff7ed' }}>
                <Td>
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onChange={(event) => updateRow(row.id, { selected: event.target.checked })}
                  />
                </Td>
                <Td>
                  <InlineInput
                    type="date"
                    value={row.transactionDate}
                    onChange={(event) => updateRow(row.id, { transactionDate: event.target.value })}
                  />
                </Td>
                <Td>
                  <InlineInput value={row.title} onChange={(event) => updateRow(row.id, { title: event.target.value })} />
                </Td>
                <Td>
                  <InlineInput
                    value={row.description}
                    onChange={(event) => updateRow(row.id, { description: event.target.value })}
                  />
                </Td>
                <Td>
                  <MutedText
                    as="span"
                    style={{ color: isIncoming ? '#166534' : '#9a3412', fontWeight: 600 }}
                    title="Outgoing = expense/debit; incoming = credit/deposit."
                  >
                    {row.flow === 'out' ? 'Outgoing' : 'Incoming'}
                  </MutedText>
                </Td>
                <Td>
                  <AmountInput
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.amount}
                    onChange={(event) => updateRow(row.id, { amount: event.target.value })}
                  />
                </Td>
                <Td>
                  <CurrencyInput
                    value={row.currency}
                    onChange={(event) =>
                      updateRow(row.id, { currency: normalizeStatementCurrency(event.target.value) })
                    }
                    title="ISO currency from statement; must be DKK to import."
                  />
                </Td>
                <Td>
                  <CategorySelect
                    as="select"
                    value={row.category}
                    onChange={(event) => updateRow(row.id, { category: event.target.value })}
                  >
                    {selectableCategoryOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </CategorySelect>
                </Td>
                <Td>
                  {isIncoming ? (
                    <MutedText as="span">-</MutedText>
                  ) : (
                    <InlineInput
                      as="select"
                      value={row.split}
                      onChange={(event) => updateRow(row.id, { split: event.target.value as SplitType })}
                    >
                      <option value="Personal">Personal</option>
                      <option value="Shared">Shared</option>
                    </InlineInput>
                  )}
                </Td>
                <Td>
                  {isIncoming ? (
                    <MutedText as="span">-</MutedText>
                  ) : (
                    <InlineInput
                      as="select"
                      value={row.groupId}
                      disabled={row.split !== 'Shared'}
                      onChange={(event) => updateRow(row.id, { groupId: event.target.value })}
                    >
                      <option value="">Select household</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </InlineInput>
                  )}
                </Td>
                <Td>
                  {isIncoming ? (
                    <MutedText as="span">-</MutedText>
                  ) : (
                    <InlineInput
                      as="select"
                      value={row.expenseGroup}
                      disabled={row.split !== 'Shared' || !row.groupId}
                      onChange={(event) => updateRow(row.id, { expenseGroup: event.target.value })}
                    >
                      <option value="">Select expense group</option>
                      {expenseGroupOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </InlineInput>
                  )}
                </Td>
                <Td>{row.confidence}</Td>
                <Td>{row.duplicateType === 'none' ? '-' : row.duplicateType}</Td>
                <Td>
                  <Button
                    type="button"
                    $variant="secondary"
                    disabled={saveState.disabled}
                    title={saveState.title}
                    onClick={() => upsertRuleFromRow(row, newRuleMatchType)}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {saveState.synced ? <Check size={16} strokeWidth={2.5} aria-hidden /> : null}
                      {saveState.label}
                    </span>
                  </Button>
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </TableWrapper>
  );
};
