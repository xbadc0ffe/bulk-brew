// Zoom and pan for the full-screen card. 100% is the size that fills the
// window's height. Points are measured from the center of the view, where
// the image sits unmoved; the image is moved by (x, y) and then scaled about
// its own center.

export interface ZoomView {
  scale: number;
  x: number;
  y: number;
}

export interface Point {
  x: number;
  y: number;
}

/** The image's size at 100% and the size of the area it shows in. */
export interface ZoomBox {
  width: number;
  height: number;
  viewWidth: number;
  viewHeight: number;
}

export const ZOOM_MIN = 0.5;
/** Scryfall's largest image is about 670 by 930 pixels, so more than this only blurs. */
export const ZOOM_MAX = 4;
/** One press of the zoom buttons. */
export const ZOOM_STEP = 1.25;

/** Where a full-screen card opens and where Reset returns; 100% is more than most want. */
export const START_VIEW: ZoomView = { scale: 0.75, x: 0, y: 0 };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Keep the scale in range and the image from being pulled past the view's edges. */
export function clampView(v: ZoomView, box: ZoomBox): ZoomView {
  const scale = clamp(v.scale, ZOOM_MIN, ZOOM_MAX);
  const maxX = Math.max(0, (box.width * scale - box.viewWidth) / 2);
  const maxY = Math.max(0, (box.height * scale - box.viewHeight) / 2);
  return { scale, x: clamp(v.x, -maxX, maxX), y: clamp(v.y, -maxY, maxY) };
}

/** Scale by `factor`, keeping the spot under `at` where it is. */
export function zoomAround(v: ZoomView, factor: number, at: Point, box: ZoomBox): ZoomView {
  const scale = clamp(v.scale * factor, ZOOM_MIN, ZOOM_MAX);
  const k = scale / v.scale;
  return clampView({ scale, x: at.x - k * (at.x - v.x), y: at.y - k * (at.y - v.y) }, box);
}

/**
 * Two fingers: from the view when they touched down, scale by how far apart
 * they have moved and carry the spot between them along with them.
 */
export function pinchView(
  start: ZoomView,
  startDistance: number,
  distance: number,
  startMid: Point,
  mid: Point,
  box: ZoomBox,
): ZoomView {
  const scale = clamp((start.scale * distance) / Math.max(1, startDistance), ZOOM_MIN, ZOOM_MAX);
  const k = scale / start.scale;
  return clampView(
    { scale, x: mid.x - k * (startMid.x - start.x), y: mid.y - k * (startMid.y - start.y) },
    box,
  );
}

/** Move by (dx, dy), within the edges. */
export function panView(v: ZoomView, dx: number, dy: number, box: ZoomBox): ZoomView {
  return clampView({ ...v, x: v.x + dx, y: v.y + dy }, box);
}
