import { useMutation, useQuery } from '@apollo/client/react';
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  GET_EXPENSES,
  IMPORT_EXPENSES,
  isDuplicateImportResult,
  isOutgoingExpense,
  mergeImportedExpensesIntoCache,
  type AddExpenseInput,
  type Expense,
  type GetExpensesResponse,
  type SplitType,
} from '../expenses';
import { useAuth } from '../auth';
import { GET_GROUPS } from '../groups';
import type { GroupSummary } from '../groups';
import { APP_CURRENCY_CODE, normalizeStatementCurrency } from '../../format/currency';
import {
  ALLOWED_FILE_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  DESCRIPTION_COLUMN_ALIASES,
  MAX_IMPORT_FILE_SIZE_BYTES,
  MAX_IMPORT_ROWS,
} from './constants';
import {
  detectDelimiter,
  getFallbackHeader,
  includesAnyAlias,
  normalizeHeaderKey,
  padDataRowsToWidth,
  parseDelimitedLine,
  rowLooksLikeRepeatedHeader,
  sanitizeCellText,
  splitCsvRecords,
} from './csvParse';
import {
  categoryHistoryKey,
  getHeaderSignature,
  merchantHistoryKey,
  pickCompatibleSavedMapping,
  resolveDescriptionColumnIndex,
} from './columnMapping';
import { getDateSignatureVariants, pickDateColumnFromData } from './dateParse';
import { computeAmountColumnAssumeAllOutgoing, normalizeAmountValue } from './amountParse';
import {
  applyDuplicateFlags,
  buildExpenseTitleForImport,
  buildImportSignature,
  buildImportedRows,
} from './buildImportedRows';
import { loadCustomImportCategories, loadMerchantRules, loadSavedMappings, saveMappingForSignature, saveMerchantRules } from './importStorage';
import {
  importRuleMatchText,
  reapplyMerchantRulesToRows,
} from './merchantRules';
import type { ImportedRow, ImportMerchantRule, ParsedStatementData, SavedColumnMapping } from './types';

