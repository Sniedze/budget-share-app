export const downloadUserDataExport = (exportedAt: string, data: string): void => {
  const datePart = exportedAt.slice(0, 10);
  const filename = `budgetshare-export-${datePart}.json`;
  const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
