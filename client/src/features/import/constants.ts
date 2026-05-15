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
