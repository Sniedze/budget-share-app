import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_INCOME_CATEGORIES,
  GET_EXPENSES,
  buildExpenseCategoryOptions,
  expenseCategoryExtrasFromWorkspace,
  IMPORT_EXPENSES,
  isDuplicateImportResult,
  mergeImportedExpensesIntoCache,
  type AddExpenseInput,
  type Expense,
  type GetExpensesResponse,
} from '../expenses';
import { useAuth } from '../auth';
import { GET_GROUPS } from '../groups';
import { refetchGroups } from '../groups/groupCacheUpdates';
import type { GetGroupsQueryResult } from '../groups';
import { normalizeStatementCurrency } from '../../format/currency';
import {
  ALLOWED_FILE_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_IMPORT_FILE_SIZE_BYTES,
} from './constants';
import { applyDuplicateFlags, buildExpenseTitleForImport, buildImportSignature } from './buildImportedRows';
import { normalizeAmountValue } from './amountParse';
import { toYearMonthKey } from '../budget/selectors';
import { useUserWorkspaceSettings } from '../userSettings';
import type { SavedColumnMapping } from './types';
import {
  buildExistingExpenseSignatures,
  buildMerchantHistory,
  buildSharedCategoryHistory,
} from './importExpenseHistory';
import { computeDuplicateStats, computeFileDuplicateWarning } from './importDuplicateStats';
import {
  createApplySharedCategoryDefaults,
  sortRowsForInitialReview,
} from './importRowReview';
import {
  buildStatementGrid,
  isStatementGrid,
  parseManualMapping,
  parseStatementFromGrid,
  type ParseStatementResult,
} from './parseStatement';
import { useImportMerchantRules } from './useImportMerchantRules';
import type { ImportExpensesMutation } from '../../graphql/generated/graphql';
import {
  columnMappingIndicesToForm,
  parseColumnMappingForm,
  suggestRemapIndicesFromStatement,
} from './remapHelpers';
import type { ImportRemapContext, ImportedRow, ParsedStatementData } from './types';

const clearManualMappingState = () => ({
  manualMappingData: null as ParsedStatementData | null,
  manualMappingSignatures: [] as string[],
  manualDateIndex: '',
  manualMerchantIndex: '',
  manualAmountIndex: '',
  manualDescriptionIndex: '',
  manualCurrencyIndex: '',
});

