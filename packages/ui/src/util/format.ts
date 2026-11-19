/**
 * A count short enough for a narrow tile: exact up to 999, then 1.2k, 12k,
 * 1.2m. Cut, not rounded, so 999,999 never reads as 1000k.
 */
export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  const [unit, size] = n < 1_000_000 ? ['k', 1000] : ['m', 1_000_000];
  const value = n / size;
  if (value >= 10) return `${Math.floor(value)}${unit}`;
  const tenths = Math.floor(value * 10) / 10;
  return `${Number.isInteger(tenths) ? tenths.toFixed(0) : tenths.toFixed(1)}${unit}`;
}
