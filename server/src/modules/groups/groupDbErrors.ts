export const isMissingTableError = (error: unknown, tableName: string): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = 'code' in error ? String(error.code) : '';
  const message = 'message' in error ? String(error.message) : '';
  return code === 'ER_NO_SUCH_TABLE' && message.includes(tableName);
};
