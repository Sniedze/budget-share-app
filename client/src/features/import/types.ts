import type { SplitType } from '../expenses';

export type ImportedRow = {
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

export type ParsedStatementData = {
  header: string[];
  dataRows: string[][];
};

export type SavedColumnMapping = {
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

export type ImportMerchantRule = {
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

export type ImportRuleSaveButtonState = {
  label: string;
  disabled: boolean;
  title: string;
  synced: boolean;
};

export type SavedMappingPick = {
  mapping: SavedColumnMapping;
  matchedStorageKey: string;
};
