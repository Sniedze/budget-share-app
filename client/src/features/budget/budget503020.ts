import { toBudgetTopLevelCategory } from '../expenses/categories';

export type Budget503020Bucket = 'needs' | 'wants' | 'savings';

const BUCKET_INCOME_SHARE: Record<Budget503020Bucket, number> = {
  needs: 0.5,
  wants: 0.3,
  savings: 0.2,
};

export const BUCKET_LABELS: Record<Budget503020Bucket, string> = {
  needs: 'Needs',
  wants: 'Wants',
  savings: 'Savings',
};

/** Table section order: needs and savings first, then wants. */
export const BUCKET_DISPLAY_ORDER: readonly Budget503020Bucket[] = ['needs', 'savings', 'wants'];

const BUCKET_ORDER_INDEX: Record<Budget503020Bucket, number> = {
  needs: 0,
  savings: 1,
  wants: 2,
};

/** Shared bullet color for every category row in the same 50/30/20 group. */
export const BUCKET_DOT_COLOR: Record<Budget503020Bucket, string> = {
  needs: '#16a34a',
  savings: '#0891b2',
  wants: '#f97316',
};

export const BUCKET_INCOME_SHARE_LABEL: Record<Budget503020Bucket, string> = {
  needs: '50%',
  wants: '30%',
  savings: '20%',
};

const normalizeKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** Relative weight inside a 50/30/20 bucket (higher = larger share of that pool). */
const CATEGORY_PROFILE: Record<string, { bucket: Budget503020Bucket; weight: number }> = {
  // Needs — essentials (~50% of income total)
  living: { bucket: 'needs', weight: 0.38 },
  housing: { bucket: 'needs', weight: 0.22 },
  utilities: { bucket: 'needs', weight: 0.08 },
  groceries: { bucket: 'needs', weight: 0.1 },
  insurance: { bucket: 'needs', weight: 0.06 },
  transportation: { bucket: 'needs', weight: 0.14 },
  familycare: { bucket: 'needs', weight: 0.1 },
  familychildcare: { bucket: 'needs', weight: 0.1 },
  petcare: { bucket: 'needs', weight: 0.04 },
  healthcare: { bucket: 'needs', weight: 0.1 },
  personalcare: { bucket: 'needs', weight: 0.05 },
  debtpayments: { bucket: 'needs', weight: 0.08 },
  education: { bucket: 'needs', weight: 0.06 },

  // Wants — lifestyle (~30% of income)
  entertainment: { bucket: 'wants', weight: 0.28 },
  hobbies: { bucket: 'wants', weight: 0.12 },
  travel: { bucket: 'wants', weight: 0.14 },
  diningout: { bucket: 'wants', weight: 0.18 },
  technology: { bucket: 'wants', weight: 0.14 },
  shopping: { bucket: 'wants', weight: 0.14 },
  giftsdonations: { bucket: 'wants', weight: 0.08 },
  miscellaneous: { bucket: 'wants', weight: 0.12 },
  other: { bucket: 'wants', weight: 0.08 },

  // Savings (~20% of income)
  savingsinvestments: { bucket: 'savings', weight: 1 },
};

const profileForKey = (key: string): { bucket: Budget503020Bucket; weight: number } | null =>
  CATEGORY_PROFILE[key] ?? null;

const inferBucketFromLabel = (label: string): Budget503020Bucket => {
  const lower = label.toLowerCase();
  if (/(save|saving|invest|retire|pension|emergency|broker)/i.test(lower)) {
    return 'savings';
  }
  if (
    /(rent|mortgage|housing|utility|utilities|grocer|insur|health|medical|child|daycare|debt|loan|transport|commute|fuel|gas\b|bill\b|essential)/i.test(
      lower,
    )
  ) {
    return 'needs';
  }
  return 'wants';
};

/** Classify a budget line for the 50/30/20 rule. */
export const classifyBudget503020Bucket = (categoryName: string): Budget503020Bucket => {
  const key = normalizeKey(categoryName);
  const direct = profileForKey(key);
  if (direct) {
    return direct.bucket;
  }

  const rollupKey = normalizeKey(toBudgetTopLevelCategory(categoryName));
  const rollup = profileForKey(rollupKey);
  if (rollup) {
    return rollup.bucket;
  }

  return inferBucketFromLabel(categoryName);
};

export const compareBy503020Bucket = (a: string, b: string): number => {
  const diff =
    BUCKET_ORDER_INDEX[classifyBudget503020Bucket(a)] - BUCKET_ORDER_INDEX[classifyBudget503020Bucket(b)];
  return diff !== 0 ? diff : a.localeCompare(b);
};

export type BudgetCategoryGroupRow =
  | { kind: 'header'; bucket: Budget503020Bucket }
  | { kind: 'category'; name: string; bucket: Budget503020Bucket };

