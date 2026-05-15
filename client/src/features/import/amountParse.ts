/** Parsed numeric amount; negative = outflow in signed-column statements, parentheses = negative. */
export const parseSignedAmountFromCell = (raw: string): number => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return 0;
  }
  const negativeByParentheses = /^\(.*\)$/.test(trimmed);
  const cleaned = trimmed
    .replace(/[()]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^\d,.-]/g, '');
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let decimalSeparator = '';
  if (lastComma >= 0 && lastDot >= 0) {
    decimalSeparator = lastComma > lastDot ? ',' : '.';
  } else if (lastComma >= 0) {
    decimalSeparator = ',';
  } else if (lastDot >= 0) {
    decimalSeparator = '.';
  }
  let normalized = cleaned;
  if (decimalSeparator === ',') {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (decimalSeparator === '.') {
    normalized = normalized.replace(/,/g, '');
  } else {
    normalized = normalized.replace(/[,.]/g, '');
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return negativeByParentheses ? -Math.abs(parsed) : parsed;
};

export const normalizeAmountValue = (raw: string): number => Math.abs(parseSignedAmountFromCell(raw));

/**
 * When the file has a single amount column (no debit+credit pair), values are often all positive
 * (expense-only export). Then treat every non-zero row as outgoing instead of incoming.
 */
export const computeAmountColumnAssumeAllOutgoing = (
  dataRows: string[][],
  amountIndex: number,
  debitIndex: number,
  creditIndex: number,
): boolean => {
  if (amountIndex < 0) {
    return false;
  }
  if (debitIndex >= 0 && creditIndex >= 0) {
    return false;
  }
  let seenNonZero = false;
  let seenNegative = false;
  const sample = Math.min(200, dataRows.length);
  for (let i = 0; i < sample; i += 1) {
    const s = parseSignedAmountFromCell(dataRows[i][amountIndex] ?? '');
    if (s !== 0) {
      seenNonZero = true;
    }
    if (s < 0) {
      seenNegative = true;
    }
  }
  return seenNonZero && !seenNegative;
};

export const resolveRowAmountAndFlow = (
  cells: string[],
  amountIndex: number,
  debitIndex: number,
  creditIndex: number,
  amountColumnAssumeAllOutgoing: boolean,
): { magnitude: number; flow: 'in' | 'out' } | null => {
  const debitSigned = debitIndex >= 0 ? parseSignedAmountFromCell(cells[debitIndex] ?? '') : 0;
  const creditSigned = creditIndex >= 0 ? parseSignedAmountFromCell(cells[creditIndex] ?? '') : 0;
  const debitMag = Math.abs(debitSigned);
  const creditMag = Math.abs(creditSigned);

  if (debitIndex >= 0 && creditIndex >= 0) {
    if (debitMag > 0 && creditMag <= 0) {
      return { magnitude: debitMag, flow: 'out' };
    }
    if (creditMag > 0 && debitMag <= 0) {
      return { magnitude: creditMag, flow: 'in' };
    }
    if (debitMag > 0 && creditMag > 0) {
      return { magnitude: debitMag, flow: 'out' };
    }
  } else if (debitIndex >= 0 && debitMag > 0) {
    return { magnitude: debitMag, flow: 'out' };
  } else if (creditIndex >= 0 && creditMag > 0) {
    return { magnitude: creditMag, flow: 'in' };
  }

  if (amountIndex >= 0) {
    const signed = parseSignedAmountFromCell(cells[amountIndex] ?? '');
    if (signed === 0) {
      return null;
    }
    const magnitude = Math.abs(signed);
    if (amountColumnAssumeAllOutgoing) {
      return { magnitude, flow: 'out' };
    }
    const flow = signed < 0 ? 'out' : 'in';
    return { magnitude, flow };
  }

  return null;
};
