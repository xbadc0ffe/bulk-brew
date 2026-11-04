import { describe, expect, it } from 'vitest';
import {
  clampView,
  panView,
  pinchView,
  START_VIEW,
  ZOOM_MAX,
  ZOOM_MIN,
  zoomAround,
  type ZoomBox,
} from '../src/data/zoom.ts';

// A 600 by 840 card in a 1000 by 900 view; FIT is that size, 100%.
const box: ZoomBox = { width: 600, height: 840, viewWidth: 1000, viewHeight: 900 };
const FIT = { scale: 1, x: 0, y: 0 };

describe('zoom', () => {
  it('keeps the spot under the cursor still', () => {
    const at = { x: 100, y: -200 };
    const v = zoomAround(FIT, 2, at, box);
    expect(v.scale).toBe(2);
    // Unzoomed, the image point under `at` is `at` itself; zoomed, it must still land there.
    expect(v.x + v.scale * at.x).toBeCloseTo(at.x, 5);
    expect(v.y + v.scale * at.y).toBeCloseTo(at.y, 5);
  });

  it('stays between 50% and the largest zoom, and opens at 75%', () => {
    expect(ZOOM_MIN).toBe(0.5);
    expect(START_VIEW.scale).toBe(0.75);
    expect(zoomAround(FIT, 0.1, { x: 0, y: 0 }, box)).toEqual({ scale: ZOOM_MIN, x: 0, y: 0 });
    expect(zoomAround(FIT, 100, { x: 0, y: 0 }, box).scale).toBe(ZOOM_MAX);
    // Zooming out around a corner still leaves a small card centered.
    expect(zoomAround(START_VIEW, 0.5, { x: 300, y: 300 }, box)).toEqual({
      scale: ZOOM_MIN,
      x: 0,
      y: 0,
    });
  });

  it('keeps the image from being pulled past the edges', () => {
    // At 100% the card fits, so it cannot move.
    expect(panView(FIT, 50, 50, box)).toEqual(FIT);
    expect(panView(START_VIEW, 50, 50, box)).toEqual(START_VIEW);
    // At 2x it is 1200 by 1680: 100 to spare on each side across, 390 up and down.
    expect(clampView({ scale: 2, x: 500, y: -999 }, box)).toEqual({ scale: 2, x: 100, y: -390 });
  });

  it('follows two fingers as they spread and move', () => {
    const start = { scale: 1, x: 0, y: 0 };
    const v = pinchView(start, 100, 200, { x: 0, y: 0 }, { x: 0, y: 0 }, box);
    expect(v.scale).toBe(2);
    expect(v).toEqual({ scale: 2, x: 0, y: 0 });
    // The spot between the fingers travels with them.
    const moved = pinchView(start, 100, 200, { x: 50, y: 50 }, { x: 80, y: 60 }, box);
    expect(moved.x).toBeCloseTo(80 - 2 * 50, 5);
    expect(moved.y).toBeCloseTo(60 - 2 * 50, 5);
  });
});
