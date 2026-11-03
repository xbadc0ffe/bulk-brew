import { useEffect, useRef } from 'react';
import { COLORS, COLOR_LABELS, type DeckSize } from '@bulk-brew/core';
import { DeckView } from '@bulk-brew/ui';
import { useAppState } from '../app-context.ts';

const button =
  'rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800';
const primary =
  'rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300';
const muted = 'text-sm text-zinc-600 dark:text-zinc-400';
const selected = 'ring-2 ring-zinc-500';

const SIZES: { size: DeckSize; label: string }[] = [
  { size: 60, label: '60 cards' },
  { size: 40, label: '40 cards' },
  { size: 20, label: '20-card packet' },
];

export function BuildScreen() {
  const { index, config, pack, build: flow } = useAppState();
  const styleSection = useRef<HTMLElement>(null);

  // "Try another style" asks for the style list; scroll there once the form is back.
  useEffect(() => {
    if (flow.styleFocusRequest === 0 || flow.result) return;
    const section = styleSection.current;
    if (!section) return;
    section.scrollIntoView({ block: 'start' });
    section.querySelector<HTMLInputElement>('input[type=radio]')?.focus();
  }, [flow.styleFocusRequest, flow.result]);

  if (pack.status === 'error') {
    return <p className="text-sm text-amber-600">Card data failed to load: {pack.error}</p>;
  }
  if (pack.status !== 'ready' || !index) return <p className={muted}>Loading card data.</p>;

  if (flow.result) {
    return (
      <DeckView
        deck={flow.result.deck}
        index={index}
        config={config}
        mode="fresh"
        onAccept={flow.accept}
        onTryAnotherStyle={flow.tryAnotherStyle}
        onDiscard={flow.discard}
      />
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      {flow.accepted && (
        <p className="rounded border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          Saved "{flow.accepted.name}" and removed its cards from the pool. Build another from what
          is left.
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Size</h2>
        <div className="flex flex-wrap gap-2">
          {SIZES.map((s) => (
            <button
              key={s.size}
              type="button"
              className={`${button} ${flow.size === s.size ? selected : ''}`}
              aria-pressed={flow.size === s.size}
              onClick={() => flow.setSize(s.size)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Color</h2>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => {
            const scan = flow.scans?.[c];
            return (
              <button
                key={c}
                type="button"
                className={`${button} ${flow.color === c ? selected : ''}`}
                aria-pressed={flow.color === c}
                disabled={!scan?.possible}
                title={scan?.notes.join('; ')}
                onClick={() => flow.setColor(c)}
              >
                {COLOR_LABELS[c]} <span className="text-zinc-500">{scan?.candidates ?? 0}</span>
              </button>
            );
          })}
        </div>
        <p className={muted}>Counts are spell copies in the pool that fit each color.</p>
      </section>

      {flow.colorScan && (
        <section ref={styleSection} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Style</h2>
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="style"
                checked={flow.style === undefined}
                onChange={() => flow.setStyle(undefined)}
              />
              Best fit
            </label>
            {flow.colorScan.archetypes.map((a) => (
              <label
                key={a.archetype}
                className={`flex items-center gap-2 text-sm ${a.viable ? '' : 'text-zinc-500'}`}
              >
                <input
                  type="radio"
                  name="style"
                  checked={flow.style === a.archetype}
                  disabled={!a.viable}
                  onChange={() => flow.setStyle(a.archetype)}
                />
                <span>{a.label}</span>
                <span className="text-xs text-zinc-500">
                  {a.kind === 'synergy'
                    ? `${a.enablers.have} enablers, ${a.payoffs.have} payoffs`
                    : `${a.enablers.have} spells`}
                  {a.notes.length > 0 && `, ${a.notes.join('; ')}`}
                </span>
              </label>
            ))}
          </div>
        </section>
      )}

      <div className="flex items-center gap-3">
        <button type="button" className={primary} disabled={!flow.canBuild} onClick={flow.build}>
          {flow.building ? 'Building' : 'Build'}
        </button>
        {!flow.color && <span className={muted}>Pick a color first.</span>}
        {flow.error && <span className="text-sm text-amber-600">{flow.error}</span>}
      </div>
    </div>
  );
}
