import Papa from 'papaparse';

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const STRICT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ParsedRecipients {
  valid: string[];
  invalid: number;
  duplicates: number;
}

export function normaliseRecipients(values: string[]): ParsedRecipients {
  const valid = new Set<string>();
  let invalid = 0;
  let duplicates = 0;
  for (const value of values) {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) continue;
    if (STRICT_EMAIL.test(trimmed)) {
      if (valid.has(trimmed)) duplicates += 1;
      else valid.add(trimmed);
    }
    else invalid += 1;
  }
  return { valid: [...valid], invalid, duplicates };
}

export function extractEmails(content: string, fileName: string): ParsedRecipients {
  const isCsv = fileName.toLowerCase().endsWith('.csv');
  let candidates: string[] = [];
  if (isCsv) {
    const parsed = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true });
    const fields = parsed.meta.fields ?? [];
    const emailColumn = fields.find((field) => ['email', 'e-mail', 'email_address', 'emailaddress', 'mail'].includes(field.toLowerCase()));
    if (emailColumn) candidates = parsed.data.map((row) => row[emailColumn] ?? '');
  }
  if (candidates.length === 0) candidates = content.match(EMAIL_PATTERN) ?? [];
  return normaliseRecipients(candidates);
}
