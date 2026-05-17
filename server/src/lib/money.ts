/** Round to two decimal places (currency cents). */
export const roundCents = (value: number): number => Math.round(value * 100) / 100;
