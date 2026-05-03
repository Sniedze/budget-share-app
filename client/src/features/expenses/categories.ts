export const DEFAULT_EXPENSE_CATEGORIES = [
  'Housing',
  'Utilities',
  'Groceries',
  'Dining Out',
  'Transportation',
  'Family & Childcare',
  'Pet Care',
  'Personal Care',
  'Healthcare',
  'Technology',
  'Debt Payments',
  'Savings & Investments',
  'Entertainment',
  'Hobbies',
  'Travel',
  'Education',
  'Insurance',
  'Gifts & Donations',
  'Shopping',
  'Miscellaneous',
  'Other',
] as const;

export const DEFAULT_INCOME_CATEGORIES = [
  'Salary',
  'Pension',
  'Bonus',
  'Freelance',
  'Interest',
  'Dividends',
  'Tax Refund',
  'Refund',
  'Gift',
  'Debt Settlement',
  'Transfer In',
  'Rental Income',
  'Other Income',
] as const;

export const BUDGET_TOP_LEVEL_CATEGORIES = [
  'Living',
  'Transportation',
  'Family Care',
  'Personal Care',
  'Healthcare',
  'Technology',
  'Debt Payments',
  'Savings & Investments',
  'Entertainment',
  'Miscellaneous',
] as const;

const DETAILED_TO_BUDGET_CATEGORY: Record<string, string> = {
  housing: 'Living',
  utilities: 'Living',
  groceries: 'Living',
  diningout: 'Living',
  insurance: 'Living',
  transportation: 'Transportation',
  familychildcare: 'Family Care',
  petcare: 'Family Care',
  personalcare: 'Personal Care',
  healthcare: 'Healthcare',
  technology: 'Technology',
  debtpayments: 'Debt Payments',
  savingsinvestments: 'Savings & Investments',
  entertainment: 'Entertainment',
  hobbies: 'Entertainment',
  travel: 'Entertainment',
  education: 'Miscellaneous',
  giftsdonations: 'Miscellaneous',
  shopping: 'Miscellaneous',
  miscellaneous: 'Miscellaneous',
  other: 'Miscellaneous',
};

const normalizeCategoryKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export const toBudgetTopLevelCategory = (value: string): string =>
  DETAILED_TO_BUDGET_CATEGORY[normalizeCategoryKey(value)] ?? 'Miscellaneous';
