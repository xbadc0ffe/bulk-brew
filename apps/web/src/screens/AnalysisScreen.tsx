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
import { PackGate } from '../screens.tsx';

const SIZE_HEADS: Record<number, string> = { 60: '60 cards', 40: '40 cards', 20: '20 Jumpstart' };
const fmt = (n: number) => n.toLocaleString('en-US');

export function AnalysisScreen() {
  return (
    <PackGate>
      <Analysis />
    </PackGate>
  );
}

function Analysis() {
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

  if (!scans || !pool.loaded) return <p className={`${ui.note} p-8`}>Loading pool</p>;
  if (total === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className={ui.note}>Your pool is empty. Import a list to see what it can build.</p>
        <button type="button" className={ui.primary} onClick={() => nav.go('import')}>
          Import
        </button>
      </div>
    );
  }

  const scan = scans[60][color];
  const colorless = scan.candidates - scan.colored;
  const sizes = buildableSizes(scans, color);
  const name = COLOR_LABELS[color];

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-8 py-[22px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-[20px] font-semibold">Pool analysis</h1>
        <span className="text-[12.5px] text-fg-2">Scanned {fmt(total)} cards</span>
      </div>

      <div role="tablist" aria-label="Color" className="flex flex-wrap border-b border-line">
        {COLORS.map((c) => {
          const on = c === color;
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={on}
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

      <div role="tabpanel" aria-label={name} className="flex flex-col gap-4">
        <p className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-fg-1">
          <span>
            {name} · {fmt(scan.candidates)} candidates
            {colorless > 0 && ` incl. ${fmt(colorless)} colorless`}
          </span>
          <span>
            Can build:{' '}
            {sizes.length > 0 ? (
              <span className="font-medium text-ink">{sizes.join(', ')}</span>
            ) : (
              <span className="font-medium text-ink">nothing yet</span>
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
                  className="grid min-h-[54px] grid-cols-[1.3fr_1fr_1fr_1fr] items-center gap-4 border-b border-surface-2 px-[18px] py-2 last:border-b-0"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[13.5px] font-medium">{r.label}</span>
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
          <button
            type="button"
            className={`${ui.link} ml-auto text-[12px]`}
            onClick={() => {
              build.setColor(color);
              nav.go('build');
            }}
          >
            Build {name.toLowerCase()} →
          </button>
        </div>
      </div>
    </div>
  );
}
