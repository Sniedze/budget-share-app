import { useQuery } from '@apollo/client/react';
import { ChangeEvent, DragEvent, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
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
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  GET_EXPENSES,
  getMutationErrorMessage,
  isBackendDuplicateExpenseError,
  isOutgoingExpense,
  useExpenseActions,
  type GetExpensesResponse,
  type SplitType,
} from '../features/expenses';
import { useAuth } from '../features/auth';
import { GET_GROUPS } from '../features/groups';
import { APP_CURRENCY_CODE, normalizeStatementCurrency } from '../format/currency';
import { EXPENSE_TITLE_DESCRIPTION_SEPARATOR } from '../format/expenseTitle';
import type { GroupSummary } from '../features/groups';
import { colors, spacing } from '../styles/tokens';

const MAX_IMPORT_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_IMPORT_ROWS = 1000;
const ALLOWED_FILE_EXTENSIONS = ['.csv', '.txt'];
const ALLOWED_MIME_TYPES = ['text/csv', 'text/plain', 'application/vnd.ms-excel'];
const IMPORT_COLUMN_MAPPING_STORAGE_KEY = 'budgetshare.import.columnMappings.v2';
const IMPORT_CUSTOM_CATEGORIES_STORAGE_KEY = 'budgetshare.import.customCategories.v1';
const IMPORT_MERCHANT_RULES_STORAGE_KEY = 'budgetshare.import.merchantRules.v1';

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

const UploadSectionTitle = styled.h3`
  margin: 0;
  color: ${colors.textPrimary};
  font-size: 30px;
  line-height: 1.1;
`;

