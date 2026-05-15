import { Check, Upload } from 'lucide-react';
import styled from 'styled-components';
import { Sidebar } from '../components/sections/Sidebar';
import {
  AppLayout,
  Button,
  Card,
  ErrorText,
  HeaderRow,
  HeaderText,
  Input,
  MutedText,
  PageSurface,
  SectionSubtitle,
  SectionTitle,
  Table,
  TableWrapper,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  UserMenu,
} from '../components/ui';
import type { SplitType } from '../features/expenses';
import { getImportRuleSaveButtonState, useImportPageState } from '../features/import';
import { APP_CURRENCY_CODE, normalizeStatementCurrency } from '../format/currency';
import { colors, spacing } from '../styles/tokens';

const Panel = styled(Card)`
  display: grid;
  gap: ${spacing.md};
  margin-bottom: ${spacing.lg};
  padding: ${spacing.lg};
`;

const Actions = styled.div`
  display: flex;
  gap: ${spacing.sm};
  flex-wrap: wrap;
`;

const UploadBox = styled.div<{ $isDragActive: boolean }>`
  border: 1px dashed #d1d5db;
  border-radius: 12px;
  min-height: 280px;
  display: grid;
  place-items: center;
  text-align: center;
  background: ${({ $isDragActive }) => ($isDragActive ? '#eef2ff' : '#fafafa')};
  border-color: ${({ $isDragActive }) => ($isDragActive ? '#6366f1' : '#d1d5db')};
  transition: background-color 120ms ease, border-color 120ms ease;
`;

const UploadInner = styled.div`
  display: grid;
  gap: ${spacing.sm};
  justify-items: center;
  max-width: 520px;
`;

const UploadIconWrap = styled.div`
  color: #9ca3af;
  display: inline-flex;
`;

const HiddenFileInput = styled(Input)`
  display: none;
`;

const UploadPrimaryText = styled.h4`
  margin: 0;
  font-size: 22px;
  color: ${colors.textPrimary};
`;

const UploadSecondaryText = styled.p`
  margin: 0;
  font-size: 14px;
  color: ${colors.textMuted};
`;

const DropHint = styled.p`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #4338ca;
`;

const UploadFootnote = styled.p`
  margin: ${spacing.sm} 0 0;
  font-size: 12px;
  color: #9ca3af;
`;

const UploadedFileName = styled.p`
  margin: 0;
  font-size: 13px;
  color: ${colors.textMuted};
`;

const InlineInput = styled(Input)`
  min-width: 120px;
`;

const CurrencyInput = styled(InlineInput)`
  min-width: 84px;
  width: 84px;
`;

const AmountInput = styled(InlineInput)`
  min-width: 96px;
  width: 96px;
`;

const CategorySelect = styled(InlineInput)`
  min-width: 170px;
  width: 170px;
`;

const ImportSummary = styled.div`
  display: flex;
  gap: ${spacing.lg};
  flex-wrap: wrap;
  font-size: 13px;
  color: ${colors.textMuted};
`;

const DuplicateNotice = styled(Card)<{ $severity: 'warning' | 'info' }>`
  margin: ${spacing.sm} 0;
  border-color: ${({ $severity }) => ($severity === 'warning' ? '#f59e0b' : colors.border)};
  background: ${({ $severity }) => ($severity === 'warning' ? '#fff7ed' : '#f8fafc')};
  padding: ${spacing.sm} ${spacing.md};
`;

const RulePanel = styled(Card)`
  margin: ${spacing.sm} 0;
  padding: ${spacing.sm} ${spacing.md};
  display: grid;
  gap: ${spacing.sm};
`;

const RuleRow = styled.div`
  display: grid;
  grid-template-columns: 80px 100px minmax(160px, 1fr) 160px 120px 140px 160px auto;
  gap: ${spacing.sm};
  align-items: center;
`;

