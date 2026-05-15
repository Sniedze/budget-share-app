import { DATE_COLUMN_ALIASES } from './constants';
import { includesAnyAlias } from './csvParse';

export const formatDateYmd = (date: Date): string => {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Normalize odd bank/Excel spacing and dash characters before parsing dates. */
export const sanitizeDateInputForParse = (raw: string): string =>
  raw
    .trim()
    .replace(/[\uFEFF\u200E\u200F]/g, '')
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .replace(/[\u2013\u2014]/g, '-');

/** Lower rank = preferred when a CSV has several date-like columns (e.g. valør vs bogføring). */
export const dateColumnRank = (normalizedHeaderCell: string): number => {
  const h = normalizedHeaderCell;
  if (
    h.includes('bogfr') ||
    h.includes('bogf') ||
    h.includes('bokfr') ||
    h.includes('booked') ||
    h.includes('posting') ||
    h.includes('tilskrev')
  ) {
    return 0;
  }
  if (h.includes('handels') || h.includes('transaktions') || h.includes('transaktion')) {
    return 1;
  }
  if (h.includes('dato') || h.includes('date')) {
    return 2;
  }
  if (h.includes('valr') || h.includes('valor')) {
    return 4;
  }
  return 3;
};

/** Heuristic content score: which column actually looks like dates in the data rows. */
export const scoreDateColumnContent = (dataRows: string[][], colIdx: number): number => {
  if (colIdx < 0 || dataRows.length === 0) {
    return -1000;
  }
  const sample = Math.min(100, dataRows.length);
  let score = 0;
  for (let i = 0; i < sample; i += 1) {
    const raw = sanitizeDateInputForParse(dataRows[i][colIdx] ?? '');
    if (!raw) {
      continue;
    }
    const noSpace = raw.replace(/\s+/g, '');
    // Penalise typical EU bank amounts in the wrong column
    if (/^\d{1,3}(?:\.\d{3})+,\d{2}$/.test(raw) || /^\d+,\d{2}$/.test(noSpace) || /^\d+[.,]\d{2}$/.test(noSpace)) {
      score -= 6;
      continue;
    }
    if (/^\d{4}[-./]\d{1,2}[-./]\d{1,2}(?:[T\s]|$)/.test(raw)) {
      score += 6;
      continue;
    }
    if (/^\d{1,2}\.\d{1,2}\.\d{4}(?:\s|$)/.test(raw) || /^\d{1,2}\/\d{1,2}\/\d{4}(?:\s|$)/.test(raw)) {
      score += 6;
      continue;
    }
    if (/\d{1,2}[./-]\d{1,2}[./-]\d{4}/.test(raw)) {
      score += 3;
      continue;
    }
    if (/^\d{5,6}$/.test(noSpace)) {
      score += 1;
    }
    if (/\d{1,2}[./-]\d{1,2}[./-]\d{2}(?:\D|$)/.test(raw)) {
      score += 1;
    }
  }
  return score;
};

/**
 * Pick the date column using row content, not headers alone. Fixes wrong/stale mappings (e.g. valør
 * vs bogføring, or reference IDs interpreted as Excel serials).
 */
export const pickDateColumnFromData = (
  headerNorm: string[],
  dataRows: string[][],
  rememberedDateIndex: number,
): number => {
  const width = headerNorm.length;
  if (width === 0) {
    return -1;
  }
  const fromHeader: number[] = [];
  for (let i = 0; i < width; i += 1) {
    if (includesAnyAlias(headerNorm[i] ?? '', DATE_COLUMN_ALIASES)) {
      fromHeader.push(i);
    }
  }
  const baseIndices = fromHeader.length > 0 ? fromHeader : Array.from({ length: width }, (_, j) => j);
  const indexSet = new Set(baseIndices);
  if (rememberedDateIndex >= 0 && rememberedDateIndex < width) {
    indexSet.add(rememberedDateIndex);
  }
  const indices = Array.from(indexSet);

  let bestIdx = indices[0];
  let bestTotal = -Infinity;
  for (const idx of indices) {
    const s = scoreDateColumnContent(dataRows, idx);
    const tieBreak = (10 - dateColumnRank(headerNorm[idx] ?? '')) * 0.02;
    const total = s + tieBreak;
    if (total > bestTotal) {
      bestTotal = total;
      bestIdx = idx;
    }
  }

  if (rememberedDateIndex < 0 || !indices.includes(rememberedDateIndex)) {
    return bestIdx;
  }
  const remScore = scoreDateColumnContent(dataRows, rememberedDateIndex);
  const bestScore = scoreDateColumnContent(dataRows, bestIdx);
  if (bestScore >= remScore + 3) {
    return bestIdx;
  }
  return rememberedDateIndex;
};

export const parseDmyPartsToYmd = (aStr: string, bStr: string, yearStr: string): string => {
  const a = Number.parseInt(aStr, 10);
  const b = Number.parseInt(bStr, 10);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return '';
  }
  let year = Number.parseInt(yearStr, 10);
  if (!Number.isFinite(year)) {
    return '';
  }
  if (yearStr.length === 2) {
    year += year >= 70 ? 1900 : 2000;
  }
  if (year < 1900 || year > 2100) {
    return '';
  }

  let day: number;
  let month: number;
  if (a > 12) {
    day = a;
    month = b;
  } else if (b > 12) {
    month = a;
    day = b;
  } else {
    day = a;
    month = b;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return '';
  }
  const trial = new Date(Date.UTC(year, month - 1, day));
  if (
    trial.getUTCFullYear() !== year ||
    trial.getUTCMonth() !== month - 1 ||
    trial.getUTCDate() !== day
  ) {
    return '';
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const DMY_SEGMENT = '(\\d{1,2})[./-](\\d{1,2})[./-](\\d{2,4})';

/** Split on spaces and semicolons so "26.03.2026;30.03.2026" tries each token as a full date. */
const splitDateishTokens = (s: string): string[] =>
  s
    .split(/[\s;]+/)
    .map((t) => t.replace(/[,;:]+$/g, '').trim())
    .filter(Boolean);

/**
 * Pick one calendar date from a cell: merge token-sized matches and regex scans, prefer any match
 * with a 4-digit year, then the rightmost match (booking date often after valør; avoids returning
 * the first token like `26.03.30` when `30.03.2026` appears later).
 */
const pickBestDmyYmd = (trimmed: string): string => {
  type Cand = { ymd: string; fourDigitYear: boolean; pos: number };
  const cands: Cand[] = [];
  const dmyFull = new RegExp(`^${DMY_SEGMENT}$`);
  let searchFrom = 0;
  for (const token of splitDateishTokens(trimmed)) {
    const m = token.match(dmyFull);
    if (m) {
      const ymd = parseDmyPartsToYmd(m[1], m[2], m[3]);
      if (ymd) {
        const pos = trimmed.indexOf(token, searchFrom);
        const at = pos >= 0 ? pos : searchFrom;
        if (pos >= 0) {
          searchFrom = pos + token.length;
        }
        cands.push({ ymd, fourDigitYear: m[3].length >= 4, pos: at });
      }
    }
  }
  const re = new RegExp(DMY_SEGMENT, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(trimmed)) !== null) {
    const ymd = parseDmyPartsToYmd(match[1], match[2], match[3]);
    if (ymd) {
      cands.push({ ymd, fourDigitYear: match[3].length >= 4, pos: match.index });
    }
  }
  if (cands.length === 0) {
    return '';
  }
  const preferFour = cands.some((c) => c.fourDigitYear);
  const pool = preferFour ? cands.filter((c) => c.fourDigitYear) : cands;
  pool.sort((a, b) => a.pos - b.pos);
  return pool[pool.length - 1].ymd;
};

export const normalizeDate = (raw: string): string => {
  const trimmed = sanitizeDateInputForParse(raw);
  if (!trimmed) {
    return '';
  }
  // ISO order year-month-day: hyphens, slashes (e.g. Danish banks 2026/01/30), or dots
  const isoLike = trimmed.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:[T\s]|$)/);
  if (isoLike) {
    const year = Number.parseInt(isoLike[1], 10);
    const month = Number.parseInt(isoLike[2], 10);
    const day = Number.parseInt(isoLike[3], 10);
    const trial = new Date(Date.UTC(year, month - 1, day));
    if (
      trial.getUTCFullYear() === year &&
      trial.getUTCMonth() === month - 1 &&
      trial.getUTCDate() === day
    ) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return '';
  }
  const dateTimeIsoLike = trimmed.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})T/);
  if (dateTimeIsoLike) {
    const year = Number.parseInt(dateTimeIsoLike[1], 10);
    const month = Number.parseInt(dateTimeIsoLike[2], 10);
    const day = Number.parseInt(dateTimeIsoLike[3], 10);
    const trial = new Date(Date.UTC(year, month - 1, day));
    if (
      trial.getUTCFullYear() === year &&
      trial.getUTCMonth() === month - 1 &&
      trial.getUTCDate() === day
    ) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return '';
  }

  const dmyPick = pickBestDmyYmd(trimmed);
  if (dmyPick) {
    return dmyPick;
  }

  // Excel serial only for a whole-cell integer (avoid amounts like 45483,00 or 26.03 parsed wrong)
  const excelCompact = trimmed.replace(/\s+/g, '');
  if (/^\d+$/.test(excelCompact)) {
    const n = Number.parseInt(excelCompact, 10);
    if (n >= 30000 && n <= 120000) {
      const epoch = Date.UTC(1899, 11, 30);
      const d = new Date(epoch + n * 86400000);
      if (!Number.isNaN(d.getTime())) {
        return formatDateYmd(d);
      }
    }
  }

  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) {
    return formatDateYmd(direct);
  }
  return '';
};

export const getDateSignatureVariants = (rawDate: string): string[] => {
  const normalized = normalizeDate(rawDate);
  if (!normalized) {
    return [];
  }
  const variants = new Set<string>([normalized]);
  if (rawDate.includes('T')) {
    const parsed = new Date(rawDate);
    if (!Number.isNaN(parsed.getTime())) {
      const minusOne = new Date(parsed.getTime() - 24 * 60 * 60 * 1000);
      const plusOne = new Date(parsed.getTime() + 24 * 60 * 60 * 1000);
      variants.add(formatDateYmd(parsed));
      variants.add(formatDateYmd(minusOne));
      variants.add(formatDateYmd(plusOne));
    }
  }
  return Array.from(variants);
};
