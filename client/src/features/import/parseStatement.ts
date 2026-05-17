import { MAX_IMPORT_ROWS } from './constants';
import {
  AMOUNT_COLUMN_ALIASES,
  CREDIT_COLUMN_ALIASES,
  CURRENCY_COLUMN_ALIASES,
  DEBIT_COLUMN_ALIASES,
  DESCRIPTION_COLUMN_ALIASES,
  MERCHANT_COLUMN_ALIASES,
} from './constants';
import {
  detectDelimiter,
  getFallbackHeader,
  includesAnyAlias,
  normalizeHeaderKey,
  padDataRowsToWidth,
  parseDelimitedLine,
  rowLooksLikeRepeatedHeader,
  splitCsvRecords,
} from './csvParse';
import {
  getHeaderSignature,
  pickCompatibleSavedMapping,
  resolveDescriptionColumnIndex,
} from './columnMapping';
import { pickDateColumnFromData } from './dateParse';
import { computeAmountColumnAssumeAllOutgoing } from './amountParse';
import { buildImportedRows } from './buildImportedRows';
import type { MerchantHistoryEntry } from './importRowReview';
import type {
  ImportColumnMappingIndices,
  ImportMerchantRule,
  ImportRemapContext,
  ImportedRow,
  ParsedStatementData,
  SavedColumnMapping,
} from './types';

export type StatementGrid = {
  originalHeader: string[];
  header: string[];
  dataRows: string[][];
  headerSignature: string;
  fileSignature: string;
  anonymousHeaderSignature: string;
  anonymousFileSignature: string;
};

export type ManualMappingInitialIndices = {
  dateIndex: string;
  merchantIndex: string;
  amountIndex: string;
  descriptionIndex: string;
  currencyIndex: string;
};

export type ParseStatementSuccess = {
  kind: 'success';
  rows: ImportedRow[];
  info: string;
  remapContext: ImportRemapContext;
  persistMapping?: {
    signatures: string[];
    mapping: SavedColumnMapping;
  };
};

const mappingToIndices = (mapping: SavedColumnMapping): ImportColumnMappingIndices => ({
  dateIndex: mapping.dateIndex,
  merchantIndex: mapping.merchantIndex,
  amountIndex: mapping.amountIndex,
  currencyIndex: mapping.currencyIndex ?? -1,
  descriptionIndex: mapping.descriptionIndex ?? -1,
});

const buildRemapContext = (grid: StatementGrid, mapping: SavedColumnMapping): ImportRemapContext => ({
  statementData: { header: grid.originalHeader, dataRows: grid.dataRows },
  signatures: [grid.headerSignature, grid.fileSignature],
  appliedMapping: mappingToIndices(mapping),
});

export const buildRemapContextFromManual = (
  manualData: ParsedStatementData,
  signatures: string[],
  indices: ImportColumnMappingIndices,
): ImportRemapContext => ({
  statementData: manualData,
  signatures,
  appliedMapping: indices,
});

export type ParseStatementManualMapping = {
  kind: 'manual';
  manualData: ParsedStatementData;
  signatures: string[];
  error: string;
  initialIndices: ManualMappingInitialIndices;
};

export type ParseStatementError = {
  kind: 'error';
  message: string;
};

export type ParseStatementResult =
  | ParseStatementSuccess
  | ParseStatementManualMapping
  | ParseStatementError;

export type ParseStatementContext = {
  userScope: string;
  fileName: string;
  merchantRules: ImportMerchantRule[];
  merchantHistory: Map<string, MerchantHistoryEntry>;
  existingExpenseSignatures: Set<string>;
  finalizeRows: (rows: ImportedRow[]) => ImportedRow[];
  savedColumnMappings: Record<string, SavedColumnMapping>;
  saveColumnMapping: (signature: string, mapping: SavedColumnMapping) => void;
};

export type BuildStatementGridResult = StatementGrid | ParseStatementError;

export const isStatementGrid = (value: BuildStatementGridResult): value is StatementGrid =>
  !('kind' in value);

