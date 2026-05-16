export const MAX_IMPORT_FILE_SIZE_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 1000;
export const ALLOWED_FILE_EXTENSIONS = ['.csv', '.txt'];
export const ALLOWED_MIME_TYPES = ['text/csv', 'text/plain', 'application/vnd.ms-excel'];
export const IMPORT_COLUMN_MAPPING_STORAGE_KEY = 'budgetshare.import.columnMappings.v2';
export const IMPORT_CUSTOM_CATEGORIES_STORAGE_KEY = 'budgetshare.import.customCategories.v1';
export const IMPORT_MERCHANT_RULES_STORAGE_KEY = 'budgetshare.import.merchantRules.v1';

export const DATE_COLUMN_ALIASES = [
  'date',
  'transactiondate',
  'bookingdate',
  'datums',
  'maksumadate',
  'paymentdate',
  'dato',
];

export const DESCRIPTION_COLUMN_ALIASES = [
  'beskrivelse',
  'description',
  'memo',
  'notat',
  'kommentar',
  'note',
  'meddelelse',
  'details',
];

export const MERCHANT_COLUMN_ALIASES = [
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

export const AMOUNT_COLUMN_ALIASES = ['amount', 'sum', 'value', 'summa', 'apjoms', 'belob', 'belb'];

export const DEBIT_COLUMN_ALIASES = [
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

export const CREDIT_COLUMN_ALIASES = [
  'credit',
  'deposit',
  'inflow',
  'income',
  'indbetaling',
  'tilgang',
  'kreditering',
  'belobind',
];

export const CURRENCY_COLUMN_ALIASES = ['currency', 'valuta', 'coin', 'ccy', 'curr', 'iso4217'];