const UploadSectionSubtitle = styled.p`
  margin: 4px 0 0;
  color: ${colors.textMuted};
  font-size: 14px;
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

type ImportedRow = {
  id: string;
  selected: boolean;
  transactionDate: string;
  title: string;
  description: string;
  amount: string;
  currency: string;
  /** Outgoing = expense / debit; incoming = credit / deposit (not imported as expenses by default). */
  flow: 'out' | 'in';
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
  currencyIndex?: number;
  descriptionIndex?: number;
  dateHeaderKey?: string;
  merchantHeaderKey?: string;
  amountHeaderKey?: string;
  currencyHeaderKey?: string;
  descriptionHeaderKey?: string;
};

type ImportMerchantRule = {
  id: string;
  flow: 'out' | 'in';
  matchType: 'exact' | 'contains';
  pattern: string;
  category: string;
  split?: SplitType;
  groupId?: string;
  expenseGroup?: string;
  updatedAt: string;
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

/** Split into logical CSV rows; newlines inside double-quoted fields do not end a row. */
const splitCsvRecords = (text: string): string[] => {
  const records: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      const next = text[i + 1];
      current += char;
      if (inQuotes && next === '"') {
        current += next;
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[i + 1] === '\n') {
        i += 1;
      }
      records.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  records.push(current);
  return records;
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

const DATE_COLUMN_ALIASES = [
  'date',
  'transactiondate',
  'bookingdate',
  'datums',
  'maksumadate',
  'paymentdate',
  'dato',
];

const DESCRIPTION_COLUMN_ALIASES = [
  'beskrivelse',
  'description',
  'memo',
  'notat',
  'kommentar',
  'note',
  'meddelelse',
  'details',
];

/** Use saved index when valid; otherwise detect Beskrivelse / description column (excludes merchant column). */
const resolveDescriptionColumnIndex = (
  headerNorm: string[],
  merchantIndex: number,
  savedDescriptionIndex: number | undefined,
): number => {
  const saved =
    savedDescriptionIndex !== undefined &&
    savedDescriptionIndex >= 0 &&
    savedDescriptionIndex < headerNorm.length &&
    savedDescriptionIndex !== merchantIndex
      ? savedDescriptionIndex
      : -1;
  if (saved >= 0) {
    return saved;
  }
  return headerNorm.findIndex(
    (cell, idx) => idx !== merchantIndex && includesAnyAlias(cell, DESCRIPTION_COLUMN_ALIASES),
  );
};

/** Lower rank = preferred when a CSV has several date-like columns (e.g. valør vs bogføring). */
const dateColumnRank = (normalizedHeaderCell: string): number => {
  const h = normalizedHeaderCell;
  if (
    h.includes('bogfr') ||
    h.includes('bogf') ||
    h.includes('bokfr') ||
    h.includes('booked') ||
    h.includes('posting') ||
    h.includes('tilskrev')
  ) {
    return 0;
  }
  if (h.includes('handels') || h.includes('transaktions') || h.includes('transaktion')) {
    return 1;
  }
  if (h.includes('dato') || h.includes('date')) {
    return 2;
  }
  if (h.includes('valr') || h.includes('valor')) {
    return 4;
  }
  return 3;
};

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

const loadCustomImportCategories = (): string[] => {
  try {
    const raw = localStorage.getItem(IMPORT_CUSTOM_CATEGORIES_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  } catch {
    return [];
  }
};

const loadMerchantRules = (): ImportMerchantRule[] => {
  try {
    const raw = localStorage.getItem(IMPORT_MERCHANT_RULES_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is ImportMerchantRule => {
      if (typeof item !== 'object' || item === null) {
        return false;
      }
      const candidate = item as Partial<ImportMerchantRule>;
      return (
        (candidate.flow === 'out' || candidate.flow === 'in') &&
        (candidate.matchType === 'exact' || candidate.matchType === 'contains') &&
        typeof candidate.pattern === 'string' &&
        candidate.pattern.trim().length > 0 &&
        typeof candidate.category === 'string' &&
        candidate.category.trim().length > 0
      );
    });
  } catch {
    return [];
  }
};

const saveMerchantRules = (rules: ImportMerchantRule[]): void => {
  try {
    localStorage.setItem(IMPORT_MERCHANT_RULES_STORAGE_KEY, JSON.stringify(rules));
  } catch {
    // Keep import flow functional even if storage fails.
  }
};

const findMatchingMerchantRule = (
  rules: ImportMerchantRule[],
  merchant: string,
  flow: 'out' | 'in',
): ImportMerchantRule | null => {
  const normalized = merchant.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  for (const rule of rules) {
    if (rule.flow !== flow) {
      continue;
    }
    const pattern = rule.pattern.trim().toLowerCase();
    if (!pattern) {
      continue;
    }
    if (rule.matchType === 'exact' && normalized === pattern) {
      return rule;
    }
    if (rule.matchType === 'contains' && normalized.includes(pattern)) {
      return rule;
    }
  }
  return null;
};

const applyMerchantRuleToRow = (
  row: ImportedRow,
  rule: ImportMerchantRule | null,
): ImportedRow => {
  if (!rule) {
    return row;
  }
  if (row.flow === 'in') {
    return {
      ...row,
      category: rule.category,
      split: 'Personal',
      groupId: '',
      expenseGroup: '',
      confidence: 'high',
    };
  }
  const nextSplit = rule.split ?? row.split;
  return {
    ...row,
    category: rule.category,
    split: nextSplit,
    groupId: nextSplit === 'Shared' ? rule.groupId ?? row.groupId : '',
    expenseGroup: nextSplit === 'Shared' ? rule.expenseGroup ?? row.expenseGroup : '',
    confidence: 'high',
  };
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
  const resolvedCurrencyIndex = findIndexByHeaderKey(mapping.currencyHeaderKey);
  const resolvedDescriptionIndex = findIndexByHeaderKey(mapping.descriptionHeaderKey);

  const dateIndex = resolvedDateIndex >= 0 ? resolvedDateIndex : mapping.dateIndex;
  const merchantIndex = resolvedMerchantIndex >= 0 ? resolvedMerchantIndex : mapping.merchantIndex;
  const amountIndex = resolvedAmountIndex >= 0 ? resolvedAmountIndex : mapping.amountIndex;
  let currencyIndex = -1;
  if (resolvedCurrencyIndex >= 0) {
    currencyIndex = resolvedCurrencyIndex;
  } else if (
    mapping.currencyIndex !== undefined &&
    mapping.currencyIndex >= 0 &&
    mapping.currencyIndex < header.length
  ) {
    currencyIndex = mapping.currencyIndex;
  }
  let descriptionIndex = -1;
  if (resolvedDescriptionIndex >= 0) {
    descriptionIndex = resolvedDescriptionIndex;
  } else if (
    mapping.descriptionIndex !== undefined &&
    mapping.descriptionIndex >= 0 &&
    mapping.descriptionIndex < header.length
  ) {
    descriptionIndex = mapping.descriptionIndex;
  }

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
    currencyIndex,
    descriptionIndex,
  };
};

type SavedMappingPick = {
  mapping: SavedColumnMapping;
  matchedStorageKey: string;
};

const merchantHistoryKey = (merchant: string, flow: 'out' | 'in'): string =>
  `${merchant.trim().toLowerCase()}|${flow}`;

const categoryHistoryKey = (category: string): string => category.trim().toLowerCase();

/**
 * Use a saved mapping only when it truly fits this file:
 * - Keys derived from the full header row (headerSignature / anonymousHeaderSignature) always match.
 * - Filename-only keys apply only if date/merchant/amount header keys match the cells at resolved indices
 *   (avoids reusing another bank’s export that shares the same default filename).
 */
const pickCompatibleSavedMapping = (
  savedMappings: Record<string, SavedColumnMapping>,
  mappingLookupOrder: string[],
  headerSignature: string,
  anonymousHeaderSignature: string,
  originalHeader: string[],
): SavedMappingPick | null => {
  const headerShapeKeys = new Set([headerSignature, anonymousHeaderSignature]);
  for (const key of mappingLookupOrder) {
    const raw = savedMappings[key];
    if (!raw) {
      continue;
    }
    const resolved = resolveSavedMapping(raw, originalHeader);
    if (!resolved) {
      continue;
    }
    if (headerShapeKeys.has(key)) {
      return { mapping: resolved, matchedStorageKey: key };
    }
    const cellKey = (idx: number) => normalizeHeaderKey(originalHeader[idx] ?? '');
    const fileKeyBacked =
      raw.dateHeaderKey &&
      raw.merchantHeaderKey &&
      raw.amountHeaderKey &&
      cellKey(resolved.dateIndex) === raw.dateHeaderKey &&
      cellKey(resolved.merchantIndex) === raw.merchantHeaderKey &&
      cellKey(resolved.amountIndex) === raw.amountHeaderKey;
    if (fileKeyBacked) {
      return { mapping: resolved, matchedStorageKey: key };
    }
  }
  return null;
};

const formatDateYmd = (date: Date): string => {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Normalize odd bank/Excel spacing and dash characters before parsing dates. */
const sanitizeDateInputForParse = (raw: string): string =>
  raw
    .trim()
    .replace(/[\uFEFF\u200E\u200F]/g, '')
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .replace(/[\u2013\u2014]/g, '-');

/** Heuristic content score: which column actually looks like dates in the data rows. */
const scoreDateColumnContent = (dataRows: string[][], colIdx: number): number => {
  if (colIdx < 0 || dataRows.length === 0) {
    return -1000;
  }
  const sample = Math.min(100, dataRows.length);
  let score = 0;
  for (let i = 0; i < sample; i += 1) {
    const raw = sanitizeDateInputForParse(dataRows[i][colIdx] ?? '');
    if (!raw) {
      continue;
    }
    const noSpace = raw.replace(/\s+/g, '');
    // Penalise typical EU bank amounts in the wrong column
    if (/^\d{1,3}(?:\.\d{3})+,\d{2}$/.test(raw) || /^\d+,\d{2}$/.test(noSpace) || /^\d+[.,]\d{2}$/.test(noSpace)) {
      score -= 6;
      continue;
    }
    if (/^\d{4}[-./]\d{1,2}[-./]\d{1,2}(?:[T\s]|$)/.test(raw)) {
      score += 6;
      continue;
    }
    if (/^\d{1,2}\.\d{1,2}\.\d{4}(?:\s|$)/.test(raw) || /^\d{1,2}\/\d{1,2}\/\d{4}(?:\s|$)/.test(raw)) {
      score += 6;
      continue;
    }
    if (/\d{1,2}[./-]\d{1,2}[./-]\d{4}/.test(raw)) {
      score += 3;
      continue;
    }
    if (/^\d{5,6}$/.test(noSpace)) {
      score += 1;
    }
    if (/\d{1,2}[./-]\d{1,2}[./-]\d{2}(?:\D|$)/.test(raw)) {
      score += 1;
    }
  }
  return score;
};

/**
 * Pick the date column using row content, not headers alone. Fixes wrong/stale mappings (e.g. valør
 * vs bogføring, or reference IDs interpreted as Excel serials).
 */
const pickDateColumnFromData = (
  headerNorm: string[],
  dataRows: string[][],
  rememberedDateIndex: number,
): number => {
  const width = headerNorm.length;
  if (width === 0) {
    return -1;
  }
  const fromHeader: number[] = [];
  for (let i = 0; i < width; i += 1) {
    if (includesAnyAlias(headerNorm[i] ?? '', DATE_COLUMN_ALIASES)) {
      fromHeader.push(i);
    }
  }
  const baseIndices = fromHeader.length > 0 ? fromHeader : Array.from({ length: width }, (_, j) => j);
  const indexSet = new Set(baseIndices);
  if (rememberedDateIndex >= 0 && rememberedDateIndex < width) {
    indexSet.add(rememberedDateIndex);
  }
  const indices = Array.from(indexSet);

  let bestIdx = indices[0];
  let bestTotal = -Infinity;
  for (const idx of indices) {
    const s = scoreDateColumnContent(dataRows, idx);
    const tieBreak = (10 - dateColumnRank(headerNorm[idx] ?? '')) * 0.02;
    const total = s + tieBreak;
    if (total > bestTotal) {
      bestTotal = total;
      bestIdx = idx;
    }
  }

  if (rememberedDateIndex < 0 || !indices.includes(rememberedDateIndex)) {
    return bestIdx;
  }
  const remScore = scoreDateColumnContent(dataRows, rememberedDateIndex);
  const bestScore = scoreDateColumnContent(dataRows, bestIdx);
  if (bestScore >= remScore + 3) {
    return bestIdx;
  }
  return rememberedDateIndex;
};

const parseDmyPartsToYmd = (aStr: string, bStr: string, yearStr: string): string => {
  const a = Number.parseInt(aStr, 10);
  const b = Number.parseInt(bStr, 10);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return '';
  }
  let year = Number.parseInt(yearStr, 10);
  if (!Number.isFinite(year)) {
    return '';
  }
  if (yearStr.length === 2) {
    year += year >= 70 ? 1900 : 2000;
  }
  if (year < 1900 || year > 2100) {
    return '';
  }

  let day: number;
  let month: number;
  if (a > 12) {
    day = a;
    month = b;
  } else if (b > 12) {
    month = a;
    day = b;
  } else {
    day = a;
    month = b;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return '';
  }
  const trial = new Date(Date.UTC(year, month - 1, day));
  if (
    trial.getUTCFullYear() !== year ||
    trial.getUTCMonth() !== month - 1 ||
    trial.getUTCDate() !== day
  ) {
    return '';
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const DMY_SEGMENT = '(\\d{1,2})[./-](\\d{1,2})[./-](\\d{2,4})';

/** Split on spaces and semicolons so "26.03.2026;30.03.2026" tries each token as a full date. */
const splitDateishTokens = (s: string): string[] =>
  s
    .split(/[\s;]+/)
    .map((t) => t.replace(/[,;:]+$/g, '').trim())
    .filter(Boolean);

/**
 * Pick one calendar date from a cell: merge token-sized matches and regex scans, prefer any match
 * with a 4-digit year, then the rightmost match (booking date often after valør; avoids returning
 * the first token like `26.03.30` when `30.03.2026` appears later).
 */
const pickBestDmyYmd = (trimmed: string): string => {
  type Cand = { ymd: string; fourDigitYear: boolean; pos: number };
  const cands: Cand[] = [];
  const dmyFull = new RegExp(`^${DMY_SEGMENT}$`);
  let searchFrom = 0;
  for (const token of splitDateishTokens(trimmed)) {
    const m = token.match(dmyFull);
    if (m) {
      const ymd = parseDmyPartsToYmd(m[1], m[2], m[3]);
      if (ymd) {
        const pos = trimmed.indexOf(token, searchFrom);
        const at = pos >= 0 ? pos : searchFrom;
        if (pos >= 0) {
          searchFrom = pos + token.length;
        }
        cands.push({ ymd, fourDigitYear: m[3].length >= 4, pos: at });
      }
    }
  }
  const re = new RegExp(DMY_SEGMENT, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(trimmed)) !== null) {
    const ymd = parseDmyPartsToYmd(match[1], match[2], match[3]);
    if (ymd) {
      cands.push({ ymd, fourDigitYear: match[3].length >= 4, pos: match.index });
    }
  }
  if (cands.length === 0) {
    return '';
  }
  const preferFour = cands.some((c) => c.fourDigitYear);
  const pool = preferFour ? cands.filter((c) => c.fourDigitYear) : cands;
  pool.sort((a, b) => a.pos - b.pos);
  return pool[pool.length - 1].ymd;
};

const normalizeDate = (raw: string): string => {
  const trimmed = sanitizeDateInputForParse(raw);
  if (!trimmed) {
    return '';
  }
  // ISO order year-month-day: hyphens, slashes (e.g. Danish banks 2026/01/30), or dots
  const isoLike = trimmed.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:[T\s]|$)/);
  if (isoLike) {
    const year = Number.parseInt(isoLike[1], 10);
    const month = Number.parseInt(isoLike[2], 10);
    const day = Number.parseInt(isoLike[3], 10);
    const trial = new Date(Date.UTC(year, month - 1, day));
    if (
      trial.getUTCFullYear() === year &&
      trial.getUTCMonth() === month - 1 &&
      trial.getUTCDate() === day
    ) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return '';
  }
  const dateTimeIsoLike = trimmed.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})T/);
  if (dateTimeIsoLike) {
    const year = Number.parseInt(dateTimeIsoLike[1], 10);
    const month = Number.parseInt(dateTimeIsoLike[2], 10);
    const day = Number.parseInt(dateTimeIsoLike[3], 10);
    const trial = new Date(Date.UTC(year, month - 1, day));
    if (
      trial.getUTCFullYear() === year &&
      trial.getUTCMonth() === month - 1 &&
      trial.getUTCDate() === day
    ) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return '';
  }

  const dmyPick = pickBestDmyYmd(trimmed);
  if (dmyPick) {
    return dmyPick;
  }

  // Excel serial only for a whole-cell integer (avoid amounts like 45483,00 or 26.03 parsed wrong)
  const excelCompact = trimmed.replace(/\s+/g, '');
  if (/^\d+$/.test(excelCompact)) {
    const n = Number.parseInt(excelCompact, 10);
    if (n >= 30000 && n <= 120000) {
      const epoch = Date.UTC(1899, 11, 30);
      const d = new Date(epoch + n * 86400000);
      if (!Number.isNaN(d.getTime())) {
        return formatDateYmd(d);
      }
    }
  }

  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) {
    return formatDateYmd(direct);
  }
  return '';
};

const padDataRowsToWidth = (rows: string[][], width: number): string[][] =>
  rows.map((row) => {
    if (row.length >= width) {
      return row;
    }
    return [...row, ...Array(width - row.length).fill('')];
  });

const rowLooksLikeRepeatedHeader = (cells: string[], headerCells: string[]): boolean => {
  if (cells.length < 2 || headerCells.length < 2) {
    return false;
  }
  let matches = 0;
  const max = Math.min(cells.length, headerCells.length, 8);
  for (let i = 0; i < max; i += 1) {
    const c = normalizeHeaderKey(cells[i] ?? '');
    const h = normalizeHeaderKey(headerCells[i] ?? '');
    if (c && h && c === h) {
      matches += 1;
    }
  }
  return matches >= 3 || (matches >= 2 && normalizeHeaderKey(cells[0] ?? '') === normalizeHeaderKey(headerCells[0] ?? ''));
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

/** Parsed numeric amount; negative = outflow in signed-column statements, parentheses = negative. */
const parseSignedAmountFromCell = (raw: string): number => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return 0;
  }
  const negativeByParentheses = /^\(.*\)$/.test(trimmed);
  const cleaned = trimmed
    .replace(/[()]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^\d,.-]/g, '');
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let decimalSeparator = '';
  if (lastComma >= 0 && lastDot >= 0) {
    decimalSeparator = lastComma > lastDot ? ',' : '.';
  } else if (lastComma >= 0) {
    decimalSeparator = ',';
  } else if (lastDot >= 0) {
    decimalSeparator = '.';
  }
  let normalized = cleaned;
  if (decimalSeparator === ',') {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (decimalSeparator === '.') {
    normalized = normalized.replace(/,/g, '');
  } else {
    normalized = normalized.replace(/[,.]/g, '');
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return negativeByParentheses ? -Math.abs(parsed) : parsed;
};

const normalizeAmountValue = (raw: string): number => Math.abs(parseSignedAmountFromCell(raw));

/**
 * When the file has a single amount column (no debit+credit pair), values are often all positive
 * (expense-only export). Then treat every non-zero row as outgoing instead of incoming.
 */
const computeAmountColumnAssumeAllOutgoing = (
  dataRows: string[][],
  amountIndex: number,
  debitIndex: number,
  creditIndex: number,
): boolean => {
  if (amountIndex < 0) {
    return false;
  }
  if (debitIndex >= 0 && creditIndex >= 0) {
    return false;
  }
  let seenNonZero = false;
  let seenNegative = false;
  const sample = Math.min(200, dataRows.length);
  for (let i = 0; i < sample; i += 1) {
    const s = parseSignedAmountFromCell(dataRows[i][amountIndex] ?? '');
    if (s !== 0) {
      seenNonZero = true;
    }
    if (s < 0) {
      seenNegative = true;
    }
  }
  return seenNonZero && !seenNegative;
};

const resolveRowAmountAndFlow = (
  cells: string[],
  amountIndex: number,
  debitIndex: number,
  creditIndex: number,
  amountColumnAssumeAllOutgoing: boolean,
): { magnitude: number; flow: 'in' | 'out' } | null => {
  const debitSigned = debitIndex >= 0 ? parseSignedAmountFromCell(cells[debitIndex] ?? '') : 0;
  const creditSigned = creditIndex >= 0 ? parseSignedAmountFromCell(cells[creditIndex] ?? '') : 0;
  const debitMag = Math.abs(debitSigned);
  const creditMag = Math.abs(creditSigned);

  if (debitIndex >= 0 && creditIndex >= 0) {
    if (debitMag > 0 && creditMag <= 0) {
      return { magnitude: debitMag, flow: 'out' };
    }
    if (creditMag > 0 && debitMag <= 0) {
      return { magnitude: creditMag, flow: 'in' };
    }
    if (debitMag > 0 && creditMag > 0) {
      return { magnitude: debitMag, flow: 'out' };
    }
  } else if (debitIndex >= 0 && debitMag > 0) {
    return { magnitude: debitMag, flow: 'out' };
  } else if (creditIndex >= 0 && creditMag > 0) {
    return { magnitude: creditMag, flow: 'in' };
  }

  if (amountIndex >= 0) {
    const signed = parseSignedAmountFromCell(cells[amountIndex] ?? '');
    if (signed === 0) {
      return null;
    }
    const magnitude = Math.abs(signed);
    if (amountColumnAssumeAllOutgoing) {
      return { magnitude, flow: 'out' };
    }
    const flow = signed < 0 ? 'out' : 'in';
    return { magnitude, flow };
  }

  return null;
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
  flow: 'in' | 'out';
}): string => {
  const merchant = sanitizeCellText(row.title).toLowerCase();
  const date = normalizeDate(row.transactionDate);
  const amount = normalizeAmountValue(row.amount).toFixed(2);
  const base = `${merchant}|${date}|${amount}`;
  return row.flow === 'in' ? `${base}|in` : base;
};

const buildExpenseTitleForImport = (row: ImportedRow): string => {
  const merchant = row.title.trim();
  const desc = row.description.trim();
  if (merchant && desc && desc !== merchant) {
    return `${merchant}${EXPENSE_TITLE_DESCRIPTION_SEPARATOR}${desc}`;
  }
  return merchant || desc;
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
  currencyIndex: number,
  descriptionIndex: number,
  amountColumnAssumeAllOutgoing: boolean,
  merchantRules: ImportMerchantRule[],
  merchantHistory: Map<
    string,
    { category: string; split: SplitType; groupId: string; expenseGroup: string; transactionDate: string }
  >,
): ImportedRow[] =>
  dataRows.flatMap((cells, index) => {
    const transactionDate = normalizeDate(cells[dateIndex] ?? '');
    const title = sanitizeCellText(cells[merchantIndex] ?? '');
    const description =
      descriptionIndex >= 0 ? sanitizeCellText(cells[descriptionIndex] ?? '') : '';
    const resolved = resolveRowAmountAndFlow(
      cells,
      amountIndex,
      debitIndex,
      creditIndex,
      amountColumnAssumeAllOutgoing,
    );
    if (!resolved || resolved.magnitude <= 0) {
      return [];
    }
    const amount = String(resolved.magnitude);
    const flow = resolved.flow;
    const rawCurrencyCell = currencyIndex >= 0 ? cells[currencyIndex] ?? '' : '';
    const currency = normalizeStatementCurrency(rawCurrencyCell);
    const history = merchantHistory.get(merchantHistoryKey(title, flow));
    const isIncoming = flow === 'in';
    const isShared = !isIncoming && history?.split === 'Shared';
    const hasLabel = Boolean(title.trim() || description.trim());
    const baseRow: ImportedRow = {
        id: `${Date.now()}-${index}`,
        selected: true,
        transactionDate,
        title,
        description,
        amount,
        currency,
        flow,
        category: isIncoming ? 'Salary' : history?.category ?? 'General',
        split: isShared ? 'Shared' : 'Personal',
        groupId: isShared ? history?.groupId ?? '' : '',
        expenseGroup: isShared ? history?.expenseGroup ?? '' : '',
        confidence: history ? 'high' : hasLabel ? 'medium' : 'low',
        duplicateType: 'none',
      };
    const rule = findMatchingMerchantRule(merchantRules, title, flow);
    const rowWithRule = applyMerchantRuleToRow(baseRow, rule);
    return [rowWithRule];
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
  const [manualDescriptionIndex, setManualDescriptionIndex] = useState('');
  const [manualCurrencyIndex, setManualCurrencyIndex] = useState('');
  const [customCategories] = useState<string[]>(() => loadCustomImportCategories());
  const [merchantRules, setMerchantRules] = useState<ImportMerchantRule[]>(() => loadMerchantRules());
  const [newRuleMatchType, setNewRuleMatchType] = useState<'exact' | 'contains'>('exact');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
        const pattern = row.title.trim().toLowerCase();
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
    const pattern = row.title.trim().toLowerCase();
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
    setImportInfo(`Saved ${matchType} rule for "${row.title}".`);
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

    const successfulIds = new Set<string>();
    const failedRows: string[] = [];
    let backendDuplicateFailures = 0;

    for (const row of selectedRows) {
      try {
        const isIncoming = row.flow === 'in';
        await addExpense({
          title: buildExpenseTitleForImport(row),
          amount: normalizeAmountValue(row.amount),
          transactionDate: row.transactionDate,
          category: row.category,
          split: isIncoming ? 'Personal' : row.split,
          groupId: isIncoming ? undefined : row.split === 'Shared' ? row.groupId : undefined,
          expenseGroup: isIncoming ? undefined : row.split === 'Shared' ? row.expenseGroup : undefined,
          currency: APP_CURRENCY_CODE,
          flow: isIncoming ? 'Incoming' : 'Outgoing',
        });
        successfulIds.add(row.id);
      } catch (error) {
        const message = getMutationErrorMessage(error);
        if (isBackendDuplicateExpenseError(message)) {
          backendDuplicateFailures += 1;
        }
        failedRows.push(`${buildExpenseTitleForImport(row)}: ${message}`);
      }
    }

    if (backendDuplicateFailures > 0) {
      setImportBackendDuplicateFailureCount(backendDuplicateFailures);
    }

    const successfullyImportedRows = selectedRows.filter((row) => successfulIds.has(row.id));
    learnRulesFromImportedRows(successfullyImportedRows);

    setRows((previous) => previous.filter((row) => !successfulIds.has(row.id)));
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
          <div>
            <UploadSectionTitle>Import Bank Statement</UploadSectionTitle>
            <UploadSectionSubtitle>
              Upload your bank statement and automatically categorize your transactions.
            </UploadSectionSubtitle>
          </div>
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
                        <Button
                          type="button"
                          $variant="secondary"
                          onClick={() => upsertRuleFromRow(row, newRuleMatchType)}
                        >
                          Save rule
                        </Button>
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
