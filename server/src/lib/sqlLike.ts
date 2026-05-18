/** Escape `%` and `_` for use in SQL LIKE patterns with ESCAPE '\\'. */
export const escapeSqlLikePattern = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
