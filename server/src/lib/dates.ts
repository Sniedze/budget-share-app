/** Normalize DB date values to ISO-8601 strings for API responses. */
export const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();
