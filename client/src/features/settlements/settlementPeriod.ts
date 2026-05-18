export const SETTLEMENT_PERIODS = ['CurrentMonth', 'Last6Months', 'Last12Months'] as const;

export type SettlementPeriodValue = (typeof SETTLEMENT_PERIODS)[number];

export type SettlementPeriodRange = {
  startIso: string;
  endIso: string;
};

export const SETTLEMENT_PERIOD_OPTIONS: Array<{ value: SettlementPeriodValue; label: string }> = [
  { value: 'CurrentMonth', label: 'This month' },
  { value: 'Last6Months', label: 'Last 6 months (½ year)' },
  { value: 'Last12Months', label: 'Last 12 months (1 year)' },
];

const toIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const settlementPeriodRange = (
  period: SettlementPeriodValue,
  reference = new Date(),
): SettlementPeriodRange => {
  const end = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  let start: Date;
  switch (period) {
    case 'Last6Months':
      start = new Date(end);
      start.setMonth(start.getMonth() - 6);
      break;
    case 'Last12Months':
      start = new Date(end);
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      start = new Date(end.getFullYear(), end.getMonth(), 1);
      break;
  }
  return { startIso: toIsoDate(start), endIso: toIsoDate(end) };
};

const formatShortDate = (iso: string): string => {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

export const formatSettlementPeriodLabel = (
  period: SettlementPeriodValue,
  reference = new Date(),
): string => {
  const range = settlementPeriodRange(period, reference);
  if (period === 'CurrentMonth') {
    const monthDate = new Date(`${range.startIso}T12:00:00`);
    return monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  return `${formatShortDate(range.startIso)} – ${formatShortDate(range.endIso)}`;
};

export const suggestSettlementDueDate = (
  period: SettlementPeriodValue,
  reference = new Date(),
): string => {
  if (period === 'CurrentMonth') {
    const due = new Date(reference.getFullYear(), reference.getMonth() + 1, 5);
    return toIsoDate(due);
  }
  const range = settlementPeriodRange(period, reference);
  return range.endIso;
};
