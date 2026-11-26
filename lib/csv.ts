export type CsvValue = string | number | null;

function escapeCsvCell(value: CsvValue): string {
  const text = value == null ? "" : String(value);
  const safeText = /^[\u0000-\u0020]*[=+\-@]/.test(text)
    ? `'${text}`
    : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export function serializeCsv(rows: readonly (readonly CsvValue[])[]): string {
  return `${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")}\r\n`;
}
