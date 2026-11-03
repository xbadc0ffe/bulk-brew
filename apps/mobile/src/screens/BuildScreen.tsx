import { useEffect, useRef } from 'react';
import { COLORS, COLOR_LABELS, type DeckSize } from '@bulk-brew/core';
import { DeckView } from '@bulk-brew/ui';
import { useAppState } from '../app-context.ts';

const button =
  'rounded border border-zinc-300 bg-white px-3 py-2 text-sm active:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900';
const primary =
  'w-full rounded bg-zinc-900 px-4 py-3 text-base text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900';
const muted = 'text-sm text-zinc-600 dark:text-zinc-400';
const selected = 'ring-2 ring-zinc-500';

const SIZES: { size: DeckSize; label: string }[] = [
  { size: 60, label: '60' },
  { size: 40, label: '40' },
  { size: 20, label: '20 packet' },
];

function BuildForm() {
  const { build: flow } = useAppState();
  const styleSection = useRef<HTMLElement>(null);

  useEffect(() => {
    if (flow.styleFocusRequest === 0 || flow.result) return;
    const section = styleSection.current;
    if (!section) return;
    section.scrollIntoView({ block: 'start' });
    section.querySelector<HTMLInputElement>('input[type=radio]')?.focus();
  }, [flow.styleFocusRequest, flow.result]);

  return (
    <div className="flex flex-col gap-4">
      {flow.accepted && (
        <p className="rounded border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          Saved "{flow.accepted.name}" and removed its cards from the pool.
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Size</h2>
        <div className="flex gap-2">
          {SIZES.map((s) => (
            <button
              key={s.size}
              type="button"
              className={`${button} flex-1 ${flow.size === s.size ? selected : ''}`}
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
                onClick={() => flow.setColor(c)}
              >
                {COLOR_LABELS[c]} <span className="text-zinc-500">{scan?.candidates ?? 0}</span>
              </button>
            );
          })}
        </div>
      </section>

      {flow.colorScan && (
        <section ref={styleSection} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Style</h2>
          <label className="flex items-center gap-2 py-1 text-sm">
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
              className={`flex items-start gap-2 py-1 text-sm ${a.viable ? '' : 'text-zinc-500'}`}
            >
              <input
                type="radio"
                name="style"
                className="mt-1"
                checked={flow.style === a.archetype}
                disabled={!a.viable}
                onChange={() => flow.setStyle(a.archetype)}
              />
              <span>
                {a.label}
                <span className="block text-xs text-zinc-500">
                  {a.kind === 'synergy'
                    ? `${a.enablers.have} enablers, ${a.payoffs.have} payoffs`
                    : `${a.enablers.have} spells`}
                  {a.notes.length > 0 && `, ${a.notes.join('; ')}`}
                </span>
              </span>
            </label>
          ))}
        </section>
      )}

      <button type="button" className={primary} disabled={!flow.canBuild} onClick={flow.build}>
        {flow.building ? 'Building' : 'Build'}
      </button>
      {!flow.color && <p className={muted}>Pick a color first.</p>}
      {flow.error && <p className="text-sm text-amber-600">{flow.error}</p>}
    </div>
  );
}

export function BuildScreen() {
  const { index, config, pack, build: flow, settings, detail } = useAppState();

  if (pack.status === 'error') {
    return <p className="text-sm text-amber-600">Card data failed to load: {pack.error}</p>;
  }
  if (pack.status !== 'ready' || !index) return <p className={muted}>Loading card data.</p>;

  const result = flow.result ? (
    <DeckView
      deck={flow.result.deck}
      index={index}
      config={config}
      mode="fresh"
      showArt={settings.settings.showArt}
      onOpenCard={detail.open}
      onAccept={flow.accept}
      onTryAnotherStyle={flow.tryAnotherStyle}
      onDiscard={flow.discard}
    />
  ) : undefined;

  // Phones show either the form or the result; tablets show both side by side.
  return (
    <div className="md:grid md:grid-cols-[minmax(16rem,1fr)_2fr] md:gap-6">
      <div className={result ? 'hidden md:block' : ''}>
        <BuildForm />
      </div>
      <div className={result ? '' : 'hidden md:block'}>
        {result ?? <p className={muted}>Pick a size and a color, then build to see a deck here.</p>}
      </div>
    </div>
  );
}