export const buildBudgetCategoryGroupRows = (
  categoryNames: readonly string[],
): BudgetCategoryGroupRow[] => {
  const rows: BudgetCategoryGroupRow[] = [];
  for (const bucket of BUCKET_DISPLAY_ORDER) {
    const names = categoryNames
      .filter((name) => classifyBudget503020Bucket(name) === bucket)
      .sort((a, b) => a.localeCompare(b));
    if (names.length === 0) {
      continue;
    }
    rows.push({ kind: 'header', bucket });
    for (const name of names) {
      rows.push({ kind: 'category', name, bucket });
    }
  }
  return rows;
};

export type SavedBudgetGroupRow =
  | { kind: 'header'; bucket: Budget503020Bucket }
  | {
      kind: 'category';
      name: string;
      bucket: Budget503020Bucket;
      bucketLabel: string;
      limit: number;
    };

export const buildSavedBudgetGroupRows = (
  rows: ReadonlyArray<{
    name: string;
    limit: number;
    bucket: Budget503020Bucket;
    bucketLabel: string;
  }>,
): SavedBudgetGroupRow[] => {
  const grouped: SavedBudgetGroupRow[] = [];
  for (const bucket of BUCKET_DISPLAY_ORDER) {
    const inBucket = rows
      .filter((row) => row.bucket === bucket)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (inBucket.length === 0) {
      continue;
    }
    grouped.push({ kind: 'header', bucket });
    for (const row of inBucket) {
      grouped.push({ kind: 'category', ...row });
    }
  }
  return grouped;
};

const weightForCategory = (categoryName: string, bucket: Budget503020Bucket): number => {
  const key = normalizeKey(categoryName);
  const direct = profileForKey(key);
  if (direct && direct.bucket === bucket) {
    return direct.weight;
  }

  const rollupKey = normalizeKey(toBudgetTopLevelCategory(categoryName));
  const rollup = profileForKey(rollupKey);
  if (rollup && rollup.bucket === bucket) {
    return rollup.weight;
  }

  return 1;
};

export type Category503020Suggestion = {
  amount: number;
  bucket: Budget503020Bucket;
  bucketLabel: string;
  bucketIncomeSharePercent: number;
};

/** Per-category suggested monthly limit from 50/30/20 pools. */
export const compute503020CategorySuggestions = (
  categoryNames: readonly string[],
  monthlyIncome: number,
): Map<string, Category503020Suggestion> => {
  const result = new Map<string, Category503020Suggestion>();
  if (!Number.isFinite(monthlyIncome) || monthlyIncome <= 0) {
    return result;
  }

  const grouped: Record<Budget503020Bucket, Array<{ name: string; weight: number }>> = {
    needs: [],
    wants: [],
    savings: [],
  };

  for (const name of categoryNames) {
    const trimmed = name.trim();
    if (!trimmed) {
      continue;
    }
    const bucket = classifyBudget503020Bucket(trimmed);
    grouped[bucket].push({ name: trimmed, weight: weightForCategory(trimmed, bucket) });
  }

  for (const bucket of Object.keys(BUCKET_INCOME_SHARE) as Budget503020Bucket[]) {
    const items = grouped[bucket];
    if (items.length === 0) {
      continue;
    }
    const pool = monthlyIncome * BUCKET_INCOME_SHARE[bucket];
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    const sharePct = Math.round(BUCKET_INCOME_SHARE[bucket] * 100);

    for (const item of items) {
      const amount = totalWeight > 0 ? Math.round((pool * item.weight) / totalWeight) : 0;
      result.set(item.name, {
        amount,
        bucket,
        bucketLabel: BUCKET_LABELS[bucket],
        bucketIncomeSharePercent: sharePct,
      });
    }
  }

  return result;
};

export const build503020CategoryBudgets = (
  categoryNames: readonly string[],
  monthlyIncome: number,
): Record<string, number> => {
  const suggestions = compute503020CategorySuggestions(categoryNames, monthlyIncome);
  const out: Record<string, number> = {};
  for (const [name, suggestion] of suggestions) {
    if (suggestion.amount > 0) {
      out[name] = suggestion.amount;
    }
  }
  return out;
};

/** Whether workspace settings contain a real budget template (not an empty/cleared save). */
export const isBudgetSetupConfigured = (
  assumptions: { startingBalance: number; monthlyIncomeEstimate: number },
  limits: Record<string, number>,
): boolean => {
  const income = Number(assumptions.monthlyIncomeEstimate) || 0;
  const balance = Number(assumptions.startingBalance) || 0;
  const limitTotal = Object.values(limits).reduce((sum, n) => sum + (n > 0 ? n : 0), 0);
  if (income <= 0 && balance === 0 && limitTotal <= 0) {
    return false;
  }
  if (income > 0 && limitTotal > 0) {
    return savedBudgetLimitsAreCredible(limits, income);
  }
  return income > 0 || balance !== 0 || limitTotal > 0;
};

/** Saved limits are treated as authoritative only when they resemble a real monthly template. */
export const savedBudgetLimitsAreCredible = (
  limits: Record<string, number>,
  monthlyIncome: number,
): boolean => {
  if (!Number.isFinite(monthlyIncome) || monthlyIncome <= 0) {
    return false;
  }
  const total = Object.values(limits).reduce((sum, n) => sum + (n > 0 ? n : 0), 0);
  return total >= monthlyIncome * 0.1;
};