export const buildStatementGrid = (text: string, userScope: string, fileName: string): BuildStatementGridResult => {
  const rawLines = splitCsvRecords(text.replace(/^\uFEFF/, ''))
    .map((line) => line.trim())
    .filter(Boolean);
  if (rawLines.length < 2) {
    return { kind: 'error', message: 'The file is empty or missing data rows.' };
  }
  if (rawLines.length - 1 > MAX_IMPORT_ROWS) {
    return {
      kind: 'error',
      message: `File has too many rows (${rawLines.length - 1}). Maximum allowed is ${MAX_IMPORT_ROWS}.`,
    };
  }

  const delimiter = detectDelimiter(rawLines.slice(0, 6));
  const parsedHeader = parseDelimitedLine(rawLines[0], delimiter);
  let dataRows = rawLines.slice(1).map((line) => parseDelimitedLine(line, delimiter));
  const originalHeader = getFallbackHeader(parsedHeader, dataRows);
  dataRows = padDataRowsToWidth(
    dataRows.filter((row) => !rowLooksLikeRepeatedHeader(row, originalHeader)),
    originalHeader.length,
  );

  const normalizedFileName = fileName.trim().toLowerCase();
  const baseHeaderSignature = getHeaderSignature(originalHeader);
  const headerSignature = `${userScope}:${baseHeaderSignature}`;
  const anonymousHeaderSignature = `anonymous:${baseHeaderSignature}`;
  const fileSignature = `${userScope}:file:${normalizedFileName}`;
  const anonymousFileSignature = `anonymous:file:${normalizedFileName}`;
  const header = originalHeader.map((cell) => normalizeHeaderKey(cell));

  return {
    originalHeader,
    header,
    dataRows,
    headerSignature,
    fileSignature,
    anonymousHeaderSignature,
    anonymousFileSignature,
  };
};

const findColumnIndexes = (header: string[], dataRows: string[][]) => {
  const fallbackDebitIndex = header.findIndex((cell) => includesAnyAlias(cell, DEBIT_COLUMN_ALIASES));
  const fallbackCreditIndex = header.findIndex((cell) => includesAnyAlias(cell, CREDIT_COLUMN_ALIASES));
  const fallbackCurrencyIndex = header.findIndex((cell) => includesAnyAlias(cell, CURRENCY_COLUMN_ALIASES));
  const dateIndex = pickDateColumnFromData(header, dataRows, -1);
  const descriptionCandidate = header.findIndex((cell) => includesAnyAlias(cell, DESCRIPTION_COLUMN_ALIASES));
  const merchantIndex = header.findIndex(
    (cell, idx) =>
      (descriptionCandidate < 0 || idx !== descriptionCandidate) &&
      includesAnyAlias(cell, MERCHANT_COLUMN_ALIASES),
  );
  const descriptionIndex = resolveDescriptionColumnIndex(
    header,
    merchantIndex,
    descriptionCandidate >= 0 ? descriptionCandidate : undefined,
  );
  const amountIndex = header.findIndex((cell) => includesAnyAlias(cell, AMOUNT_COLUMN_ALIASES));
  return {
    fallbackDebitIndex,
    fallbackCreditIndex,
    fallbackCurrencyIndex,
    dateIndex,
    merchantIndex,
    descriptionIndex,
    amountIndex,
  };
};

const rowsFromMapping = (
  grid: StatementGrid,
  mapping: SavedColumnMapping,
  ctx: ParseStatementContext,
): ImportedRow[] => {
  const resolvedDateIndex = pickDateColumnFromData(grid.header, grid.dataRows, mapping.dateIndex);
  const resolvedDescriptionIdx = resolveDescriptionColumnIndex(
    grid.header,
    mapping.merchantIndex,
    mapping.descriptionIndex,
  );
  const fallbackDebitIndex = grid.header.findIndex((cell) => includesAnyAlias(cell, DEBIT_COLUMN_ALIASES));
  const fallbackCreditIndex = grid.header.findIndex((cell) => includesAnyAlias(cell, CREDIT_COLUMN_ALIASES));
  const fallbackCurrencyIndex = grid.header.findIndex((cell) => includesAnyAlias(cell, CURRENCY_COLUMN_ALIASES));
  const rememberedCurrencyIdx = mapping.currencyIndex ?? -1;
  const rememberedAssumeOutgoing = computeAmountColumnAssumeAllOutgoing(
    grid.dataRows,
    mapping.amountIndex,
    fallbackDebitIndex,
    fallbackCreditIndex,
  );
  return buildImportedRows(
    grid.dataRows,
    resolvedDateIndex,
    mapping.merchantIndex,
    mapping.amountIndex,
    fallbackDebitIndex,
    fallbackCreditIndex,
    rememberedCurrencyIdx >= 0 ? rememberedCurrencyIdx : fallbackCurrencyIndex,
    resolvedDescriptionIdx,
    rememberedAssumeOutgoing,
    ctx.merchantRules,
    ctx.merchantHistory,
  );
};