export const ImportPage = (): JSX.Element => {
  const {
    rows,
    importError,
    importInfo,
    importBackendDuplicateFailureCount,
    manualMappingData,
    manualDateIndex,
    setManualDateIndex,
    manualMerchantIndex,
    setManualMerchantIndex,
    manualAmountIndex,
    setManualAmountIndex,
    manualDescriptionIndex,
    setManualDescriptionIndex,
    manualCurrencyIndex,
    setManualCurrencyIndex,
    merchantRules,
    newRuleMatchType,
    setNewRuleMatchType,
    uploadedFileName,
    isDragActive,
    setIsDragActive,
    fileInputRef,
    groups,
    categoryOptions,
    incomingCategoryOptions,
    expenseGroupByHousehold,
    duplicateStats,
    fileDuplicateWarning,
    isMutating,
    onFileChange,
    onDropFile,
    onApplyManualMapping,
    updateRow,
    toggleAll,
    upsertRuleFromRow,
    updateMerchantRule,
    deleteMerchantRule,
    onApproveSelected,
    onRemoveImportedFile,
    onRemoveInFileDuplicates,
  } = useImportPageState();

  return (
    <AppLayout>
      <Sidebar />
      <PageSurface>
        <HeaderRow>
          <HeaderText>
            <SectionTitle>Import Statement</SectionTitle>
            <SectionSubtitle>Upload a bank statement, review recognized fields, and approve import.</SectionSubtitle>
          </HeaderText>
          <UserMenu />
        </HeaderRow>

        <Panel>
          <UploadBox
            $isDragActive={isDragActive}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragActive(true);
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragActive(true);
            }}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={onDropFile}
          >
            <UploadInner>
              <UploadIconWrap aria-hidden>
                <Upload size={44} strokeWidth={1.8} />
              </UploadIconWrap>
              <UploadPrimaryText>Upload Bank Statement</UploadPrimaryText>
              <UploadSecondaryText>
                Supports CSV/TXT formats (currency column optional, stored as {APP_CURRENCY_CODE})
              </UploadSecondaryText>
              {isDragActive ? <DropHint>Drop file here</DropHint> : null}
              <Button
                type="button"
                $variant="accent"
                $weight="semibold"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose File
              </Button>
              <HiddenFileInput
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,.txt"
                onChange={onFileChange}
              />
              {uploadedFileName ? <UploadedFileName>Selected file: {uploadedFileName}</UploadedFileName> : null}
              <UploadFootnote>Your data is processed locally and never uploaded without your approval.</UploadFootnote>
            </UploadInner>
          </UploadBox>
          {manualMappingData ? (
            <>
              <MutedText>Manual mapping required for this file format.</MutedText>
              <Actions>
                <InlineInput as="select" value={manualDateIndex} onChange={(event) => setManualDateIndex(event.target.value)}>
                  <option value="">Select Date column</option>
                  {manualMappingData.header.map((column, index) => (
                    <option key={`date-col-${index}`} value={String(index)}>
                      {column || `Column ${index + 1}`}
                    </option>
                  ))}
                </InlineInput>
                <InlineInput
                  as="select"
                  value={manualMerchantIndex}
                  onChange={(event) => setManualMerchantIndex(event.target.value)}
                >
                  <option value="">Select Merchant column</option>
                  {manualMappingData.header.map((column, index) => (
                    <option key={`merchant-col-${index}`} value={String(index)}>
                      {column || `Column ${index + 1}`}
                    </option>
                  ))}
                </InlineInput>
                <InlineInput
                  as="select"
                  value={manualAmountIndex}
                  onChange={(event) => setManualAmountIndex(event.target.value)}
                >
                  <option value="">Select Amount column</option>
                  {manualMappingData.header.map((column, index) => (
                    <option key={`amount-col-${index}`} value={String(index)}>
                      {column || `Column ${index + 1}`}
                    </option>
                  ))}
                </InlineInput>
                <InlineInput
                  as="select"
                  value={manualDescriptionIndex}
                  onChange={(event) => setManualDescriptionIndex(event.target.value)}
                >
                  <option value="">Description column (optional)</option>
                  {manualMappingData.header.map((column, index) => (
                    <option key={`desc-col-${index}`} value={String(index)}>
                      {column || `Column ${index + 1}`}
                    </option>
                  ))}
                </InlineInput>
                <InlineInput
                  as="select"
                  value={manualCurrencyIndex}
                  onChange={(event) => setManualCurrencyIndex(event.target.value)}
                >
                  <option value="">Currency column (optional)</option>
                  {manualMappingData.header.map((column, index) => (
                    <option key={`currency-col-${index}`} value={String(index)}>
                      {column || `Column ${index + 1}`}
                    </option>
                  ))}
                </InlineInput>
                <Button type="button" onClick={onApplyManualMapping}>
                  Apply mapping
                </Button>
              </Actions>
            </>
          ) : null}
          <ImportSummary>
            <span>Total rows: {rows.length}</span>
            <span>Outgoing: {rows.filter((row) => row.flow === 'out').length}</span>
            <span>Incoming: {rows.filter((row) => row.flow === 'in').length}</span>
            <span>Selected: {rows.filter((row) => row.selected).length}</span>
            <span>High confidence: {rows.filter((row) => row.confidence === 'high').length}</span>
            <span>Duplicates: {duplicateStats.total}</span>
          </ImportSummary>
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
          {rows.some((row) => row.flow === 'in') ? (
            <DuplicateNotice $severity="info">
              <MutedText>
                Incoming (credit) rows are selected like outgoing rows; deselect any you do not want. They are stored
                as income and count toward Budget YTD income; outgoing rows remain expense records.
              </MutedText>
            </DuplicateNotice>
          ) : null}
          {importError ? (
            <DuplicateNotice $severity="warning">
              <ErrorText>{importError}</ErrorText>
              {importBackendDuplicateFailureCount > 0 ? (
                <MutedText style={{ marginTop: 8, display: 'block' }}>
                  The server rejected {importBackendDuplicateFailureCount} row(s) that match an expense you already
                  saved (same date, amount, and merchant text). Overlapping bank exports (for example April only vs
                  year-to-date) often cause this. Edit the merchant or date slightly only if it is genuinely a different
                  transaction, or remove those rows from the selection.
                </MutedText>
              ) : null}
            </DuplicateNotice>
          ) : duplicateStats.total > 0 ? (
            <DuplicateNotice $severity="warning">
              <ErrorText>
                Duplicate warning: {duplicateStats.existing} row(s) match existing expenses and {duplicateStats.inFile} row(s) are duplicates within this file.
              </ErrorText>
              <MutedText>Duplicate rows are auto-unselected and cannot be imported until edited.</MutedText>
              {duplicateStats.inFile > 0 ? (
                <Actions>
                  <Button type="button" $variant="secondary" onClick={onRemoveInFileDuplicates}>
                    Remove repeated rows (keep first)
                  </Button>
                </Actions>
              ) : null}
            </DuplicateNotice>
          ) : fileDuplicateWarning ? (
            <DuplicateNotice $severity="warning">
              <ErrorText>{fileDuplicateWarning}</ErrorText>
            </DuplicateNotice>
          ) : importInfo ? (
            <DuplicateNotice $severity="info">
              <MutedText>{importInfo}</MutedText>
            </DuplicateNotice>
          ) : null}
          <Actions>
            <Button type="button" $variant="secondary" onClick={onRemoveImportedFile} disabled={rows.length === 0 && !manualMappingData}>
              Remove file
            </Button>
            <Button type="button" $variant="secondary" onClick={() => toggleAll(true)} disabled={rows.length === 0}>
              Select all
            </Button>
            <Button type="button" $variant="secondary" onClick={() => toggleAll(false)} disabled={rows.length === 0}>
              Clear selection
            </Button>
            <Button type="button" onClick={onApproveSelected} disabled={isMutating || rows.every((row) => !row.selected)}>
              Import selected
            </Button>
          </Actions>
        </Panel>

        {rows.length > 0 ? (
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
                          placeholder={APP_CURRENCY_CODE}
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
                        {(() => {
                          const saveState = getImportRuleSaveButtonState(merchantRules, row, newRuleMatchType);
                          return (
                            <Button
                              type="button"
                              $variant="secondary"
                              disabled={saveState.disabled}
                              title={saveState.title}
                              onClick={() => upsertRuleFromRow(row, newRuleMatchType)}
                            >
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                              >
                                {saveState.synced ? <Check size={16} strokeWidth={2.5} aria-hidden /> : null}
                                {saveState.label}
                              </span>
                            </Button>
                          );
                        })()}
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </TableWrapper>
        ) : null}
      </PageSurface>
    </AppLayout>
  );
};
