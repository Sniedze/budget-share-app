import { useQuery } from '@apollo/client/react';
import { ChangeEvent, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { Sidebar } from '../components/sections';
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
import {
  GET_EXPENSES,
  getMutationErrorMessage,
  isBackendDuplicateExpenseError,
  useExpenseActions,
  type GetExpensesResponse,
  type SplitType,
} from '../features/expenses';
import { useAuth } from '../features/auth';
import { GET_GROUPS } from '../features/groups';
import type { GroupSummary } from '../features/groups';
import { colors, spacing } from '../styles/tokens';

const DEFAULT_CATEGORY_OPTIONS = [
  'General',
  'Groceries',
  'Utilities',
  'Rent',
  'Transport',
  'Entertainment',
  'Health',
  'Other',
];
const MAX_IMPORT_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_IMPORT_ROWS = 1000;
const ALLOWED_FILE_EXTENSIONS = ['.csv', '.txt'];
const ALLOWED_MIME_TYPES = ['text/csv', 'text/plain', 'application/vnd.ms-excel'];
const IMPORT_COLUMN_MAPPING_STORAGE_KEY = 'budgetshare.import.columnMappings.v1';
const IMPORT_FILE_FINGERPRINTS_STORAGE_KEY = 'budgetshare.import.fileFingerprints.v1';

const Panel = styled(Card)`
  display: grid;
  gap: ${spacing.md};
  margin-bottom: ${spacing.lg};
`;

const Actions = styled.div`
  display: flex;
  gap: ${spacing.sm};
  flex-wrap: wrap;
`;

const InlineInput = styled(Input)`
  min-width: 120px;
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

type ImportedRow = {
  id: string;
  selected: boolean;
  transactionDate: string;
  title: string;
  amount: string;
  category: string;
  split: SplitType;
  groupId: string;
  expenseGroup: string;
  confidence: 'high' | 'medium' | 'low';
  duplicateType: 'none' | 'existing' | 'file';
};

type ParsedStatementData = {
  header: string[];
  dataRows: string[][];
};

type SavedColumnMapping = {
  dateIndex: number;
  merchantIndex: number;
  amountIndex: number;
  dateHeaderKey?: string;
  merchantHeaderKey?: string;
  amountHeaderKey?: string;
};

const parseDelimitedLine = (line: string, delimiter: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  result.push(current.trim());
  return result;
};

const detectDelimiter = (sampleLines: string[]): string => {
  const candidates = [',', ';', '\t'];
  const scored = candidates.map((candidate) => {
    const score = sampleLines.reduce((sum, line) => {
      return sum + parseDelimitedLine(line, candidate).length;
    }, 0);
    return { delimiter: candidate, score };
  });
  const best = scored.sort((left, right) => right.score - left.score)[0];
  return best?.score > 1 ? best.delimiter : ',';
};

const normalizeHeaderKey = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const includesAnyAlias = (header: string, aliases: string[]): boolean =>
  aliases.some((alias) => header.includes(alias));

const getHeaderSignature = (header: string[]): string =>
  header.map((cell) => normalizeHeaderKey(cell)).join('|');

const loadSavedMappings = (): Record<string, SavedColumnMapping> => {
  try {
    const raw = localStorage.getItem(IMPORT_COLUMN_MAPPING_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as Record<string, SavedColumnMapping>;
  } catch {
    return {};
  }
};

const saveMappingForSignature = (signature: string, mapping: SavedColumnMapping): void => {
  try {
    const previous = loadSavedMappings();
    const next = {
      ...previous,
      [signature]: mapping,
    };
    localStorage.setItem(IMPORT_COLUMN_MAPPING_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage issues to keep import flow functional.
  }
};

const createContentFingerprint = (content: string): string => {
  let hash = 5381;
  for (let index = 0; index < content.length; index += 1) {
    hash = (hash * 33) ^ content.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

const loadSavedFileFingerprints = (): Record<string, true> => {
  try {
    const raw = localStorage.getItem(IMPORT_FILE_FINGERPRINTS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as Record<string, true>;
  } catch {
    return {};
  }
};

const saveFileFingerprint = (key: string): void => {
  try {
    const previous = loadSavedFileFingerprints();
    localStorage.setItem(
      IMPORT_FILE_FINGERPRINTS_STORAGE_KEY,
      JSON.stringify({
        ...previous,
        [key]: true,
      }),
    );
  } catch {
    // Ignore storage failures.
  }
};

const resolveSavedMapping = (
  mapping: SavedColumnMapping | undefined,
  header: string[],
): SavedColumnMapping | null => {
  if (!mapping) {
    return null;
  }

  const findIndexByHeaderKey = (key?: string): number => {
    if (!key) {
      return -1;
    }
    return header.findIndex((column) => normalizeHeaderKey(column) === key);
  };

  const resolvedDateIndex = findIndexByHeaderKey(mapping.dateHeaderKey);
  const resolvedMerchantIndex = findIndexByHeaderKey(mapping.merchantHeaderKey);
  const resolvedAmountIndex = findIndexByHeaderKey(mapping.amountHeaderKey);

  const dateIndex = resolvedDateIndex >= 0 ? resolvedDateIndex : mapping.dateIndex;
  const merchantIndex = resolvedMerchantIndex >= 0 ? resolvedMerchantIndex : mapping.merchantIndex;
  const amountIndex = resolvedAmountIndex >= 0 ? resolvedAmountIndex : mapping.amountIndex;

  const isValid =
    dateIndex >= 0 &&
    dateIndex < header.length &&
    merchantIndex >= 0 &&
    merchantIndex < header.length &&
    amountIndex >= 0 &&
    amountIndex < header.length;

  if (!isValid) {
    return null;
  }

  return {
    ...mapping,
    dateIndex,
    merchantIndex,
    amountIndex,
  };
};

const normalizeDate = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  const isoLike = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoLike) {
    const year = isoLike[1];
    const month = isoLike[2].padStart(2, '0');
    const day = isoLike[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const dateTimeIsoLike = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})T/);
  if (dateTimeIsoLike) {
    const year = dateTimeIsoLike[1];
    const month = dateTimeIsoLike[2].padStart(2, '0');
    const day = dateTimeIsoLike[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const slash = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (slash) {
    const day = slash[1];
    const month = slash[2];
    const year = slash[3];
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) {
    const year = String(direct.getUTCFullYear());
    const month = String(direct.getUTCMonth() + 1).padStart(2, '0');
    const day = String(direct.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return '';
};

const sanitizeCellText = (raw: string): string => {
  const cleaned = Array.from(raw)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('')
    .trim();
  if (!cleaned) {
    return '';
  }
  // Prevent CSV/formula injection when displaying or re-exporting user-provided text.
  if (/^[=+\-@]/.test(cleaned)) {
    return `'${cleaned}`;
  }
  return cleaned;
};

