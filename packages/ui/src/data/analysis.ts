export type Viability = 'viable' | 'near' | 'none';

const VIABILITY_LABEL: Record<Viability, string> = {
  viable: 'Viable',
  near: 'Near miss',
  none: 'Not enough',
};

export function viabilityLabel(state: Viability): string {
  return VIABILITY_LABEL[state];
}

/** Folds the core's 0 to 7-plus curve into the design's 0 to 6-plus buckets. */
export function curveBuckets(curve: number[]): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0];
  curve.forEach((n, i) => {
    const k = Math.min(i, 6);
    out[k] = (out[k] ?? 0) + n;
  });
  return out;
}
