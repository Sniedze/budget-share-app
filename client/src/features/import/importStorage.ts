import { readJsonFromStorage, writeJsonToStorage } from '../../lib/localStorageJson';
import {
  IMPORT_COLUMN_MAPPING_STORAGE_KEY,
  IMPORT_CUSTOM_CATEGORIES_STORAGE_KEY,
  IMPORT_MERCHANT_RULES_STORAGE_KEY,
} from './constants';
import type { ImportMerchantRule, SavedColumnMapping } from './types';

const isImportMerchantRule = (item: unknown): item is ImportMerchantRule => {
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
};

export const loadSavedMappings = (): Record<string, SavedColumnMapping> =>
  readJsonFromStorage<Record<string, SavedColumnMapping>>(IMPORT_COLUMN_MAPPING_STORAGE_KEY, {});

export const saveMappingForSignature = (signature: string, mapping: SavedColumnMapping): void => {
  const previous = loadSavedMappings();
  writeJsonToStorage(IMPORT_COLUMN_MAPPING_STORAGE_KEY, {
    ...previous,
    [signature]: mapping,
  });
};

export const loadCustomImportCategories = (): string[] => {
  const parsed = readJsonFromStorage<unknown>(IMPORT_CUSTOM_CATEGORIES_STORAGE_KEY, []);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
};

export const saveCustomImportCategories = (categories: string[]): void => {
  writeJsonToStorage(IMPORT_CUSTOM_CATEGORIES_STORAGE_KEY, categories);
};

export const loadMerchantRules = (): ImportMerchantRule[] => {
  const parsed = readJsonFromStorage<unknown>(IMPORT_MERCHANT_RULES_STORAGE_KEY, []);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter(isImportMerchantRule);
};

export const saveMerchantRules = (rules: ImportMerchantRule[]): void => {
  writeJsonToStorage(IMPORT_MERCHANT_RULES_STORAGE_KEY, rules);
};
