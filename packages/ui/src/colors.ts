import { COLOR_LABELS, COLORS, type Color } from '@bulk-brew/core';

/** One source of truth for color names lives in the core. */
export const COLOR_NAMES: Record<Color, string> = COLOR_LABELS;

export const COLOR_ORDER: readonly Color[] = COLORS;
