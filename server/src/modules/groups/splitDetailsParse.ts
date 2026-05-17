import { roundCents } from '../../lib/money.js';

export type TemplateSplitRatio = { participant: string; ratio: number };
export type ExpenseSplitAmount = { participant: string; amount: number };

const normalizeSplitDetailsInput = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return null;
};

export const parseTemplateSplitRatios = (value: unknown): TemplateSplitRatio[] => {
  let parsed: unknown = null;
  if (Array.isArray(value)) {
    parsed = value;
  } else if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
    .map((item) => {
      if (typeof item !== 'object' || item === null) {
        return null;
      }
      const participant =
        'participant' in item && typeof item.participant === 'string' ? item.participant.trim() : '';
      const ratio = 'ratio' in item ? Number(item.ratio) : Number.NaN;
      if (!participant || !Number.isFinite(ratio)) {
        return null;
      }
      return { participant, ratio };
    })
    .filter((item): item is TemplateSplitRatio => item !== null);
};

export const stripParticipantFromTemplateSplitJson = (
  splitDetailsJson: string,
  participantName: string,
): string => {
  const normalizedName = participantName.trim().toLowerCase();
  const filtered = parseTemplateSplitRatios(splitDetailsJson).filter(
    (entry) => entry.participant.trim().toLowerCase() !== normalizedName,
  );
  return JSON.stringify(filtered);
};

export const parseExpenseSettlementAmounts = (
  value: unknown,
  expenseAmount?: number,
): ExpenseSplitAmount[] => {
  const normalizedValue = normalizeSplitDetailsInput(value);
  if (!normalizedValue) {
    return [];
  }
  try {
    const parsed = JSON.parse(normalizedValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => {
        if (typeof item !== 'object' || item === null) {
          return null;
        }
        const participant =
          'participant' in item && typeof item.participant === 'string' ? item.participant.trim() : '';
        const explicitAmount = 'amount' in item ? Number(item.amount) : Number.NaN;
        const ratio = 'ratio' in item ? Number(item.ratio) : Number.NaN;
        let amount = explicitAmount;
        if (
          !Number.isFinite(amount) &&
          Number.isFinite(ratio) &&
          expenseAmount !== undefined &&
          Number.isFinite(expenseAmount)
        ) {
          amount = roundCents((expenseAmount * ratio) / 100);
        }
        if (!participant || !Number.isFinite(amount)) {
          return null;
        }
        return { participant, amount: roundCents(amount) };
      })
      .filter((item): item is ExpenseSplitAmount => item !== null);
  } catch {
    return [];
  }
};