const filterValidRows = (rows: ImportedRow[]): ImportedRow[] =>
  rows.filter((row) => (row.title.trim() || row.description.trim()) && Number(row.amount) > 0);

const persistMappingIfNeeded = (
  ctx: ParseStatementContext,
  userScope: string,
  grid: StatementGrid,
  mapping: SavedColumnMapping,
  resolvedDateIndex: number,
  resolvedDescriptionIdx: number,
): SavedColumnMapping => {
  if (userScope === 'anonymous') {
    return mapping;
  }
  let mappingToPersist = mapping;
  if (resolvedDateIndex !== mapping.dateIndex) {
    mappingToPersist = {
      ...mappingToPersist,
      dateIndex: resolvedDateIndex,
      dateHeaderKey: normalizeHeaderKey(grid.originalHeader[resolvedDateIndex] ?? ''),
    };
  }
  if (resolvedDescriptionIdx >= 0) {
    mappingToPersist = {
      ...mappingToPersist,
      descriptionIndex: resolvedDescriptionIdx,
      descriptionHeaderKey: normalizeHeaderKey(grid.originalHeader[resolvedDescriptionIdx] ?? ''),
    };
  }
  ctx.saveColumnMapping(grid.headerSignature, mappingToPersist);
  ctx.saveColumnMapping(grid.fileSignature, mappingToPersist);
  return mappingToPersist;
};

