// Society prices are stored in full rupees (PKR). A number under 100,000 is
// almost always Lakh or Crore typed by mistake (48 meaning 48 Lakh), which then
// shows as "PKR 48" and breaks price search. Used by the admin society forms.
export const MIN_SOCIETY_PRICE_PKR = 100_000;

export function pkrInWords(n: number): string {
  if (n >= 1e7) return `PKR ${(n / 1e7).toFixed(2)} Crore`;
  if (n >= 1e5) return `PKR ${(n / 1e5).toFixed(1)} Lakh`;
  return `PKR ${n.toLocaleString('en-US')}`;
}

// null = fine (blank is allowed), otherwise a message for the admin.
export function societyPriceProblem(raw: string): string | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 'Enter a number';
  if (n < MIN_SOCIETY_PRICE_PKR) {
    return `Enter the full amount in rupees, not Lakh or Crore (for example 1.74 Crore is 17400000).`;
  }
  return null;
}
