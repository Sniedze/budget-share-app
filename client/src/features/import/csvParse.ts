export const parseDelimitedLine = (line: string, delimiter: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  result.push(current.trim());
  return result;
};

/** Split into logical CSV rows; newlines inside double-quoted fields do not end a row. */
export const splitCsvRecords = (text: string): string[] => {
  const records: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      const next = text[i + 1];
      current += char;
      if (inQuotes && next === '"') {
        current += next;
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[i + 1] === '\n') {
        i += 1;
      }
      records.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  records.push(current);
  return records;
};

export const detectDelimiter = (sampleLines: string[]): string => {
  const candidates = [',', ';', '\t'];
  const scored = candidates.map((candidate) => {
    const score = sampleLines.reduce((sum, line) => {
      return sum + parseDelimitedLine(line, candidate).length;
    }, 0);
    return { delimiter: candidate, score };
  });
  const best = scored.sort((left, right) => right.score - left.score)[0];
  return best?.score > 1 ? best.delimiter : ',';
};

export const normalizeHeaderKey = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export const includesAnyAlias = (header: string, aliases: string[]): boolean =>
  aliases.some((alias) => header.includes(alias));

export const padDataRowsToWidth = (rows: string[][], width: number): string[][] =>
  rows.map((row) => {
    if (row.length >= width) {
      return row;
    }
    return [...row, ...Array(width - row.length).fill('')];
  });

export const rowLooksLikeRepeatedHeader = (cells: string[], headerCells: string[]): boolean => {
  if (cells.length < 2 || headerCells.length < 2) {
    return false;
  }
  let matches = 0;
  const max = Math.min(cells.length, headerCells.length, 8);
  for (let i = 0; i < max; i += 1) {
    const c = normalizeHeaderKey(cells[i] ?? '');
    const h = normalizeHeaderKey(headerCells[i] ?? '');
    if (c && h && c === h) {
      matches += 1;
    }
  }
  return matches >= 3 || (matches >= 2 && normalizeHeaderKey(cells[0] ?? '') === normalizeHeaderKey(headerCells[0] ?? ''));
};

export const sanitizeCellText = (raw: string): string => {
  const cleaned = Array.from(raw)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('')
    .trim();
  if (!cleaned) {
    return '';
  }
  // Prevent CSV/formula injection when displaying or re-exporting user-provided text.
  if (/^[=+\-@]/.test(cleaned)) {
    return `'${cleaned}`;
  }
  return cleaned;
};

export const getFallbackHeader = (header: string[], dataRows: string[][]): string[] => {
  const hasUsableHeader = header.some((value) => value.trim().length > 0);
  if (hasUsableHeader && header.length > 1) {
    return header;
  }
  const widthFromRows = dataRows.reduce((max, row) => Math.max(max, row.length), header.length);
  return Array.from({ length: Math.max(widthFromRows, 1) }, (_, index) => `Column ${index + 1}`);
};
