/** Parse a user-typed amount (handles da-DK style thousands/decimal separators). */
export const parseLocaleAmountInput = (raw: string): number => {
  const trimmed = raw.trim().replace(/\s/g, '');
  if (!trimmed) {
    return NaN;
  }
  let normalized: string;
  if (/,\d{1,2}$/.test(trimmed)) {
    normalized = trimmed.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(trimmed)) {
    normalized = trimmed.replace(/\./g, '');
  } else {
    normalized = trimmed.replace(/,/g, '');
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
};
