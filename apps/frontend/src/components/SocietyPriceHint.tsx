import { pkrInWords, societyPriceProblem } from '@/lib/pkr';

// Shown under a society price input: the amount in words, or why it is refused.
export function SocietyPriceHint({ value }: { value: string }) {
  if (value.trim() === '') return null;
  const problem = societyPriceProblem(value);
  return (
    <span style={{ fontSize: '12px', color: problem ? 'var(--error)' : 'var(--muted)', marginTop: '2px' }}>
      {problem ?? `= ${pkrInWords(Number(value))}`}
    </span>
  );
}
