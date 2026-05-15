import {
  IMPORT_COLUMN_MAPPING_STORAGE_KEY,
  IMPORT_CUSTOM_CATEGORIES_STORAGE_KEY,
  IMPORT_MERCHANT_RULES_STORAGE_KEY,
} from './constants';
import type { ImportMerchantRule, SavedColumnMapping } from './types';

export const loadSavedMappings = (): Record<string, SavedColumnMapping> => {
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

export const saveMappingForSignature = (signature: string, mapping: SavedColumnMapping): void => {
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

export const loadCustomImportCategories = (): string[] => {
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

export const loadMerchantRules = (): ImportMerchantRule[] => {
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

export const saveMerchantRules = (rules: ImportMerchantRule[]): void => {
  try {
    localStorage.setItem(IMPORT_MERCHANT_RULES_STORAGE_KEY, JSON.stringify(rules));
  } catch {
    // Keep import flow functional even if storage fails.
  }
};