/** Draft limit strings for Budget Setup (503020 when income is set and saved limits are missing or too small). */
/** Split a budget pool across categories by weight (largest-remainder rounding). */
const distributePoolByWeight = (
  pool: number,
  items: Array<{ name: string; weight: number }>,
): Record<string, number> => {
  const out: Record<string, number> = {};
  if (pool <= 0 || items.length === 0) {
    return out;
  }
  const totalWeight = items.reduce((sum, item) => sum + (item.weight > 0 ? item.weight : 0), 0);
  const effective =
    totalWeight > 0
      ? items.map((item) => ({ name: item.name, weight: item.weight > 0 ? item.weight : 0 }))
      : items.map((item) => ({ name: item.name, weight: 1 }));
  const denom = effective.reduce((sum, item) => sum + item.weight, 0);
  if (denom <= 0) {
    return out;
  }

  const parts: Array<{ name: string; amount: number; remainder: number }> = [];
  let allocated = 0;
  for (const item of effective) {
    const exact = (pool * item.weight) / denom;
    const amount = Math.floor(exact);
    parts.push({ name: item.name, amount, remainder: exact - amount });
    allocated += amount;
  }
  let leftover = Math.round(pool) - allocated;
  parts.sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; leftover > 0 && i < parts.length; i += 1, leftover -= 1) {
    parts[i].amount += 1;
  }
  for (const part of parts) {
    if (part.amount > 0) {
      out[part.name] = part.amount;
    }
  }
  return out;
};

/**
 * When category limits exceed monthly income, scale non-fixed categories to fit.
 * If fixed categories alone exceed income, scale all categories proportionally.
 */
export const rebalanceCategoryLimitsToIncome = (
  categoryNames: readonly string[],
  amounts: Record<string, number>,
  monthlyIncome: number,
  fixedCategories: ReadonlySet<string>,
): Record<string, number> => {
  if (!Number.isFinite(monthlyIncome) || monthlyIncome <= 0) {
    return { ...amounts };
  }

  const readAmount = (cat: string): number => {
    const n = amounts[cat] ?? 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const total = categoryNames.reduce((sum, cat) => sum + readAmount(cat), 0);
  if (total <= monthlyIncome) {
    return { ...amounts };
  }

  const fixed: string[] = [];
  const flexible: string[] = [];
  for (const cat of categoryNames) {
    if (fixedCategories.has(cat)) {
      fixed.push(cat);
    } else {
      flexible.push(cat);
    }
  }

  const fixedSum = fixed.reduce((sum, cat) => sum + readAmount(cat), 0);
  const targetIncome = Math.round(monthlyIncome);

  if (flexible.length === 0 || fixedSum >= targetIncome) {
    const weights = categoryNames.map((name) => ({ name, weight: readAmount(name) }));
    return distributePoolByWeight(targetIncome, weights);
  }

  const result: Record<string, number> = {};
  for (const cat of fixed) {
    const amount = readAmount(cat);
    if (amount > 0) {
      result[cat] = amount;
    }
  }

  const flexPool = targetIncome - fixedSum;
  const flexWeights = flexible.map((name) => ({ name, weight: readAmount(name) }));
  const flexAllocated = distributePoolByWeight(flexPool, flexWeights);
  for (const [name, amount] of Object.entries(flexAllocated)) {
    result[name] = amount;
  }
  return result;
};

export const buildBudgetSetupDraftLimits = (
  categoryNames: readonly string[],
  monthlyIncome: number,
  savedLimits: Record<string, number>,
): Record<string, string> => {
  const from503020 =
    monthlyIncome > 0 ? build503020CategoryBudgets(categoryNames, monthlyIncome) : {};
  const trustSaved = savedBudgetLimitsAreCredible(savedLimits, monthlyIncome);
  const merged: Record<string, string> = {};
  for (const name of categoryNames) {
    const saved = savedLimits[name];
    const amount =
      trustSaved && saved != null && saved > 0 ? saved : from503020[name] ?? 0;
    merged[name] = amount > 0 ? String(amount) : '';
  }
  return merged;
};

export const bucketTotals503020 = (
  monthlyIncome: number,
): Record<Budget503020Bucket, number> => ({
  needs: Math.round(monthlyIncome * BUCKET_INCOME_SHARE.needs),
  wants: Math.round(monthlyIncome * BUCKET_INCOME_SHARE.wants),
  savings: Math.round(monthlyIncome * BUCKET_INCOME_SHARE.savings),
});

/** Share of a monthly budget total; keeps decimals when rounding would show 0%. */
export const formatShareOfMonthlyBudget = (part: number, total: number): string => {
  if (total <= 0) {
    return '—';
  }
  const pct = (part / total) * 100;
  if (pct === 0) {
    return '0%';
  }
  const rounded = Math.round(pct);
  if (rounded === 0) {
    return `${pct.toFixed(1)}%`;
  }
  if (pct < 10) {
    return `${pct.toFixed(1)}%`;
  }
  return `${rounded}%`;
};