export const parseStatementFromGrid = (
  grid: StatementGrid,
  ctx: ParseStatementContext,
): ParseStatementResult => {
  const savedMappings = ctx.savedColumnMappings;
  const mappingLookupOrder = [
    grid.headerSignature,
    grid.fileSignature,
    grid.anonymousHeaderSignature,
    grid.anonymousFileSignature,
  ];
  const rememberedPick = pickCompatibleSavedMapping(
    savedMappings,
    mappingLookupOrder,
    grid.headerSignature,
    grid.anonymousHeaderSignature,
    grid.originalHeader,
  );
  const rememberedMapping = rememberedPick?.mapping ?? null;
  const isRememberedMappingValid = rememberedMapping !== null;
  const hasSavedLayoutsButNoneMatch = Object.keys(savedMappings).length > 0 && rememberedPick === null;

  if (isRememberedMappingValid && rememberedMapping) {
    if (ctx.userScope !== 'anonymous' && !savedMappings[grid.headerSignature]) {
      ctx.saveColumnMapping(grid.headerSignature, rememberedMapping);
    }
    const parsedRows = rowsFromMapping(grid, rememberedMapping, ctx);
    const validRows = filterValidRows(parsedRows);
    if (validRows.length > 0) {
      const resolvedDateIndex = pickDateColumnFromData(
        grid.header,
        grid.dataRows,
        rememberedMapping.dateIndex,
      );
      const resolvedDescriptionIdx = resolveDescriptionColumnIndex(
        grid.header,
        rememberedMapping.merchantIndex,
        rememberedMapping.descriptionIndex,
      );
      const mappingForRemap = persistMappingIfNeeded(
        ctx,
        ctx.userScope,
        grid,
        rememberedMapping,
        resolvedDateIndex,
        resolvedDescriptionIdx,
      );
      return {
        kind: 'success',
        rows: ctx.finalizeRows(validRows),
        info: `Parsed ${validRows.length} transaction(s) using remembered column mapping.`,
        remapContext: buildRemapContext(grid, mappingForRemap),
      };
    }
  }

  const {
    fallbackDebitIndex,
    fallbackCreditIndex,
    fallbackCurrencyIndex,
    dateIndex,
    merchantIndex,
    descriptionIndex,
    amountIndex,
  } = findColumnIndexes(grid.header, grid.dataRows);

  if (dateIndex < 0 || merchantIndex < 0 || (amountIndex < 0 && fallbackDebitIndex < 0 && fallbackCreditIndex < 0)) {
    const rememberedDateIndex = isRememberedMappingValid ? String(rememberedMapping!.dateIndex) : '';
    const rememberedMerchantIndex = isRememberedMappingValid ? String(rememberedMapping!.merchantIndex) : '';
    const rememberedAmountIndex = isRememberedMappingValid ? String(rememberedMapping!.amountIndex) : '';
    const rememberedCurrencyIndex =
      isRememberedMappingValid &&
      rememberedMapping!.currencyIndex !== undefined &&
      rememberedMapping!.currencyIndex >= 0
        ? String(rememberedMapping!.currencyIndex)
        : '';
    const rememberedDescriptionIndexStr =
      isRememberedMappingValid &&
      rememberedMapping!.descriptionIndex !== undefined &&
      rememberedMapping!.descriptionIndex >= 0
        ? String(rememberedMapping!.descriptionIndex)
        : '';

    return {
      kind: 'manual',
      manualData: { header: grid.originalHeader, dataRows: grid.dataRows },
      signatures: [grid.headerSignature, grid.fileSignature],
      error: `${hasSavedLayoutsButNoneMatch ? 'This file’s column headers don’t match any saved import layout. Map columns below; the new layout will be saved without removing your others.\n\n' : ''}Could not auto-detect required columns. Please map Date, Merchant, Amount, and optionally Description and Currency below.`,
      initialIndices: {
        dateIndex: dateIndex >= 0 ? String(dateIndex) : rememberedDateIndex,
        merchantIndex: merchantIndex >= 0 ? String(merchantIndex) : rememberedMerchantIndex,
        amountIndex: amountIndex >= 0 ? String(amountIndex) : rememberedAmountIndex,
        descriptionIndex:
          descriptionIndex >= 0 ? String(descriptionIndex) : rememberedDescriptionIndexStr,
        currencyIndex:
          fallbackCurrencyIndex >= 0 ? String(fallbackCurrencyIndex) : rememberedCurrencyIndex,
      },
    };
  }

  const amountColumnAssumeAllOutgoing = computeAmountColumnAssumeAllOutgoing(
    grid.dataRows,
    amountIndex,
    fallbackDebitIndex,
    fallbackCreditIndex,
  );
  const parsedRows = buildImportedRows(
    grid.dataRows,
    dateIndex,
    merchantIndex,
    amountIndex,
    fallbackDebitIndex,
    fallbackCreditIndex,
    fallbackCurrencyIndex,
    descriptionIndex,
    amountColumnAssumeAllOutgoing,
    ctx.merchantRules,
    ctx.merchantHistory,
  );
  const validRows = filterValidRows(parsedRows);
  if (validRows.length === 0) {
    return { kind: 'error', message: 'No valid transactions found after parsing.' };
  }

  const preferredAmountIndex = amountIndex >= 0 ? amountIndex : fallbackDebitIndex >= 0 ? fallbackDebitIndex : fallbackCreditIndex;
  let persistMapping: ParseStatementSuccess['persistMapping'];
  if (dateIndex >= 0 && merchantIndex >= 0 && preferredAmountIndex >= 0) {
    const baseMapping: SavedColumnMapping = {
      dateIndex,
      merchantIndex,
      amountIndex: preferredAmountIndex,
      dateHeaderKey: normalizeHeaderKey(grid.originalHeader[dateIndex] ?? ''),
      merchantHeaderKey: normalizeHeaderKey(grid.originalHeader[merchantIndex] ?? ''),
      amountHeaderKey: normalizeHeaderKey(grid.originalHeader[preferredAmountIndex] ?? ''),
      ...(descriptionIndex >= 0
        ? {
            descriptionIndex,
            descriptionHeaderKey: normalizeHeaderKey(grid.originalHeader[descriptionIndex] ?? ''),
          }
        : {}),
    };
    const mappingToSave: SavedColumnMapping =
      fallbackCurrencyIndex >= 0
        ? {
            ...baseMapping,
            currencyIndex: fallbackCurrencyIndex,
            currencyHeaderKey: normalizeHeaderKey(grid.originalHeader[fallbackCurrencyIndex] ?? ''),
          }
        : baseMapping;
    if (ctx.userScope !== 'anonymous') {
      ctx.saveColumnMapping(grid.headerSignature, mappingToSave);
      ctx.saveColumnMapping(grid.fileSignature, mappingToSave);
    }
    persistMapping = {
      signatures: [grid.headerSignature, grid.fileSignature],
      mapping: mappingToSave,
    };
  }

  const mappingForRemap: SavedColumnMapping = persistMapping?.mapping ?? {
    dateIndex,
    merchantIndex,
    amountIndex: preferredAmountIndex,
    ...(descriptionIndex >= 0 ? { descriptionIndex } : {}),
    ...(fallbackCurrencyIndex >= 0 ? { currencyIndex: fallbackCurrencyIndex } : {}),
  };

  return {
    kind: 'success',
    rows: ctx.finalizeRows(validRows),
    info: `${hasSavedLayoutsButNoneMatch ? 'Headers didn’t match a saved layout; this one was mapped from scratch and saved alongside your others.\n\n' : ''}Parsed ${validRows.length} transaction(s). Review and approve import.`,
    remapContext: buildRemapContext(grid, mappingForRemap),
    persistMapping,
  };
};

