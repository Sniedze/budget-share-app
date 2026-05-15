import type { CreateExpenseInput, SplitAllocation } from './types.js';
import { appError, ErrorCode } from '../../graphql/appError.js';

const roundToCents = (value: number): number => Math.round(value * 100) / 100;

/** Allocates expense amount across participants; residual cents go to the last row. */
export const toStoredSplitDetails = (
  amount: number,
  splitDetails: CreateExpenseInput['splitDetails'],
): SplitAllocation[] => {
  if (!splitDetails || splitDetails.length === 0) {
    return [];
  }

  const normalized = splitDetails
    .map((entry) => ({
      participant: entry.participant.trim(),
      ratio: Number(entry.ratio),
    }))
    .filter((entry) => entry.participant.length > 0 && Number.isFinite(entry.ratio) && entry.ratio > 0);

  if (normalized.length === 0) {
    return [];
  }

  const ratioTotal = normalized.reduce((sum, entry) => sum + entry.ratio, 0);
  if (Math.abs(ratioTotal - 100) > 0.01) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Split ratios must sum to 100.');
  }

  let allocated = 0;
  return normalized.map((entry, index) => {
    const isLast = index === normalized.length - 1;
    const rawAmount = (amount * entry.ratio) / 100;
    const shareAmount = isLast ? roundToCents(amount - allocated) : roundToCents(rawAmount);
    allocated = roundToCents(allocated + shareAmount);

    return {
      participant: entry.participant,
      ratio: roundToCents(entry.ratio),
      amount: shareAmount,
    };
  });
};