export const useImportPageState = () => {
  const { user } = useAuth();
  const { data: expensesData } = useQuery<GetExpensesResponse>(GET_EXPENSES);
  const { data: groupsData } = useQuery<{ groups: GroupSummary[] }>(GET_GROUPS);
  const [importExpensesMutation, { loading: isImporting }] = useMutation<{
    importExpenses: {
      importedCount: number;
      failedCount: number;
      results: Array<{
        clientRowId: string;
        success: boolean;
        errorCode?: string | null;
        errorMessage?: string | null;
        expense?: Expense | null;
      }>;
    };
  }>(IMPORT_EXPENSES, {
    update(cache, { data }) {
      const created =
        data?.importExpenses.results
          .filter((row) => row.success && row.expense)
          .map((row) => row.expense as Expense) ?? [];
      mergeImportedExpensesIntoCache(cache, created);
    },
    refetchQueries: [{ query: GET_GROUPS }],
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
  const [customCategories] = useState<string[]>(() => loadCustomImportCategories());
  const [merchantRules, setMerchantRules] = useState<ImportMerchantRule[]>(() => loadMerchantRules());
  const [newRuleMatchType, setNewRuleMatchType] = useState<'exact' | 'contains'>('exact');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setRows((previous) => {
      if (previous.length === 0) {
        return previous;
      }
      return reapplyMerchantRulesToRows(previous, merchantRules);
    });
  }, [merchantRules]);

  const groups = useMemo(() => groupsData?.groups ?? [], [groupsData?.groups]);
  const categoryOptions = useMemo(() => {
    const existingOutgoingCategories = (expensesData?.expenses ?? [])
      .filter(isOutgoingExpense)
      .map((expense) => expense.category.trim())
      .filter(Boolean);
    return Array.from(
      new Set([...DEFAULT_EXPENSE_CATEGORIES, ...existingOutgoingCategories, ...customCategories]),
    ).sort((left, right) => left.localeCompare(right));
  }, [customCategories, expensesData?.expenses]);
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

  const merchantHistory = useMemo(() => {
    const map = new Map<
      string,
      { category: string; split: SplitType; groupId: string; expenseGroup: string; transactionDate: string }
    >();
    (expensesData?.expenses ?? [])
      .slice()
      .sort((left, right) => right.transactionDate.localeCompare(left.transactionDate))
      .forEach((expense) => {
        const flow: 'out' | 'in' = isOutgoingExpense(expense) ? 'out' : 'in';
        const historyKey = merchantHistoryKey(expense.title, flow);
        if (!expense.title.trim() || map.has(historyKey)) {
          return;
        }
        map.set(historyKey, {
          category: expense.category,
          // Incoming rows are always personal/no household in import flow.
          split: flow === 'out' && expense.split === 'Shared' ? 'Shared' : 'Personal',
          groupId: flow === 'out' ? expense.groupId ?? '' : '',
          expenseGroup: flow === 'out' ? expense.expenseGroup ?? '' : '',
          transactionDate: expense.transactionDate,
        });
      });
    return map;
  }, [expensesData?.expenses]);
  const sharedCategoryHistory = useMemo(() => {
    const map = new Map<string, { groupId: string; expenseGroup: string }>();
    (expensesData?.expenses ?? [])
      .filter((expense) => isOutgoingExpense(expense) && expense.split === 'Shared')
      .slice()
      .sort((left, right) => right.transactionDate.localeCompare(left.transactionDate))
      .forEach((expense) => {
        const key = categoryHistoryKey(expense.category);
        const groupId = (expense.groupId ?? '').trim();
        const expenseGroup = (expense.expenseGroup ?? '').trim();
        if (!key || !groupId || !expenseGroup || map.has(key)) {
          return;
        }
        map.set(key, { groupId, expenseGroup });
      });
    return map;
  }, [expensesData?.expenses]);

  const applySharedCategoryDefaults = (row: ImportedRow): ImportedRow => {
    if (row.flow === 'in') {
      return { ...row, split: 'Personal', groupId: '', expenseGroup: '' };
    }
    if (row.split !== 'Shared') {
      return row;
    }
    const categoryKey = categoryHistoryKey(row.category);
    const history = sharedCategoryHistory.get(categoryKey);
    let nextGroupId = row.groupId;
    let nextExpenseGroup = row.expenseGroup;

    if (!nextGroupId && history?.groupId) {
      nextGroupId = history.groupId;
    }

    const groupOptions = nextGroupId ? expenseGroupByHousehold.get(nextGroupId) ?? [] : [];
    const matchedByCategory = groupOptions.find(
      (option) => option.trim().toLowerCase() === categoryKey,
    );
    if (!nextExpenseGroup && matchedByCategory) {
      nextExpenseGroup = matchedByCategory;
    }

    if (!nextExpenseGroup && history && history.groupId === nextGroupId) {
      const matchedByHistory = groupOptions.find(
        (option) => option.trim().toLowerCase() === history.expenseGroup.trim().toLowerCase(),
      );
      if (matchedByHistory) {
        nextExpenseGroup = matchedByHistory;
      }
    }

    if (nextGroupId === row.groupId && nextExpenseGroup === row.expenseGroup) {
      return row;
    }

    return {
      ...row,
      groupId: nextGroupId,
      expenseGroup: nextExpenseGroup,
    };
  };

  const existingExpenseSignatures = useMemo(() => {
    const signatures = new Set<string>();
    (expensesData?.expenses ?? []).filter(isOutgoingExpense).forEach((expense) => {
      const merchant = sanitizeCellText(expense.title).toLowerCase();
      const amount = normalizeAmountValue(String(expense.amount)).toFixed(2);
      const dateVariants = getDateSignatureVariants(expense.transactionDate);
      if (dateVariants.length === 0) {
        signatures.add(`${merchant}||${amount}`);
        return;
      }
      dateVariants.forEach((dateVariant) => {
        signatures.add(`${merchant}|${dateVariant}|${amount}`);
      });
    });
    return signatures;
  }, [expensesData?.expenses]);
  const duplicateStats = useMemo(() => {
    const existing = rows.filter((row) => row.duplicateType === 'existing').length;
    const inFile = rows.filter((row) => row.duplicateType === 'file').length;
    return {
      total: existing + inFile,
      existing,
      inFile,
    };
  }, [rows]);
  const fileDuplicateWarning = useMemo(() => {
    if (rows.length === 0) {
      return null;
    }
    const existingRatio = duplicateStats.existing / rows.length;
    if (duplicateStats.existing === rows.length) {
      return 'All imported rows match existing expenses. This statement appears to be already uploaded.';
    }
    if (rows.length >= 10 && existingRatio >= 0.8) {
      return `Most rows (${duplicateStats.existing}/${rows.length}) match existing expenses. This file may already be uploaded.`;
    }
    return null;
  }, [duplicateStats.existing, rows.length]);

  const rowNeedsManualAdjustment = (row: ImportedRow): boolean => {
    if (!row.transactionDate || !row.category || normalizeAmountValue(row.amount) <= 0) {
      return true;
    }
    if (row.duplicateType !== 'none') {
      return true;
    }
    if (normalizeStatementCurrency(row.currency) !== APP_CURRENCY_CODE) {
      return true;
    }
    if (row.flow === 'out' && row.split === 'Shared' && (!row.groupId || !row.expenseGroup)) {
      return true;
    }
    return false;
  };

  const sortRowsForInitialReview = (inputRows: ImportedRow[]): ImportedRow[] =>
    inputRows
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const leftNeeds = rowNeedsManualAdjustment(left.row);
        const rightNeeds = rowNeedsManualAdjustment(right.row);
        if (leftNeeds !== rightNeeds) {
          return leftNeeds ? -1 : 1;
        }
        const leftConfidence =
          left.row.confidence === 'low' ? 0 : left.row.confidence === 'medium' ? 1 : 2;
        const rightConfidence =
          right.row.confidence === 'low' ? 0 : right.row.confidence === 'medium' ? 1 : 2;
        if (leftConfidence !== rightConfidence) {
          return leftConfidence - rightConfidence;
        }
        return left.index - right.index;
      })
      .map((entry) => entry.row);

  const parseStatement = async (file: File) => {
    setImportError(null);
    setImportInfo(null);
    setImportBackendDuplicateFailureCount(0);
    const text = (await file.text()).replace(/^\uFEFF/, '');
    const userScope = user?.id ?? 'anonymous';
    const rawLines = splitCsvRecords(text)
      .map((line) => line.trim())
      .filter(Boolean);
    if (rawLines.length < 2) {
      setImportError('The file is empty or missing data rows.');
      return;
    }
    if (rawLines.length - 1 > MAX_IMPORT_ROWS) {
      setImportError(`File has too many rows (${rawLines.length - 1}). Maximum allowed is ${MAX_IMPORT_ROWS}.`);
      return;
    }

    const delimiter = detectDelimiter(rawLines.slice(0, 6));
    const parsedHeader = parseDelimitedLine(rawLines[0], delimiter);
    let dataRows = rawLines.slice(1).map((line) => parseDelimitedLine(line, delimiter));
    const originalHeader = getFallbackHeader(parsedHeader, dataRows);
    dataRows = padDataRowsToWidth(
      dataRows.filter((row) => !rowLooksLikeRepeatedHeader(row, originalHeader)),
      originalHeader.length,
    );
    const normalizedFileName = file.name.trim().toLowerCase();
    const baseHeaderSignature = getHeaderSignature(originalHeader);
    const headerSignature = `${userScope}:${baseHeaderSignature}`;
    const anonymousHeaderSignature = `anonymous:${baseHeaderSignature}`;
    const fileSignature = `${userScope}:file:${normalizedFileName}`;
    const anonymousFileSignature = `anonymous:file:${normalizedFileName}`;
    const header = originalHeader.map((cell) => normalizeHeaderKey(cell));
    const savedMappings = loadSavedMappings();
    const debitAliases = [
      'debit',
      'withdrawal',
      'outflow',
      'expense',
      'udbetaling',
      'udgift',
      'debitering',
      'afgang',
      'belobud',
    ];
    const creditAliases = [
      'credit',
      'deposit',
      'inflow',
      'income',
      'indbetaling',
      'tilgang',
      'kreditering',
      'belobind',
    ];
    const currencyAliases = ['currency', 'valuta', 'coin', 'ccy', 'curr', 'iso4217'];
    const fallbackDebitIndex = header.findIndex((cell) => includesAnyAlias(cell, debitAliases));
    const fallbackCreditIndex = header.findIndex((cell) => includesAnyAlias(cell, creditAliases));
    const fallbackCurrencyIndex = header.findIndex((cell) => includesAnyAlias(cell, currencyAliases));
    const mappingLookupOrder = [headerSignature, fileSignature, anonymousHeaderSignature, anonymousFileSignature];
    const rememberedPick = pickCompatibleSavedMapping(
      savedMappings,
      mappingLookupOrder,
      headerSignature,
      anonymousHeaderSignature,
      originalHeader,
    );
    const rememberedMapping = rememberedPick?.mapping ?? null;
    const isRememberedMappingValid = rememberedMapping !== null;
    const hasSavedLayoutsButNoneMatch =
      Object.keys(savedMappings).length > 0 && rememberedPick === null;

    if (isRememberedMappingValid) {
      if (userScope !== 'anonymous' && !savedMappings[headerSignature]) {
        saveMappingForSignature(headerSignature, rememberedMapping);
      }
      const rememberedCurrencyIdx = rememberedMapping.currencyIndex ?? -1;
      const resolvedDateIndex = pickDateColumnFromData(header, dataRows, rememberedMapping.dateIndex);
      const resolvedDescriptionIdx = resolveDescriptionColumnIndex(
        header,
        rememberedMapping.merchantIndex,
        rememberedMapping.descriptionIndex,
      );
      const rememberedAssumeOutgoing = computeAmountColumnAssumeAllOutgoing(
        dataRows,
        rememberedMapping.amountIndex,
        fallbackDebitIndex,
        fallbackCreditIndex,
      );
      const parsedRows = buildImportedRows(
        dataRows,
        resolvedDateIndex,
        rememberedMapping.merchantIndex,
        rememberedMapping.amountIndex,
        fallbackDebitIndex,
        fallbackCreditIndex,
        rememberedCurrencyIdx >= 0 ? rememberedCurrencyIdx : fallbackCurrencyIndex,
        resolvedDescriptionIdx,
        rememberedAssumeOutgoing,
        merchantRules,
        merchantHistory,
      );
      const validRows = parsedRows.filter(
        (row) => (row.title.trim() || row.description.trim()) && Number(row.amount) > 0,
      );
      if (validRows.length > 0) {
        const flaggedRows = applyDuplicateFlags(
          validRows.map(applySharedCategoryDefaults),
          existingExpenseSignatures,
        );
        setRows(sortRowsForInitialReview(flaggedRows));
        setManualMappingData(null);
        setManualMappingSignatures([]);
        setManualDateIndex('');
        setManualMerchantIndex('');
        setManualAmountIndex('');
        setManualDescriptionIndex('');
        setManualCurrencyIndex('');
        if (userScope !== 'anonymous') {
          let mappingToPersist = rememberedMapping;
          if (resolvedDateIndex !== rememberedMapping.dateIndex) {
            mappingToPersist = {
              ...mappingToPersist,
              dateIndex: resolvedDateIndex,
              dateHeaderKey: normalizeHeaderKey(originalHeader[resolvedDateIndex] ?? ''),
            };
          }
          if (resolvedDescriptionIdx >= 0) {
            mappingToPersist = {
              ...mappingToPersist,
              descriptionIndex: resolvedDescriptionIdx,
              descriptionHeaderKey: normalizeHeaderKey(originalHeader[resolvedDescriptionIdx] ?? ''),
            };
          }
          saveMappingForSignature(headerSignature, mappingToPersist);
          saveMappingForSignature(fileSignature, mappingToPersist);
        }
        setImportInfo(`Parsed ${validRows.length} transaction(s) using remembered column mapping.`);
        return;
      }
    }
    const merchantAliases = [
      'merchant',
      'payee',
      'title',
      'recipient',
      'counterparty',
      'sanemejs',
      'nosaukums',
      'navn',
      'afsender',
      'modtager',
    ];
    const amountAliases = ['amount', 'sum', 'value', 'summa', 'apjoms', 'belob', 'belb'];
    const dateIndex = pickDateColumnFromData(header, dataRows, -1);
    const descriptionCandidate = header.findIndex((cell) => includesAnyAlias(cell, DESCRIPTION_COLUMN_ALIASES));
    const merchantIndex = header.findIndex(
      (cell, idx) =>
        (descriptionCandidate < 0 || idx !== descriptionCandidate) && includesAnyAlias(cell, merchantAliases),
    );
    const descriptionIndex = resolveDescriptionColumnIndex(
      header,
      merchantIndex,
      descriptionCandidate >= 0 ? descriptionCandidate : undefined,
    );
    const amountIndex = header.findIndex((cell) => includesAnyAlias(cell, amountAliases));
    const debitIndex = fallbackDebitIndex;
    const creditIndex = fallbackCreditIndex;
    const currencyColumnIndex = fallbackCurrencyIndex;

    if (dateIndex < 0 || merchantIndex < 0 || (amountIndex < 0 && debitIndex < 0 && creditIndex < 0)) {
      setManualMappingData({
        header: originalHeader,
        dataRows,
      });
      setManualMappingSignatures([headerSignature, fileSignature]);
      const rememberedDateIndex = isRememberedMappingValid ? String(rememberedMapping.dateIndex) : '';
      const rememberedMerchantIndex = isRememberedMappingValid ? String(rememberedMapping.merchantIndex) : '';
      const rememberedAmountIndex = isRememberedMappingValid ? String(rememberedMapping.amountIndex) : '';
      const rememberedCurrencyIndex =
        isRememberedMappingValid &&
        rememberedMapping !== null &&
        rememberedMapping.currencyIndex !== undefined &&
        rememberedMapping.currencyIndex >= 0
          ? String(rememberedMapping.currencyIndex)
          : '';
      const rememberedDescriptionIndexStr =
        isRememberedMappingValid &&
        rememberedMapping !== null &&
        rememberedMapping.descriptionIndex !== undefined &&
        rememberedMapping.descriptionIndex >= 0
          ? String(rememberedMapping.descriptionIndex)
          : '';
      setManualDateIndex(dateIndex >= 0 ? String(dateIndex) : '');
      setManualMerchantIndex(merchantIndex >= 0 ? String(merchantIndex) : '');
      setManualAmountIndex(amountIndex >= 0 ? String(amountIndex) : '');
      setManualDescriptionIndex(
        descriptionIndex >= 0 ? String(descriptionIndex) : rememberedDescriptionIndexStr,
      );
      setManualCurrencyIndex(currencyColumnIndex >= 0 ? String(currencyColumnIndex) : rememberedCurrencyIndex);
      if (dateIndex < 0) {
        setManualDateIndex(rememberedDateIndex);
      }
      if (merchantIndex < 0) {
        setManualMerchantIndex(rememberedMerchantIndex);
      }
      if (amountIndex < 0) {
        setManualAmountIndex(rememberedAmountIndex);
      }
      setImportError(
        `${hasSavedLayoutsButNoneMatch ? 'This file’s column headers don’t match any saved import layout. Map columns below; the new layout will be saved without removing your others.\n\n' : ''}Could not auto-detect required columns. Please map Date, Merchant, Amount, and optionally Description and Currency below.`,
      );
      return;
    }

    const amountColumnAssumeAllOutgoing = computeAmountColumnAssumeAllOutgoing(
      dataRows,
      amountIndex,
      debitIndex,
      creditIndex,
    );
    const parsedRows = buildImportedRows(
      dataRows,
      dateIndex,
      merchantIndex,
      amountIndex,
      debitIndex,
      creditIndex,
      currencyColumnIndex,
      descriptionIndex,
      amountColumnAssumeAllOutgoing,
      merchantRules,
      merchantHistory,
    );

    const validRows = parsedRows.filter(
      (row) => (row.title.trim() || row.description.trim()) && Number(row.amount) > 0,
    );
    if (validRows.length === 0) {
      setImportError('No valid transactions found after parsing.');
      return;
    }
    const flaggedRows = applyDuplicateFlags(
      validRows.map(applySharedCategoryDefaults),
      existingExpenseSignatures,
    );
    setRows(sortRowsForInitialReview(flaggedRows));
    setManualMappingData(null);
    setManualMappingSignatures([]);
    setManualDateIndex('');
    setManualMerchantIndex('');
    setManualAmountIndex('');
    setManualDescriptionIndex('');
    setManualCurrencyIndex('');
    const preferredAmountIndex = amountIndex >= 0 ? amountIndex : debitIndex >= 0 ? debitIndex : creditIndex;
    if (dateIndex >= 0 && merchantIndex >= 0 && preferredAmountIndex >= 0) {
      const baseMapping: SavedColumnMapping = {
        dateIndex,
        merchantIndex,
        amountIndex: preferredAmountIndex,
        dateHeaderKey: normalizeHeaderKey(originalHeader[dateIndex] ?? ''),
        merchantHeaderKey: normalizeHeaderKey(originalHeader[merchantIndex] ?? ''),
        amountHeaderKey: normalizeHeaderKey(originalHeader[preferredAmountIndex] ?? ''),
        ...(descriptionIndex >= 0
          ? {
              descriptionIndex,
              descriptionHeaderKey: normalizeHeaderKey(originalHeader[descriptionIndex] ?? ''),
            }
          : {}),
      };
      const mappingToSave: SavedColumnMapping =
        currencyColumnIndex >= 0
          ? {
              ...baseMapping,
              currencyIndex: currencyColumnIndex,
              currencyHeaderKey: normalizeHeaderKey(originalHeader[currencyColumnIndex] ?? ''),
            }
          : baseMapping;
      saveMappingForSignature(headerSignature, mappingToSave);
      saveMappingForSignature(fileSignature, mappingToSave);
    }
    setImportInfo(
      `${hasSavedLayoutsButNoneMatch ? 'Headers didn’t match a saved layout; this one was mapped from scratch and saved alongside your others.\n\n' : ''}Parsed ${validRows.length} transaction(s). Review and approve import.`,
    );
  };

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
      await parseStatement(file);
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
    const dateIndex = Number(manualDateIndex);
    const merchantIndex = Number(manualMerchantIndex);
    const amountIndex = Number(manualAmountIndex);
    const parsedManualCurrencyIndex =
      manualCurrencyIndex === '' ? -1 : Number(manualCurrencyIndex);
    const currencyIdx =
      Number.isInteger(parsedManualCurrencyIndex) && parsedManualCurrencyIndex >= 0
        ? parsedManualCurrencyIndex
        : -1;
    const parsedManualDescriptionIndex =
      manualDescriptionIndex === '' ? -1 : Number(manualDescriptionIndex);
    const descriptionIdx =
      Number.isInteger(parsedManualDescriptionIndex) && parsedManualDescriptionIndex >= 0
        ? parsedManualDescriptionIndex
        : -1;
    if (!Number.isInteger(dateIndex) || !Number.isInteger(merchantIndex) || !Number.isInteger(amountIndex)) {
      setImportError('Select Date, Merchant, and Amount columns to continue.');
      return;
    }
    const manualAssumeOutgoing = computeAmountColumnAssumeAllOutgoing(
      manualMappingData.dataRows,
      amountIndex,
      -1,
      -1,
    );
    const parsedRows = buildImportedRows(
      manualMappingData.dataRows,
      dateIndex,
      merchantIndex,
      amountIndex,
      -1,
      -1,
      currencyIdx,
      descriptionIdx,
      manualAssumeOutgoing,
      merchantRules,
      merchantHistory,
    );
    const validRows = parsedRows.filter(
      (row) => (row.title.trim() || row.description.trim()) && Number(row.amount) > 0,
    );
    if (validRows.length === 0) {
      setImportError('No valid transactions found with selected mapping.');
      return;
    }
    const flaggedRows = applyDuplicateFlags(
      validRows.map(applySharedCategoryDefaults),
      existingExpenseSignatures,
    );
    setRows(sortRowsForInitialReview(flaggedRows));
    setManualMappingData(null);
    setManualMappingSignatures([]);
    setImportError(null);
    setImportBackendDuplicateFailureCount(0);
    const manualBaseMapping: SavedColumnMapping = {
      dateIndex,
      merchantIndex,
      amountIndex,
      dateHeaderKey: normalizeHeaderKey(manualMappingData.header[dateIndex] ?? ''),
      merchantHeaderKey: normalizeHeaderKey(manualMappingData.header[merchantIndex] ?? ''),
      amountHeaderKey: normalizeHeaderKey(manualMappingData.header[amountIndex] ?? ''),
    };
    let manualMappingPayload: SavedColumnMapping =
      currencyIdx >= 0
        ? {
            ...manualBaseMapping,
            currencyIndex: currencyIdx,
            currencyHeaderKey: normalizeHeaderKey(manualMappingData.header[currencyIdx] ?? ''),
          }
        : manualBaseMapping;
    if (descriptionIdx >= 0) {
      manualMappingPayload = {
        ...manualMappingPayload,
        descriptionIndex: descriptionIdx,
        descriptionHeaderKey: normalizeHeaderKey(manualMappingData.header[descriptionIdx] ?? ''),
      };
    }
    if (manualMappingSignatures.length > 0) {
      manualMappingSignatures.forEach((signature) => {
        saveMappingForSignature(signature, manualMappingPayload);
      });
    } else {
      saveMappingForSignature(`anonymous:manual:${Date.now()}`, manualMappingPayload);
    }
    setImportInfo(`Parsed ${validRows.length} transaction(s) using manual column mapping.`);
    setManualDescriptionIndex('');
  };

  const updateRow = (id: string, patch: Partial<ImportedRow>) => {
    setRows((previous) =>
      applyDuplicateFlags(previous.map((row) => {
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
      }), existingExpenseSignatures),
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

  const learnRulesFromImportedRows = (importedRows: ImportedRow[]) => {
    if (importedRows.length === 0) {
      return;
    }
    setMerchantRules((previous) => {
      const next = [...previous];
      importedRows.forEach((row) => {
        const pattern = importRuleMatchText(row).toLowerCase();
        if (!pattern) {
          return;
        }
        const flow = row.flow;
        const existingIndex = next.findIndex(
          (rule) => rule.flow === flow && rule.matchType === 'exact' && rule.pattern.trim().toLowerCase() === pattern,
        );
        const candidate: ImportMerchantRule = {
          id: existingIndex >= 0 ? next[existingIndex].id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          flow,
          matchType: 'exact',
          pattern,
          category: row.category,
          split: flow === 'out' ? row.split : 'Personal',
          groupId: flow === 'out' && row.split === 'Shared' ? row.groupId : '',
          expenseGroup: flow === 'out' && row.split === 'Shared' ? row.expenseGroup : '',
          updatedAt: new Date().toISOString(),
        };
        if (existingIndex >= 0) {
          next[existingIndex] = candidate;
        } else {
          next.push(candidate);
        }
      });
      saveMerchantRules(next);
      return next;
    });
  };

  const upsertRuleFromRow = (row: ImportedRow, matchType: 'exact' | 'contains') => {
    const pattern = importRuleMatchText(row).toLowerCase();
    if (!pattern) {
      return;
    }
    setMerchantRules((previous) => {
      const next = [...previous];
      const existingIndex = next.findIndex(
        (rule) => rule.flow === row.flow && rule.matchType === matchType && rule.pattern.trim().toLowerCase() === pattern,
      );
      const candidate: ImportMerchantRule = {
        id: existingIndex >= 0 ? next[existingIndex].id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        flow: row.flow,
        matchType,
        pattern,
        category: row.category,
        split: row.flow === 'out' ? row.split : 'Personal',
        groupId: row.flow === 'out' && row.split === 'Shared' ? row.groupId : '',
        expenseGroup: row.flow === 'out' && row.split === 'Shared' ? row.expenseGroup : '',
        updatedAt: new Date().toISOString(),
      };
      if (existingIndex >= 0) {
        next[existingIndex] = candidate;
      } else {
        next.push(candidate);
      }
      saveMerchantRules(next);
      return next;
    });
    setImportInfo(`Saved ${matchType} rule for "${importRuleMatchText(row)}".`);
  };

  const updateMerchantRule = (id: string, patch: Partial<ImportMerchantRule>) => {
    setMerchantRules((previous) => {
      const next = previous.map((rule) => {
        if (rule.id !== id) {
          return rule;
        }
        return {
          ...rule,
          ...patch,
          updatedAt: new Date().toISOString(),
        };
      });
      saveMerchantRules(next);
      return next;
    });
  };

  const deleteMerchantRule = (id: string) => {
    setMerchantRules((previous) => {
      const next = previous.filter((rule) => rule.id !== id);
      saveMerchantRules(next);
      return next;
    });
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
      const rowCurrencyCode = normalizeStatementCurrency(row.currency);
      if (rowCurrencyCode !== APP_CURRENCY_CODE) {
        setImportError(
          `Row "${expenseTitle}" is ${rowCurrencyCode}, not ${APP_CURRENCY_CODE}. Fix the currency or remove the row.`,
        );
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
        currency: APP_CURRENCY_CODE,
        flow: isIncoming ? 'Incoming' : 'Outgoing',
      };
      return { clientRowId: row.id, ...expense };
    });

    let payload: {
      importedCount: number;
      failedCount: number;
      results: Array<{
        clientRowId: string;
        success: boolean;
        errorCode?: string | null;
        errorMessage?: string | null;
      }>;
    };
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
    setManualMappingData(null);
    setManualMappingSignatures([]);
    setManualDateIndex('');
    setManualMerchantIndex('');
    setManualAmountIndex('');
    setManualDescriptionIndex('');
    setManualCurrencyIndex('');
    setUploadedFileName('');
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

  return {
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
    isMutating: isImporting,
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
  };
};