const getFallbackHeader = (header: string[], dataRows: string[][]): string[] => {
  const hasUsableHeader = header.some((value) => value.trim().length > 0);
  if (hasUsableHeader && header.length > 1) {
    return header;
  }
  const widthFromRows = dataRows.reduce((max, row) => Math.max(max, row.length), header.length);
  return Array.from({ length: Math.max(widthFromRows, 1) }, (_, index) => `Column ${index + 1}`);
};

const normalizeAmountValue = (raw: string): number => {
  const normalized = raw.replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
};

const formatDateYmd = (date: Date): string => {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDateSignatureVariants = (rawDate: string): string[] => {
  const normalized = normalizeDate(rawDate);
  if (!normalized) {
    return [];
  }
  const variants = new Set<string>([normalized]);
  if (rawDate.includes('T')) {
    const parsed = new Date(rawDate);
    if (!Number.isNaN(parsed.getTime())) {
      const minusOne = new Date(parsed.getTime() - 24 * 60 * 60 * 1000);
      const plusOne = new Date(parsed.getTime() + 24 * 60 * 60 * 1000);
      variants.add(formatDateYmd(parsed));
      variants.add(formatDateYmd(minusOne));
      variants.add(formatDateYmd(plusOne));
    }
  }
  return Array.from(variants);
};

const buildImportSignature = (row: {
  title: string;
  transactionDate: string;
  amount: string;
}): string => {
  const merchant = sanitizeCellText(row.title).toLowerCase();
  const date = normalizeDate(row.transactionDate);
  const amount = normalizeAmountValue(row.amount).toFixed(2);
  return `${merchant}|${date}|${amount}`;
};

const applyDuplicateFlags = (
  importedRows: ImportedRow[],
  existingSignatures: Set<string>,
): ImportedRow[] => {
  const signatureCounts = new Map<string, number>();
  importedRows.forEach((row) => {
    const signature = buildImportSignature(row);
    signatureCounts.set(signature, (signatureCounts.get(signature) ?? 0) + 1);
  });

  return importedRows.map((row) => {
    const signature = buildImportSignature(row);
    const isExistingDuplicate = existingSignatures.has(signature);
    const isFileDuplicate = (signatureCounts.get(signature) ?? 0) > 1;
    const duplicateType: ImportedRow['duplicateType'] = isExistingDuplicate
      ? 'existing'
      : isFileDuplicate
        ? 'file'
        : 'none';
    return {
      ...row,
      duplicateType,
      selected: duplicateType === 'none' ? row.selected : false,
    };
  });
};

const buildImportedRows = (
  dataRows: string[][],
  dateIndex: number,
  merchantIndex: number,
  amountIndex: number,
  debitIndex: number,
  creditIndex: number,
  merchantHistory: Map<
    string,
    { category: string; split: SplitType; groupId: string; expenseGroup: string; transactionDate: string }
  >,
): ImportedRow[] =>
  dataRows.map((cells, index) => {
    const transactionDate = normalizeDate(cells[dateIndex] ?? '');
    const title = sanitizeCellText(cells[merchantIndex] ?? '');
    const rawAmountCell = amountIndex >= 0 ? cells[amountIndex] ?? '' : '';
    const rawDebitCell = debitIndex >= 0 ? cells[debitIndex] ?? '' : '';
    const rawCreditCell = creditIndex >= 0 ? cells[creditIndex] ?? '' : '';
    const amountSource = rawAmountCell || rawDebitCell || rawCreditCell;
    const amountRaw = amountSource.replace(',', '.').replace(/[^\d.-]/g, '');
    const amount = String(Math.abs(Number(amountRaw || '0')));
    const history = merchantHistory.get(title.toLowerCase());
    const isShared = history?.split === 'Shared';
    return {
      id: `${Date.now()}-${index}`,
      selected: true,
      transactionDate,
      title,
      amount,
      category: history?.category ?? 'General',
      split: isShared ? 'Shared' : 'Personal',
      groupId: history?.groupId ?? '',
      expenseGroup: history?.expenseGroup ?? '',
      confidence: history ? 'high' : title ? 'medium' : 'low',
      duplicateType: 'none',
    };
  });

export const ImportPage = (): JSX.Element => {
  const { user } = useAuth();
  const { data: expensesData } = useQuery<GetExpensesResponse>(GET_EXPENSES);
  const { data: groupsData } = useQuery<{ groups: GroupSummary[] }>(GET_GROUPS);
  const { addExpense, isMutating } = useExpenseActions(GET_EXPENSES);
  const [rows, setRows] = useState<ImportedRow[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importInfo, setImportInfo] = useState<string | null>(null);
  const [importBackendDuplicateFailureCount, setImportBackendDuplicateFailureCount] = useState(0);
  const [manualMappingData, setManualMappingData] = useState<ParsedStatementData | null>(null);
  const [manualMappingSignatures, setManualMappingSignatures] = useState<string[]>([]);
  const [manualDateIndex, setManualDateIndex] = useState('');
  const [manualMerchantIndex, setManualMerchantIndex] = useState('');
  const [manualAmountIndex, setManualAmountIndex] = useState('');
  const [currentFileFingerprintKey, setCurrentFileFingerprintKey] = useState<string | null>(null);
  const [isExactFileReupload, setIsExactFileReupload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const groups = useMemo(() => groupsData?.groups ?? [], [groupsData?.groups]);
  const categoryOptions = useMemo(
    () => [...DEFAULT_CATEGORY_OPTIONS].sort((left, right) => left.localeCompare(right)),
    [],
  );

  const expenseGroupByHousehold = useMemo(() => {
    const map = new Map<string, string[]>();
    groups.forEach((group) => {
      const options = Array.from(
        new Set(
          group.expenses
            .map((expense) => (expense.expenseGroup ?? '').trim())
            .filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right));
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
        const merchant = expense.title.trim().toLowerCase();
        if (!merchant || map.has(merchant)) {
          return;
        }
        map.set(merchant, {
          category: expense.category,
          split: expense.split === 'Shared' ? 'Shared' : 'Personal',
          groupId: expense.groupId ?? '',
          expenseGroup: expense.expenseGroup ?? '',
          transactionDate: expense.transactionDate,
        });
      });
    return map;
  }, [expensesData?.expenses]);
  const existingExpenseSignatures = useMemo(() => {
    const signatures = new Set<string>();
    (expensesData?.expenses ?? []).forEach((expense) => {
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

  const parseStatement = async (file: File) => {
    setImportError(null);
    setImportInfo(null);
    setImportBackendDuplicateFailureCount(0);
    const text = (await file.text()).replace(/^\uFEFF/, '');
    const userScope = user?.id ?? 'anonymous';
    const contentFingerprint = createContentFingerprint(text);
    const fingerprintKey = `${userScope}:${contentFingerprint}`;
    setCurrentFileFingerprintKey(fingerprintKey);
    const savedFingerprints = loadSavedFileFingerprints();
    const seenBefore = Boolean(savedFingerprints[fingerprintKey]);
    setIsExactFileReupload(seenBefore);
    const rawLines = text
      .split(/\r?\n/)
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
    const dataRows = rawLines.slice(1).map((line) => parseDelimitedLine(line, delimiter));
    const originalHeader = getFallbackHeader(parsedHeader, dataRows);
    const normalizedFileName = file.name.trim().toLowerCase();
    const baseHeaderSignature = getHeaderSignature(originalHeader);
    const headerSignature = `${userScope}:${baseHeaderSignature}`;
    const anonymousHeaderSignature = `anonymous:${baseHeaderSignature}`;
    const fileSignature = `${userScope}:file:${normalizedFileName}`;
    const anonymousFileSignature = `anonymous:file:${normalizedFileName}`;
    const header = originalHeader.map((cell) => normalizeHeaderKey(cell));
    const savedMappings = loadSavedMappings();
    const mappingLookupOrder = [headerSignature, fileSignature, anonymousHeaderSignature, anonymousFileSignature];
    const rememberedMappingKey = mappingLookupOrder.find((key) => Boolean(savedMappings[key]));
    const rememberedMappingRaw = rememberedMappingKey ? savedMappings[rememberedMappingKey] : undefined;
    const rememberedMapping = resolveSavedMapping(rememberedMappingRaw, originalHeader);
    const isRememberedMappingValid = rememberedMapping !== null;

    if (isRememberedMappingValid) {
      if (userScope !== 'anonymous' && !savedMappings[headerSignature]) {
        saveMappingForSignature(headerSignature, rememberedMapping);
      }
      const parsedRows = buildImportedRows(
        dataRows,
        rememberedMapping.dateIndex,
        rememberedMapping.merchantIndex,
        rememberedMapping.amountIndex,
        -1,
        -1,
        merchantHistory,
      );
      const validRows = parsedRows.filter((row) => row.title && Number(row.amount) > 0);
      if (validRows.length > 0) {
        const flaggedRows = applyDuplicateFlags(validRows, existingExpenseSignatures);
        setRows(
          seenBefore
            ? flaggedRows.map((row) => ({
                ...row,
                selected: false,
                duplicateType: row.duplicateType === 'none' ? 'existing' : row.duplicateType,
              }))
            : flaggedRows,
        );
        setManualMappingData(null);
        setManualMappingSignatures([]);
        setManualDateIndex('');
        setManualMerchantIndex('');
        setManualAmountIndex('');
        if (userScope !== 'anonymous') {
          saveMappingForSignature(headerSignature, rememberedMapping);
          saveMappingForSignature(fileSignature, rememberedMapping);
        }
        if (!seenBefore) {
          saveFileFingerprint(fingerprintKey);
        }
        setImportInfo(`Parsed ${validRows.length} transaction(s) using remembered column mapping.`);
        return;
      }
    }
    const dateAliases = ['date', 'transactiondate', 'bookingdate', 'datums', 'maksumadate', 'paymentdate'];
    const merchantAliases = [
      'merchant',
      'description',
      'payee',
      'title',
      'recipient',
      'counterparty',
      'sanemejs',
      'nosaukums',
      'details',
    ];
    const amountAliases = ['amount', 'sum', 'value', 'summa', 'apjoms'];
    const debitAliases = ['debit', 'withdrawal', 'outflow', 'expense'];
    const creditAliases = ['credit', 'deposit', 'inflow', 'income'];

    const dateIndex = header.findIndex((cell) => includesAnyAlias(cell, dateAliases));
    const merchantIndex = header.findIndex((cell) => includesAnyAlias(cell, merchantAliases));
    const amountIndex = header.findIndex((cell) => includesAnyAlias(cell, amountAliases));
    const debitIndex = header.findIndex((cell) => includesAnyAlias(cell, debitAliases));
    const creditIndex = header.findIndex((cell) => includesAnyAlias(cell, creditAliases));

    if (dateIndex < 0 || merchantIndex < 0 || (amountIndex < 0 && debitIndex < 0 && creditIndex < 0)) {
      setManualMappingData({
        header: originalHeader,
        dataRows,
      });
      setManualMappingSignatures([headerSignature, fileSignature]);
      const rememberedDateIndex = isRememberedMappingValid ? String(rememberedMapping.dateIndex) : '';
      const rememberedMerchantIndex = isRememberedMappingValid ? String(rememberedMapping.merchantIndex) : '';
      const rememberedAmountIndex = isRememberedMappingValid ? String(rememberedMapping.amountIndex) : '';
      setManualDateIndex(dateIndex >= 0 ? String(dateIndex) : '');
      setManualMerchantIndex(merchantIndex >= 0 ? String(merchantIndex) : '');
      setManualAmountIndex(amountIndex >= 0 ? String(amountIndex) : '');
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
        'Could not auto-detect required columns. Please map Date, Merchant, and Amount manually below.',
      );
      return;
    }

    const parsedRows = buildImportedRows(
      dataRows,
      dateIndex,
      merchantIndex,
      amountIndex,
      debitIndex,
      creditIndex,
      merchantHistory,
    );

    const validRows = parsedRows.filter((row) => row.title && Number(row.amount) > 0);
    if (validRows.length === 0) {
      setImportError('No valid transactions found after parsing.');
      return;
    }
    const flaggedRows = applyDuplicateFlags(validRows, existingExpenseSignatures);
    setRows(
      seenBefore
        ? flaggedRows.map((row) => ({
            ...row,
            selected: false,
            duplicateType: row.duplicateType === 'none' ? 'existing' : row.duplicateType,
          }))
        : flaggedRows,
    );
    setManualMappingData(null);
    setManualMappingSignatures([]);
    setManualDateIndex('');
    setManualMerchantIndex('');
    setManualAmountIndex('');
    const preferredAmountIndex = amountIndex >= 0 ? amountIndex : debitIndex >= 0 ? debitIndex : creditIndex;
    if (dateIndex >= 0 && merchantIndex >= 0 && preferredAmountIndex >= 0) {
      saveMappingForSignature(headerSignature, {
        dateIndex,
        merchantIndex,
        amountIndex: preferredAmountIndex,
        dateHeaderKey: normalizeHeaderKey(originalHeader[dateIndex] ?? ''),
        merchantHeaderKey: normalizeHeaderKey(originalHeader[merchantIndex] ?? ''),
        amountHeaderKey: normalizeHeaderKey(originalHeader[preferredAmountIndex] ?? ''),
      });
      saveMappingForSignature(fileSignature, {
        dateIndex,
        merchantIndex,
        amountIndex: preferredAmountIndex,
        dateHeaderKey: normalizeHeaderKey(originalHeader[dateIndex] ?? ''),
        merchantHeaderKey: normalizeHeaderKey(originalHeader[merchantIndex] ?? ''),
        amountHeaderKey: normalizeHeaderKey(originalHeader[preferredAmountIndex] ?? ''),
      });
    }
    if (!seenBefore) {
      saveFileFingerprint(fingerprintKey);
    }
    setImportInfo(`Parsed ${validRows.length} transaction(s). Review and approve import.`);
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
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

  const onApplyManualMapping = () => {
    if (!manualMappingData) {
      return;
    }
    const dateIndex = Number(manualDateIndex);
    const merchantIndex = Number(manualMerchantIndex);
    const amountIndex = Number(manualAmountIndex);
    if (!Number.isInteger(dateIndex) || !Number.isInteger(merchantIndex) || !Number.isInteger(amountIndex)) {
      setImportError('Select Date, Merchant, and Amount columns to continue.');
      return;
    }
    const parsedRows = buildImportedRows(
      manualMappingData.dataRows,
      dateIndex,
      merchantIndex,
      amountIndex,
      -1,
      -1,
      merchantHistory,
    );
    const validRows = parsedRows.filter((row) => row.title && Number(row.amount) > 0);
    if (validRows.length === 0) {
      setImportError('No valid transactions found with selected mapping.');
      return;
    }
    const flaggedRows = applyDuplicateFlags(validRows, existingExpenseSignatures);
    setRows(
      isExactFileReupload
        ? flaggedRows.map((row) => ({
            ...row,
            selected: false,
            duplicateType: row.duplicateType === 'none' ? 'existing' : row.duplicateType,
          }))
        : flaggedRows,
    );
    setManualMappingData(null);
    setManualMappingSignatures([]);
    setImportError(null);
    setImportBackendDuplicateFailureCount(0);
    if (manualMappingSignatures.length > 0) {
      manualMappingSignatures.forEach((signature) => {
        saveMappingForSignature(signature, {
          dateIndex,
          merchantIndex,
          amountIndex,
          dateHeaderKey: normalizeHeaderKey(manualMappingData.header[dateIndex] ?? ''),
          merchantHeaderKey: normalizeHeaderKey(manualMappingData.header[merchantIndex] ?? ''),
          amountHeaderKey: normalizeHeaderKey(manualMappingData.header[amountIndex] ?? ''),
        });
      });
    } else {
      saveMappingForSignature(`anonymous:manual:${Date.now()}`, {
        dateIndex,
        merchantIndex,
        amountIndex,
        dateHeaderKey: normalizeHeaderKey(manualMappingData.header[dateIndex] ?? ''),
        merchantHeaderKey: normalizeHeaderKey(manualMappingData.header[merchantIndex] ?? ''),
        amountHeaderKey: normalizeHeaderKey(manualMappingData.header[amountIndex] ?? ''),
      });
    }
    if (currentFileFingerprintKey) {
      const fingerprints = loadSavedFileFingerprints();
      if (!fingerprints[currentFileFingerprintKey]) {
        saveFileFingerprint(currentFileFingerprintKey);
      }
    }
    setImportInfo(`Parsed ${validRows.length} transaction(s) using manual column mapping.`);
  };

  const updateRow = (id: string, patch: Partial<ImportedRow>) => {
    setRows((previous) =>
      applyDuplicateFlags(previous.map((row) => {
        if (row.id !== id) {
          return row;
        }
        const next = { ...row, ...patch };
        if (patch.split && patch.split !== 'Shared') {
          next.groupId = '';
          next.expenseGroup = '';
        }
        if (patch.groupId !== undefined && patch.groupId !== row.groupId) {
          next.expenseGroup = '';
        }
        return next;
      }), existingExpenseSignatures),
    );
  };

  const toggleAll = (selected: boolean) => {
    setRows((previous) =>
      previous.map((row) => ({
        ...row,
        selected: !isExactFileReupload && row.duplicateType === 'none' ? selected : false,
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
    if (isExactFileReupload) {
      setImportError('This exact statement file was already uploaded. Remove file and upload a new statement.');
      return;
    }

    for (const row of selectedRows) {
      const parsedAmount = normalizeAmountValue(row.amount);
      if (!row.title.trim() || !row.transactionDate || !row.category || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        setImportError(`Row "${row.title || '(missing merchant)'}" has invalid required fields.`);
        return;
      }
      if (row.duplicateType !== 'none') {
        setImportError(`Row "${row.title}" is marked as duplicate (${row.duplicateType}). Update it before import.`);
        return;
      }
      if (row.split === 'Shared' && (!row.groupId || !row.expenseGroup)) {
        setImportError(`Shared row "${row.title}" requires household and expense group.`);
        return;
      }
    }

    const successfulIds = new Set<string>();
    const failedRows: string[] = [];
    let backendDuplicateFailures = 0;

    for (const row of selectedRows) {
      try {
        await addExpense({
          title: row.title.trim(),
          amount: normalizeAmountValue(row.amount),
          transactionDate: row.transactionDate,
          category: row.category,
          split: row.split,
          groupId: row.split === 'Shared' ? row.groupId : undefined,
          expenseGroup: row.split === 'Shared' ? row.expenseGroup : undefined,
        });
        successfulIds.add(row.id);
      } catch (error) {
        const message = getMutationErrorMessage(error);
        if (isBackendDuplicateExpenseError(message)) {
          backendDuplicateFailures += 1;
        }
        failedRows.push(`${row.title}: ${message}`);
      }
    }

    if (backendDuplicateFailures > 0) {
      setImportBackendDuplicateFailureCount(backendDuplicateFailures);
    }

    setRows((previous) => previous.filter((row) => !successfulIds.has(row.id)));
    if (successfulIds.size > 0 && currentFileFingerprintKey) {
      saveFileFingerprint(currentFileFingerprintKey);
    }
    if (failedRows.length === 0) {
      setImportInfo(`Imported ${successfulIds.size} expense(s) successfully.`);
      return;
    }

    setImportInfo(`Imported ${successfulIds.size} expense(s). ${failedRows.length} failed.`);
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
    setCurrentFileFingerprintKey(null);
    setIsExactFileReupload(false);
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
        });
        if (seenSignatures.has(signature)) {
          return false;
        }
        seenSignatures.add(signature);
        return true;
      }),
    );
  };

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
          <MutedText>Supported now: CSV/TXT with date, merchant/description, amount columns (max 2MB, 1000 rows).</MutedText>
          <Input ref={fileInputRef} type="file" accept=".csv,text/csv,.txt" onChange={onFileChange} />
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
                <Button type="button" onClick={onApplyManualMapping}>
                  Apply mapping
                </Button>
              </Actions>
            </>
          ) : null}
          <ImportSummary>
            <span>Total rows: {rows.length}</span>
            <span>Selected: {rows.filter((row) => row.selected).length}</span>
            <span>High confidence: {rows.filter((row) => row.confidence === 'high').length}</span>
            <span>Duplicates: {duplicateStats.total}</span>
          </ImportSummary>
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
          ) : isExactFileReupload ? (
            <DuplicateNotice $severity="warning">
              <ErrorText>
                This exact statement file was already uploaded before for this user.
              </ErrorText>
              <MutedText>
                Detected {duplicateStats.existing} matching existing row(s) and {duplicateStats.inFile} repeated row(s) within this file.
              </MutedText>
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
                  <Th>Import</Th>
                  <Th>Date</Th>
                  <Th>Merchant</Th>
                  <Th>Amount</Th>
                  <Th>Category</Th>
                  <Th>Split</Th>
                  <Th>Household</Th>
                  <Th>Expense Group</Th>
                  <Th>Confidence</Th>
                  <Th>Duplicate</Th>
                </Tr>
              </Thead>
              <Tbody>
                {rows.map((row) => {
                  const expenseGroupOptions = row.groupId ? expenseGroupByHousehold.get(row.groupId) ?? [] : [];
                  return (
                    <Tr key={row.id}>
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
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.amount}
                          onChange={(event) => updateRow(row.id, { amount: event.target.value })}
                        />
                      </Td>
                      <Td>
                        <InlineInput
                          as="select"
                          value={row.category}
                          onChange={(event) => updateRow(row.id, { category: event.target.value })}
                        >
                          {categoryOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </InlineInput>
                      </Td>
                      <Td>
                        <InlineInput
                          as="select"
                          value={row.split}
                          onChange={(event) => updateRow(row.id, { split: event.target.value as SplitType })}
                        >
                          <option value="Personal">Personal</option>
                          <option value="Shared">Shared</option>
                        </InlineInput>
                      </Td>
                      <Td>
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
                      </Td>
                      <Td>
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
                      </Td>
                      <Td>{row.confidence}</Td>
                      <Td>{row.duplicateType === 'none' ? '-' : row.duplicateType}</Td>
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