export const useImportPageState = () => {
  const { user } = useAuth();
  const client = useApolloClient();
  const { data: expensesData } = useQuery<GetExpensesResponse>(GET_EXPENSES);
  const { data: groupsData } = useQuery<GetGroupsQueryResult>(GET_GROUPS);
  const [importExpensesMutation, { loading: isImporting }] = useMutation<ImportExpensesMutation>(IMPORT_EXPENSES, {
    update(cache, { data }) {
      const created =
        data?.importExpenses.results
          .filter((row) => row.success && row.expense)
          .map((row) => row.expense as Expense) ?? [];
      mergeImportedExpensesIntoCache(cache, created);
      if (created.some((expense) => expense.groupId)) {
        void refetchGroups(client);
      }
    },
  });

  const [rows, setRows] = useState<ImportedRow[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importInfo, setImportInfo] = useState<string | null>(null);
  const [importBackendDuplicateFailureCount, setImportBackendDuplicateFailureCount] = useState(0);
  const [manualMappingData, setManualMappingData] = useState<ParsedStatementData | null>(null);
  const [manualMappingSignatures, setManualMappingSignatures] = useState<string[]>([]);
  const [manualDateIndex, setManualDateIndex] = useState('');
  const [manualMerchantIndex, setManualMerchantIndex] = useState('');
  const [manualAmountIndex, setManualAmountIndex] = useState('');
  const [manualDescriptionIndex, setManualDescriptionIndex] = useState('');
  const [manualCurrencyIndex, setManualCurrencyIndex] = useState('');
  const [remapContext, setRemapContext] = useState<ImportRemapContext | null>(null);
  const [isRemappingColumns, setIsRemappingColumns] = useState(false);
  const workspaceMonthKey = useMemo(() => {
    const now = new Date();
    return toYearMonthKey(now.getFullYear(), now.getMonth());
  }, []);
  const { settings: workspaceSettings, saveSettings } = useUserWorkspaceSettings(
    user?.id ?? '',
    workspaceMonthKey,
  );
  const customCategories = useMemo(
    () => workspaceSettings?.importCustomCategories ?? [],
    [workspaceSettings],
  );
  const [columnMappings, setColumnMappings] = useState<Record<string, SavedColumnMapping>>({});
  useEffect(() => {
    if (workspaceSettings?.importColumnMappings) {
      setColumnMappings(workspaceSettings.importColumnMappings);
    }
  }, [workspaceSettings]);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedFileText, setUploadedFileText] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mappingSectionRef = useRef<HTMLDivElement | null>(null);

  const {
    merchantRules,
    newRuleMatchType,
    setNewRuleMatchType,
    learnRulesFromImportedRows,
    upsertRuleFromRow,
    updateMerchantRule,
    deleteMerchantRule,
  } = useImportMerchantRules(
    setRows,
    workspaceSettings?.importMerchantRules ?? [],
    (rules) => {
      void saveSettings({ importMerchantRules: rules });
    },
  );

  const saveColumnMapping = useCallback(
    (signature: string, mapping: SavedColumnMapping) => {
      setColumnMappings((previous) => {
        const next = { ...previous, [signature]: mapping };
        void saveSettings({ importColumnMappings: next });
        return next;
      });
    },
    [saveSettings],
  );

  const groups = useMemo(() => groupsData?.groups ?? [], [groupsData?.groups]);
  const categoryOptions = useMemo(
    () =>
      buildExpenseCategoryOptions(
        expensesData?.expenses ?? [],
        expenseCategoryExtrasFromWorkspace({
          budgetCustomCategories: workspaceSettings?.budgetCustomCategories,
          importCustomCategories: customCategories,
        }),
      ),
    [customCategories, expensesData?.expenses, workspaceSettings?.budgetCustomCategories],
  );
  const incomingCategoryOptions = useMemo(
    () => [...DEFAULT_INCOME_CATEGORIES].sort((left, right) => left.localeCompare(right)),
    [],
  );

  const expenseGroupByHousehold = useMemo(() => {
    const map = new Map<string, string[]>();
    groups.forEach((group) => {
      const fromExpenses = group.expenses
        .map((expense) => (expense.expenseGroup ?? '').trim())
        .filter(Boolean);
      const fromTemplates = (group.expenseGroupLabels ?? []).map((label) => label.trim()).filter(Boolean);
      const options = Array.from(new Set([...fromExpenses, ...fromTemplates])).sort((left, right) =>
        left.localeCompare(right),
      );
      map.set(group.id, options);
    });
    return map;
  }, [groups]);

  const expenses = useMemo(() => expensesData?.expenses ?? [], [expensesData?.expenses]);
  const merchantHistory = useMemo(() => buildMerchantHistory(expenses), [expenses]);
  const sharedCategoryHistory = useMemo(() => buildSharedCategoryHistory(expenses), [expenses]);
  const existingExpenseSignatures = useMemo(() => buildExistingExpenseSignatures(expenses), [expenses]);
  const applySharedCategoryDefaults = useMemo(
    () => createApplySharedCategoryDefaults(sharedCategoryHistory, expenseGroupByHousehold),
    [sharedCategoryHistory, expenseGroupByHousehold],
  );

  const finalizeRows = useCallback(
    (inputRows: ImportedRow[]) =>
      sortRowsForInitialReview(
        applyDuplicateFlags(inputRows.map(applySharedCategoryDefaults), existingExpenseSignatures),
      ),
    [applySharedCategoryDefaults, existingExpenseSignatures],
  );

  const parseContext = useMemo(
    () => ({
      merchantRules,
      merchantHistory,
      existingExpenseSignatures,
      finalizeRows,
      savedColumnMappings: columnMappings,
      saveColumnMapping,
    }),
    [columnMappings, merchantRules, merchantHistory, existingExpenseSignatures, finalizeRows, saveColumnMapping],
  );

  const applyParseResult = useCallback((result: ParseStatementResult) => {
    if (result.kind === 'error') {
      setImportError(result.message);
      return;
    }
    if (result.kind === 'manual') {
      setIsRemappingColumns(false);
      setRemapContext(null);
      setManualMappingData(result.manualData);
      setManualMappingSignatures(result.signatures);
      setManualDateIndex(result.initialIndices.dateIndex);
      setManualMerchantIndex(result.initialIndices.merchantIndex);
      setManualAmountIndex(result.initialIndices.amountIndex);
      setManualDescriptionIndex(result.initialIndices.descriptionIndex);
      setManualCurrencyIndex(result.initialIndices.currencyIndex);
      setImportError(result.error);
      return;
    }
    setRows(result.rows);
    setImportInfo(result.info);
    setRemapContext(result.remapContext);
    setIsRemappingColumns(false);
    const cleared = clearManualMappingState();
    setManualMappingData(cleared.manualMappingData);
    setManualMappingSignatures(cleared.manualMappingSignatures);
    setManualDateIndex(cleared.manualDateIndex);
    setManualMerchantIndex(cleared.manualMerchantIndex);
    setManualAmountIndex(cleared.manualAmountIndex);
    setManualDescriptionIndex(cleared.manualDescriptionIndex);
    setManualCurrencyIndex(cleared.manualCurrencyIndex);
    setImportError(null);
  }, []);

  const parseStatement = useCallback(
    async (file: File, fileText: string) => {
      setImportError(null);
      setImportInfo(null);
      setImportBackendDuplicateFailureCount(0);
      const userScope = user?.id ?? 'anonymous';
      const gridResult = buildStatementGrid(fileText, userScope, file.name);
      if (!isStatementGrid(gridResult)) {
        setImportError(gridResult.message);
        return;
      }
      applyParseResult(
        parseStatementFromGrid(gridResult, {
          ...parseContext,
          userScope,
          fileName: file.name,
        }),
      );
    },
    [applyParseResult, parseContext, user?.id],
  );

  const duplicateStats = useMemo(() => computeDuplicateStats(rows), [rows]);
  const fileDuplicateWarning = useMemo(
    () => computeFileDuplicateWarning(rows, duplicateStats),
    [duplicateStats, rows],
  );

  const handleSelectedFile = async (file: File | null) => {
    if (!file) {
      return;
    }
    setUploadedFileName(file.name);
    const fileName = file.name.toLowerCase();
    const hasAllowedExtension = ALLOWED_FILE_EXTENSIONS.some((extension) => fileName.endsWith(extension));
    const hasAllowedMimeType = ALLOWED_MIME_TYPES.includes(file.type);
    if (!hasAllowedExtension && !hasAllowedMimeType) {
      setImportError('Unsupported file type. Please upload a CSV or TXT statement.');
      return;
    }
    if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      setImportError(`File is too large. Maximum size is ${Math.round(MAX_IMPORT_FILE_SIZE_BYTES / (1024 * 1024))} MB.`);
      return;
    }
    try {
      const fileText = await file.text();
      setUploadedFileText(fileText);
      await parseStatement(file, fileText);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Failed to parse statement file.');
    }
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    await handleSelectedFile(event.target.files?.[0] ?? null);
  };

  const onDropFile = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    await handleSelectedFile(file);
  };

  const onApplyManualMapping = () => {
    if (!manualMappingData) {
      return;
    }
    const parsedForm = parseColumnMappingForm(
      {
        dateIndex: manualDateIndex,
        merchantIndex: manualMerchantIndex,
        amountIndex: manualAmountIndex,
        descriptionIndex: manualDescriptionIndex,
        currencyIndex: manualCurrencyIndex,
      },
      manualMappingData.header.length,
    );
    if (!parsedForm.ok) {
      setImportError(parsedForm.message);
      return;
    }
    const { indices } = parsedForm;
    const result = parseManualMapping(
      manualMappingData,
      indices,
      manualMappingSignatures,
      {
        ...parseContext,
        userScope: user?.id ?? 'anonymous',
        fileName: uploadedFileName,
      },
    );
    if (result.kind === 'error') {
      setImportError(result.message);
      return;
    }
    setImportBackendDuplicateFailureCount(0);
    applyParseResult(result);
  };

  const rebuildRemapContextFromFile = useCallback((): ImportRemapContext | null => {
    if (!uploadedFileText || !uploadedFileName || !remapContext) {
      return null;
    }
    const userScope = user?.id ?? 'anonymous';
    const gridResult = buildStatementGrid(uploadedFileText, userScope, uploadedFileName);
    if (!isStatementGrid(gridResult)) {
      return null;
    }
    const refreshed: ImportRemapContext = {
      ...remapContext,
      statementData: { header: gridResult.originalHeader, dataRows: gridResult.dataRows },
      signatures: [gridResult.headerSignature, gridResult.fileSignature],
    };
    setRemapContext(refreshed);
    return refreshed;
  }, [remapContext, uploadedFileName, uploadedFileText, user?.id]);

  const onRequestColumnRemap = () => {
    const context = remapContext ?? rebuildRemapContextFromFile();
    if (!context) {
      setImportError('Re-upload the statement file to remap columns.');
      return;
    }
    const suggested = suggestRemapIndicesFromStatement(context.appliedMapping, rows, context.statementData);
    const form = columnMappingIndicesToForm(suggested);
    setManualMappingData(context.statementData);
    setManualMappingSignatures(context.signatures);
    setManualDateIndex(form.dateIndex);
    setManualMerchantIndex(form.merchantIndex);
    setManualAmountIndex(form.amountIndex);
    setManualDescriptionIndex(form.descriptionIndex);
    setManualCurrencyIndex(form.currencyIndex);
    setIsRemappingColumns(true);
    setImportError(null);
    const swapped =
      suggested.merchantIndex !== context.appliedMapping.merchantIndex ||
      suggested.descriptionIndex !== context.appliedMapping.descriptionIndex;
    setImportInfo(
      swapped
        ? 'Merchant and description columns looked swapped — we pre-selected a fix. Confirm below and click Apply mapping.'
        : 'Choose which CSV column is the merchant (payee name). Then click Apply mapping.',
    );
  };

  const onSwapMerchantDescriptionColumns = () => {
    if (!manualMerchantIndex || !manualDescriptionIndex) {
      setImportError('Select both Merchant and Description columns before swapping.');
      return;
    }
    const merchant = manualMerchantIndex;
    setManualMerchantIndex(manualDescriptionIndex);
    setManualDescriptionIndex(merchant);
    setImportError(null);
  };

  const updateRow = (id: string, patch: Partial<ImportedRow>) => {
    setRows((previous) =>
      applyDuplicateFlags(
        previous.map((row) => {
          if (row.id !== id) {
            return row;
          }
          let next = { ...row, ...patch };
          if (next.flow === 'in') {
            next = {
              ...next,
              split: 'Personal',
              groupId: '',
              expenseGroup: '',
            };
          }
          if (patch.split && patch.split !== 'Shared') {
            next.groupId = '';
            next.expenseGroup = '';
          }
          if (patch.groupId !== undefined && patch.groupId !== row.groupId) {
            next.expenseGroup = '';
          }
          return applySharedCategoryDefaults(next);
        }),
        existingExpenseSignatures,
      ),
    );
  };

  const toggleAll = (selected: boolean) => {
    setRows((previous) =>
      previous.map((row) => ({
        ...row,
        selected: row.duplicateType === 'none' ? selected : false,
      })),
    );
  };

  const onApproveSelected = async () => {
    setImportError(null);
    setImportBackendDuplicateFailureCount(0);
    const selectedRows = rows.filter((row) => row.selected);
    if (selectedRows.length === 0) {
      setImportError('Select at least one row to import.');
      return;
    }
    for (const row of selectedRows) {
      const expenseTitle = buildExpenseTitleForImport(row);
      const parsedAmount = normalizeAmountValue(row.amount);
      if (!expenseTitle || !row.transactionDate || !row.category || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        setImportError(`Row "${expenseTitle || '(missing label)'}" has invalid required fields.`);
        return;
      }
      if (row.duplicateType !== 'none') {
        setImportError(`Row "${expenseTitle}" is marked as duplicate (${row.duplicateType}). Update it before import.`);
        return;
      }
      if (row.flow !== 'in' && row.split === 'Shared' && (!row.groupId || !row.expenseGroup)) {
        setImportError(`Shared row "${expenseTitle}" requires household and expense group.`);
        return;
      }
    }

    const importRows = selectedRows.map((row) => {
      const isIncoming = row.flow === 'in';
      const expense: AddExpenseInput = {
        title: buildExpenseTitleForImport(row),
        amount: normalizeAmountValue(row.amount),
        transactionDate: row.transactionDate,
        category: row.category,
        split: isIncoming ? 'Personal' : row.split,
        groupId: isIncoming ? undefined : row.split === 'Shared' ? row.groupId : undefined,
        expenseGroup: isIncoming ? undefined : row.split === 'Shared' ? row.expenseGroup : undefined,
        currency: normalizeStatementCurrency(row.currency),
        flow: isIncoming ? 'Incoming' : 'Outgoing',
      };
      return { clientRowId: row.id, ...expense };
    });

    let payload: ImportExpensesMutation['importExpenses'];
    try {
      const response = await importExpensesMutation({ variables: { input: { rows: importRows } } });
      if (!response.data?.importExpenses) {
        setImportError('Import failed.');
        return;
      }
      payload = response.data.importExpenses;
    } catch {
      setImportError('Import failed.');
      return;
    }

    const successfulIds = new Set(
      payload.results.filter((entry) => entry.success).map((entry) => entry.clientRowId),
    );
    const failedRows = payload.results
      .filter((entry) => !entry.success)
      .map((entry) => {
        const row = selectedRows.find((candidate) => candidate.id === entry.clientRowId);
        const label = row ? buildExpenseTitleForImport(row) : entry.clientRowId;
        return `${label}: ${entry.errorMessage ?? 'Import failed.'}`;
      });
    const backendDuplicateFailures = payload.results.filter(
      (entry) => !entry.success && isDuplicateImportResult(entry),
    ).length;

    if (backendDuplicateFailures > 0) {
      setImportBackendDuplicateFailureCount(backendDuplicateFailures);
    }

    const successfullyImportedRows = selectedRows.filter((row) => successfulIds.has(row.id));
    learnRulesFromImportedRows(successfullyImportedRows);

    setRows((previous) => previous.filter((row) => !successfulIds.has(row.id)));
    if (failedRows.length === 0) {
      setImportInfo(`Imported ${payload.importedCount} expense(s) successfully.`);
      return;
    }

    setImportInfo(`Imported ${payload.importedCount} expense(s). ${payload.failedCount} failed.`);
    setImportError(`Failed rows -> ${failedRows.slice(0, 5).join(' | ')}${failedRows.length > 5 ? ' | ...' : ''}`);
  };

  const onRemoveImportedFile = () => {
    setRows([]);
    setImportError(null);
    setImportInfo(null);
    setImportBackendDuplicateFailureCount(0);
    setRemapContext(null);
    setIsRemappingColumns(false);
    const cleared = clearManualMappingState();
    setManualMappingData(cleared.manualMappingData);
    setManualMappingSignatures(cleared.manualMappingSignatures);
    setManualDateIndex(cleared.manualDateIndex);
    setManualMerchantIndex(cleared.manualMerchantIndex);
    setManualAmountIndex(cleared.manualAmountIndex);
    setManualDescriptionIndex(cleared.manualDescriptionIndex);
    setManualCurrencyIndex(cleared.manualCurrencyIndex);
    setUploadedFileName('');
    setUploadedFileText(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const onRemoveInFileDuplicates = () => {
    const seenSignatures = new Set<string>();
    setRows((previous) =>
      previous.filter((row) => {
        if (row.duplicateType !== 'file') {
          return true;
        }
        const signature = buildImportSignature({
          title: row.title,
          transactionDate: row.transactionDate,
          amount: row.amount,
          flow: row.flow,
        });
        if (seenSignatures.has(signature)) {
          return false;
        }
        seenSignatures.add(signature);
        return true;
      }),
    );
  };

  useEffect(() => {
    if (!manualMappingData) {
      return;
    }
    mappingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [manualMappingData]);

  const handleUpsertRuleFromRow = (row: ImportedRow, matchType: 'exact' | 'contains') => {
    const info = upsertRuleFromRow(row, matchType);
    if (info) {
      setImportInfo(info);
    }
  };

  return {
    rows,
    importError,
    importInfo,
    importBackendDuplicateFailureCount,
    manualMappingData,
    mappingSectionRef,
    isRemappingColumns,
    remapContext,
    canRemapColumns: (remapContext !== null || uploadedFileText !== null) && rows.length > 0,
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
    isMutating: isImporting,
    onFileChange,
    onDropFile,
    onApplyManualMapping,
    onRequestColumnRemap,
    onSwapMerchantDescriptionColumns,
    updateRow,
    toggleAll,
    upsertRuleFromRow: handleUpsertRuleFromRow,
    updateMerchantRule,
    deleteMerchantRule,
    onApproveSelected,
    onRemoveImportedFile,
    onRemoveInFileDuplicates,
  };
};
