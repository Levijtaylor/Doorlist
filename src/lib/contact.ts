export type Cleaned = { value: string | null; error?: string };

/** Normalizes to E.164. Ten-digit numbers are treated as US/Canada. */
export function cleanPhone(input: string | null | undefined): Cleaned {
  const raw = (input ?? '').trim();
  if (!raw) return { value: null };
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+') && digits.length >= 8 && digits.length <= 15) return { value: `+${digits}` };
  if (digits.length === 10) return { value: `+1${digits}` };
  if (digits.length === 11 && digits.startsWith('1')) return { value: `+${digits}` };
  return { value: null, error: 'Enter a full mobile number, like (555) 123-4567 or +44 7700 900123.' };
}

export function cleanEmail(input: string | null | undefined): Cleaned {
  const raw = (input ?? '').trim().toLowerCase();
  if (!raw) return { value: null };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return { value: null, error: 'Enter a valid email address.' };
  return { value: raw };
}

export function displayPhone(e164: string | null | undefined): string {
  if (!e164) return '';
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}
