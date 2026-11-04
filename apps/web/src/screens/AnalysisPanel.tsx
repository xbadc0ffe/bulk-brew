import { useMemo, useState } from 'react';
import { COLORS, COLOR_LABELS, type Color } from '@bulk-brew/core';
import {
  analysisRows,
  buildableSizes,
  DECK_SIZES,
  Pip,
  poolSummary,
  scanShortfall,
  ui,
  ViabilityDot,
  ViabilityMark,
} from '@bulk-brew/ui';
import { useAppState } from '../app-context.ts';
import { useNav } from '../nav.ts';

const SIZE_HEADS: Record<number, string> = { 60: '60 cards', 40: '40 cards', 20: '20 cards' };
const fmt = (n: number) => n.toLocaleString('en-US');

/** What the pool can build, for one color at all three sizes. Shown under the Bulk List. */
export function AnalysisPanel() {
  const { scans, pool, index, config, build } = useAppState();
  const nav = useNav();
  const [color, setColor] = useState<Color>(() => build.color ?? 'W');
  const rows = useMemo(() => (scans ? analysisRows(scans, color) : []), [scans, color]);
  const total = useMemo(
    () => (index ? poolSummary(pool.pool, index).cards : 0),
    [index, pool.pool],
  );
  const descriptions = useMemo(
    () => new Map(config.archetypes.archetypes.map((a) => [a.id, a.description])),
    [config],
  );

  if (!scans || !pool.loaded) return <p className={`${ui.note} p-6`}>Loading</p>;

  const scan = scans[60][color];
  const colorless = scan.candidates - scan.colored;
  const sizes = buildableSizes(scans, color);
  const name = COLOR_LABELS[color];

  return (
    <div className="flex flex-col gap-4 px-6 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[16px] font-semibold">Analysis</h2>
        <span className="text-[12.5px] text-fg-2">Scanned {fmt(total)} cards</span>
      </div>

      <div
        role="tablist"
        aria-label="Color"
        className="flex flex-wrap border-b border-line"
        onKeyDown={(e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          e.preventDefault();
          const at = COLORS.indexOf(color);
          const next =
            COLORS[(at + (e.key === 'ArrowRight' ? 1 : COLORS.length - 1)) % COLORS.length]!;
          setColor(next);
          document.getElementById(`tab-${next}`)?.focus();
        }}
      >
        {COLORS.map((c) => {
          const on = c === color;
          return (
            <button
              key={c}
              type="button"
              id={`tab-${c}`}
              role="tab"
              aria-selected={on}
              aria-controls="analysis-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => setColor(c)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3.5 pt-2 pb-2.5 text-[13px] ${
                on ? 'border-ink text-ink' : 'border-transparent text-fg-1 hover:text-ink'
              }`}
            >
              <Pip symbol={c} />
              {COLOR_LABELS[c]}
              <span className="text-[12px] text-fg-2 tabular-nums">
                {fmt(scans[60][c].candidates)}
              </span>
            </button>
          );
        })}
      </div>

      <div
        id="analysis-panel"
        role="tabpanel"
        aria-labelledby={`tab-${color}`}
        className="flex flex-col gap-4"
      >
        <p className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-fg-1">
          <span>
            {name} · {fmt(scan.candidates)} candidates
            {colorless > 0 && ` incl. ${fmt(colorless)} colorless`}
          </span>
          <span>
            Can build:{' '}
            {sizes.length > 0 ? (
              <span className="font-semibold text-ink">{sizes.join(', ')}</span>
            ) : (
              <span className="font-semibold text-ink">nothing yet</span>
            )}
          </span>
        </p>

        {sizes.length === 0 ? (
          <p className={`${ui.box} px-[18px] py-4 text-[13px] text-fg-1`}>
            {name} cannot build a deck yet. Even a 20-card packet{' '}
            {scanShortfall(scans[20][color]) ?? 'needs more cards'}.
          </p>
        ) : (
          <div className={`${ui.box} overflow-x-auto`}>
            <div className="min-w-[640px]">
              <div
                className={`grid grid-cols-[1.3fr_1fr_1fr_1fr] gap-4 border-b border-line px-[18px] py-[9px] ${ui.sectionLabel}`}
              >
                <span>Archetype</span>
                {DECK_SIZES.map((s) => (
                  <span key={s}>{SIZE_HEADS[s]}</span>
                ))}
              </div>
              {rows.map((r) => (
                <div
                  key={r.archetype}
                  className="grid min-h-[54px] grid-cols-[1.3fr_1fr_1fr_1fr] items-center gap-4 border-b-1 border-surface-2 px-[18px] py-2 last:border-b-0"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[13.5px] font-semibold">{r.label}</span>
                    <span className="text-[12px] text-fg-2">{descriptions.get(r.archetype)}</span>
                  </div>
                  {DECK_SIZES.map((s) => (
                    <ViabilityMark key={s} state={r.cells[s].state} detail={r.cells[s].detail} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-fg-2">
          <span className="flex items-center gap-1.5">
            <ViabilityDot state="viable" /> Viable
          </span>
          <span className="flex items-center gap-1.5">
            <ViabilityDot state="near" /> Near miss, what is missing shown
          </span>
          <span className="flex items-center gap-1.5">
            <ViabilityDot state="none" /> Not enough cards
          </span>
          {sizes.length > 0 && (
            <button
              type="button"
              className={`${ui.link} ml-auto text-[12px]`}
              onClick={() => {
                // Land on a size this color can build, and keep a result already shown for it.
                // Leaving 100 brings back the picked colors, so the color is set again then.
                const leave = build.size === 100 || !scans[build.size][color].possible;
                if (leave) build.setSize(sizes[0]!);
                if (leave || build.colors.join('') !== color) build.setColor(color);
                nav.go('build');
              }}
            >
              Build {name.toLowerCase()} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