export const parseManualMapping = (
  manualData: ParsedStatementData,
  indices: {
    dateIndex: number;
    merchantIndex: number;
    amountIndex: number;
    currencyIndex: number;
    descriptionIndex: number;
  },
  signatures: string[],
  ctx: ParseStatementContext,
): ParseStatementResult => {
  const manualAssumeOutgoing = computeAmountColumnAssumeAllOutgoing(
    manualData.dataRows,
    indices.amountIndex,
    -1,
    -1,
  );
  const parsedRows = buildImportedRows(
    manualData.dataRows,
    indices.dateIndex,
    indices.merchantIndex,
    indices.amountIndex,
    -1,
    -1,
    indices.currencyIndex,
    indices.descriptionIndex,
    manualAssumeOutgoing,
    ctx.merchantRules,
    ctx.merchantHistory,
  );
  const validRows = filterValidRows(parsedRows);
  if (validRows.length === 0) {
    return { kind: 'error', message: 'No valid transactions found with selected mapping.' };
  }

  const manualBaseMapping: SavedColumnMapping = {
    dateIndex: indices.dateIndex,
    merchantIndex: indices.merchantIndex,
    amountIndex: indices.amountIndex,
    dateHeaderKey: normalizeHeaderKey(manualData.header[indices.dateIndex] ?? ''),
    merchantHeaderKey: normalizeHeaderKey(manualData.header[indices.merchantIndex] ?? ''),
    amountHeaderKey: normalizeHeaderKey(manualData.header[indices.amountIndex] ?? ''),
  };
  let manualMappingPayload: SavedColumnMapping =
    indices.currencyIndex >= 0
      ? {
          ...manualBaseMapping,
          currencyIndex: indices.currencyIndex,
          currencyHeaderKey: normalizeHeaderKey(manualData.header[indices.currencyIndex] ?? ''),
        }
      : manualBaseMapping;
  if (indices.descriptionIndex >= 0) {
    manualMappingPayload = {
      ...manualMappingPayload,
      descriptionIndex: indices.descriptionIndex,
      descriptionHeaderKey: normalizeHeaderKey(manualData.header[indices.descriptionIndex] ?? ''),
    };
  }
  if (signatures.length > 0) {
    signatures.forEach((signature) => {
      ctx.saveColumnMapping(signature, manualMappingPayload);
    });
  } else {
    ctx.saveColumnMapping(`anonymous:manual:${Date.now()}`, manualMappingPayload);
  }

  const appliedIndices: ImportColumnMappingIndices = {
    dateIndex: indices.dateIndex,
    merchantIndex: indices.merchantIndex,
    amountIndex: indices.amountIndex,
    currencyIndex: indices.currencyIndex,
    descriptionIndex: indices.descriptionIndex,
  };

  return {
    kind: 'success',
    rows: ctx.finalizeRows(validRows),
    info: `Parsed ${validRows.length} transaction(s) using manual column mapping.`,
    remapContext: buildRemapContextFromManual(manualData, signatures, appliedIndices),
  };
};
