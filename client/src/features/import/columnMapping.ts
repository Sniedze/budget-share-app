import { DESCRIPTION_COLUMN_ALIASES } from './constants';
import { includesAnyAlias, normalizeHeaderKey } from './csvParse';
import type { SavedColumnMapping, SavedMappingPick } from './types';

/** Use saved index when valid; otherwise detect Beskrivelse / description column (excludes merchant column). */
export const resolveDescriptionColumnIndex = (
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

export const getHeaderSignature = (header: string[]): string =>
  header.map((cell) => normalizeHeaderKey(cell)).join('|');

export const resolveSavedMapping = (
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

export const merchantHistoryKey = (merchant: string, flow: 'out' | 'in'): string =>
  `${merchant.trim().toLowerCase()}|${flow}`;

export const categoryHistoryKey = (category: string): string => category.trim().toLowerCase();

/**
 * Use a saved mapping only when it truly fits this file:
 * - Keys derived from the full header row (headerSignature / anonymousHeaderSignature) always match.
 * - Filename-only keys apply only if date/merchant/amount header keys match the cells at resolved indices
 *   (avoids reusing another bank’s export that shares the same default filename).
 */
export const pickCompatibleSavedMapping = (
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
