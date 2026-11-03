import { useEffect, useState, type RefObject } from 'react';

export interface WindowedRows {
  /** First and one-past-last row index to render. */
  start: number;
  end: number;
  /** Heights of the spacers that stand in for the rows above and below. */
  topPad: number;
  bottomPad: number;
}

/**
 * Renders only the rows near the viewport for long lists that scroll with the
 * page. The caller owns the ref to the element that wraps the rows and marks
 * each real row with `data-row`. Row height is measured from the first
 * rendered row (the estimate is used until one exists) and re-measured
 * whenever `version` changes, for example on sort or filter. With few rows it
 * renders everything.
 */
export function useWindowedRows(
  count: number,
  estimatedRowHeight: number,
  container: RefObject<HTMLElement | null>,
  version = '',
  threshold = 300,
): WindowedRows {
  const [range, setRange] = useState({ start: 0, end: count, rowHeight: estimatedRowHeight });
  const active = count > threshold;

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = container.current;
      if (!el) return;
      const sample = el.querySelector<HTMLElement>('[data-row]');
      const rowHeight = sample?.offsetHeight || estimatedRowHeight;
      const top = el.getBoundingClientRect().top;
      const viewport = window.innerHeight;
      const overscan = 12;
      const first = Math.max(0, Math.floor(-top / rowHeight) - overscan);
      const last = Math.min(count, Math.ceil((viewport - top) / rowHeight) + overscan);
      setRange((r) =>
        r.start === first && r.end === last && r.rowHeight === rowHeight
          ? r
          : { start: first, end: last, rowHeight },
      );
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [active, count, estimatedRowHeight, container, version]);

  if (!active) return { start: 0, end: count, topPad: 0, bottomPad: 0 };
  const start = Math.min(range.start, count);
  const end = Math.min(range.end, count);
  return {
    start,
    end,
    topPad: start * range.rowHeight,
    bottomPad: Math.max(0, (count - end) * range.rowHeight),
  };
}
