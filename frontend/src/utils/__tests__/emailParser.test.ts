import { describe, expect, it } from 'vitest';
import { extractEmails, normaliseRecipients } from '../emailParser';

describe('email parser', () => {
  it('normalises and deduplicates manual recipients', () => {
    expect(normaliseRecipients([' Jane@Example.com ', 'jane@example.com', 'not-an-email'])).toEqual({ valid: ['jane@example.com'], invalid: 1, duplicates: 1 });
  });

  it('uses a CSV email column when present', () => {
    const result = extractEmails('name,email\nJane,jane@example.com\nSam,sam@example.com', 'contacts.csv');
    expect(result).toEqual({ valid: ['jane@example.com', 'sam@example.com'], invalid: 0, duplicates: 0 });
  });
});
