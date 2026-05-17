import type { SplitType } from '../expenses';

/** Client-only shapes for bank import parsing and review (not GraphQL types). */

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

/** Column indices used when parsing a statement (for remap UI). */
export type ImportColumnMappingIndices = {
  dateIndex: number;
  merchantIndex: number;
  amountIndex: number;
  currencyIndex: number;
  descriptionIndex: number;
};

/** Raw file grid + mapping so the user can reopen column mapping after parse. */
export type ImportRemapContext = {
  statementData: ParsedStatementData;
  signatures: string[];
  appliedMapping: ImportColumnMappingIndices;
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
