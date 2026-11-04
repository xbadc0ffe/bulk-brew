import { COLOR_LABELS } from '@bulk-brew/core';
import type { ColorKey } from '@bulk-brew/ui';

export const fmt = (n: number) => n.toLocaleString('en-US');

export const COLOR_KEY_LABELS: Record<ColorKey, string> = {
  ...COLOR_LABELS,
  C: 'Colorless',
  M: 'Multicolor',
};
