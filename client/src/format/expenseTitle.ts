/** Must match the separator used when combining merchant + description on import. */
export const EXPENSE_TITLE_DESCRIPTION_SEPARATOR = ' — ';

export function splitExpenseTitleForDisplay(title: string): { merchant: string; description: string } {
  const trimmed = title.trim();
  const sep = EXPENSE_TITLE_DESCRIPTION_SEPARATOR;
  const idx = trimmed.indexOf(sep);
  if (idx === -1) {
    return { merchant: trimmed, description: '' };
  }
  return {
    merchant: trimmed.slice(0, idx).trim(),
    description: trimmed.slice(idx + sep.length).trim(),
  };
}
