import { Sidebar } from '../components/sections/Sidebar';
import {
  AppLayout,
  HeaderRow,
  HeaderText,
  PageSurface,
  SectionSubtitle,
  SectionTitle,
  UserMenu,
} from '../components/ui';
import {
  ImportAlertsSection,
  ImportManualMappingSection,
  ImportMerchantRulesPanel,
  ImportRowsTable,
  ImportSummaryBar,
  ImportToolbarActions,
  ImportUploadSection,
} from '../features/import/components';
import { useImportPageState } from '../features/import';
import { ColumnMappingSectionAnchor, Panel } from '../features/import/importPageStyles';

export const ImportPage = (): JSX.Element => {
  const state = useImportPageState();

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
          <ImportUploadSection
            isDragActive={state.isDragActive}
            uploadedFileName={state.uploadedFileName}
            fileInputRef={state.fileInputRef}
            onDragActiveChange={state.setIsDragActive}
            onDropFile={state.onDropFile}
            onFileChange={state.onFileChange}
          />

          <ImportSummaryBar rows={state.rows} duplicateStats={state.duplicateStats} />

          <ImportMerchantRulesPanel
            merchantRules={state.merchantRules}
            newRuleMatchType={state.newRuleMatchType}
            setNewRuleMatchType={state.setNewRuleMatchType}
            categoryOptions={state.categoryOptions}
            incomingCategoryOptions={state.incomingCategoryOptions}
            expenseGroupByHousehold={state.expenseGroupByHousehold}
            groups={state.groups}
            updateMerchantRule={state.updateMerchantRule}
            deleteMerchantRule={state.deleteMerchantRule}
          />

          <ImportAlertsSection
            rows={state.rows}
            importError={state.importError}
            importInfo={state.importInfo}
            importBackendDuplicateFailureCount={state.importBackendDuplicateFailureCount}
            duplicateStats={state.duplicateStats}
            fileDuplicateWarning={state.fileDuplicateWarning}
            onRemoveInFileDuplicates={state.onRemoveInFileDuplicates}
          />

          {state.manualMappingData ? (
            <ColumnMappingSectionAnchor ref={state.mappingSectionRef}>
              <ImportManualMappingSection
                manualMappingData={state.manualMappingData}
                isRemappingColumns={state.isRemappingColumns}
                manualDateIndex={state.manualDateIndex}
                setManualDateIndex={state.setManualDateIndex}
                manualMerchantIndex={state.manualMerchantIndex}
                setManualMerchantIndex={state.setManualMerchantIndex}
                manualAmountIndex={state.manualAmountIndex}
                setManualAmountIndex={state.setManualAmountIndex}
                manualDescriptionIndex={state.manualDescriptionIndex}
                setManualDescriptionIndex={state.setManualDescriptionIndex}
                manualCurrencyIndex={state.manualCurrencyIndex}
                setManualCurrencyIndex={state.setManualCurrencyIndex}
                onApplyManualMapping={state.onApplyManualMapping}
                onSwapMerchantDescriptionColumns={state.onSwapMerchantDescriptionColumns}
              />
            </ColumnMappingSectionAnchor>
          ) : null}

          <ImportToolbarActions
            rows={state.rows}
            manualMappingData={state.manualMappingData}
            canRemapColumns={state.canRemapColumns}
            isMutating={state.isMutating}
            onRemoveImportedFile={state.onRemoveImportedFile}
            onRequestColumnRemap={state.onRequestColumnRemap}
            toggleAll={state.toggleAll}
            onApproveSelected={state.onApproveSelected}
          />
        </Panel>

        {state.rows.length > 0 && !state.manualMappingData ? (
          <ImportRowsTable
            rows={state.rows}
            categoryOptions={state.categoryOptions}
            incomingCategoryOptions={state.incomingCategoryOptions}
            expenseGroupByHousehold={state.expenseGroupByHousehold}
            groups={state.groups}
            merchantRules={state.merchantRules}
            newRuleMatchType={state.newRuleMatchType}
            updateRow={state.updateRow}
            upsertRuleFromRow={state.upsertRuleFromRow}
          />
        ) : null}
      </PageSurface>
    </AppLayout>
  );
};
