import type { SplitAllocation } from './types.js';

export const parseSplitDetails = (rawValue: string | SplitAllocation[] | null): SplitAllocation[] => {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = typeof rawValue === 'string' ? (JSON.parse(rawValue) as unknown) : rawValue;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => {
        const participant =
          typeof entry === 'object' &&
          entry !== null &&
          'participant' in entry &&
          typeof entry.participant === 'string'
            ? entry.participant
            : '';
        const ratio =
          typeof entry === 'object' && entry !== null && 'ratio' in entry && Number.isFinite(entry.ratio)
            ? Number(entry.ratio)
            : NaN;
        const amount =
          typeof entry === 'object' && entry !== null && 'amount' in entry && Number.isFinite(entry.amount)
            ? Number(entry.amount)
            : NaN;

        return { participant, ratio, amount };
      })
      .filter(
        (entry) => entry.participant.length > 0 && Number.isFinite(entry.ratio) && Number.isFinite(entry.amount),
      );
  } catch {
    return [];
  }
};
