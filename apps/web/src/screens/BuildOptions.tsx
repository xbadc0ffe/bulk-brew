import { COLOR_LABELS, colorsLabel, normalizeColors, type DeckOption } from '@bulk-brew/core';
import { archetypeInfo, Pip, ui, type DeckOptions } from '@bulk-brew/ui';
import { useAppState } from '../app-context.ts';

/** The right side of the Build page: ranked deck options, built as you watch. */
export function OptionsPanel(props: { options: DeckOptions; onClear(): void }) {
  const { options, onClear } = props;
  const { build: flow } = useAppState();

  if (flow.colors.length === 0) {
    return (
      <Centered>
        <p>Pick one or more colors to see deck options.</p>
        <p>Options use any of the colors you pick, ranked by how strong they look.</p>
      </Centered>
    );
  }
  if (options.primaryUnavailable) {
    return (
      <Centered>
        <p className="text-ink">No decks meet these settings.</p>
        <p>None of the picked colors can build the picked primary style.</p>
        <button type="button" className={`${ui.secondary} mt-2`} onClick={onClear}>
          Clear settings
        </button>
      </Centered>
    );
  }
  if (options.error) {
    return (
      <Centered>
        <p className="text-ink">Building deck options failed.</p>
        <p>{options.error}</p>
      </Centered>
    );
  }
  if (!options.working && options.options.length === 0) {
    return (
      <Centered>
        <p className="text-ink">No decks meet these settings.</p>
        <p>The picked colors do not have enough cards for this deck size.</p>
        <button type="button" className={`${ui.secondary} mt-2`} onClick={onClear}>
          Clear settings
        </button>
      </Centered>
    );
  }

  return (
    <div className="flex flex-col md:min-h-0 md:flex-1">
      <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-3">
        <h2 id="options-title" tabIndex={-1} className="text-[15px] font-semibold">
          Deck options
        </h2>
        <p className="flex items-center gap-2 text-[12px] text-fg-2">
          {options.working && <Spinner />}
          <span aria-hidden={options.working}>
            {options.working
              ? `Building options, ${options.built} of ${options.planned}`
              : `${options.options.length} option${options.options.length === 1 ? '' : 's'}, strongest first`}
          </span>
        </p>
        {/* Announce once the list settles, not on every build. */}
        <span className="sr-only" aria-live="polite">
          {options.working ? '' : `${options.options.length} deck options ready.`}
        </span>
      </div>
      <ul className="grid auto-rows-min grid-cols-1 gap-3 p-6 md:min-h-0 md:flex-1 md:overflow-y-auto lg:grid-cols-2">
        {options.options.map((o) => (
          <li key={o.key}>
            <OptionCard option={o} onOpen={() => flow.open(o.result)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 p-8 text-center text-[13px] text-fg-2">
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block size-3.5 animate-spin rounded-full border-2 border-line-strong border-t-ink"
    />
  );
}

function OptionCard({ option, onOpen }: { option: DeckOption; onOpen(): void }) {
  const { config, build: flow } = useAppState();
  const { deck, explanation } = option.result;
  const colors = normalizeColors(deck.colors ?? [deck.color]);
  const style = archetypeInfo(config, deck.archetype);
  const score = Math.round(explanation.score?.total ?? 0);
  const spells = explanation.curve.reduce((n, t) => n + t, 0);
  const missing = flow.colors.filter((c) => !colors.includes(c));
  const synergy = explanation.synergies[0];
  const stretched = explanation.notes.find((n) => n.includes('is stretched'));
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${colorsLabel(colors)} ${style.label}, strength ${score}${missing.length > 0 ? `, leaves out ${missing.map((c) => COLOR_LABELS[c].toLowerCase()).join(' and ')}` : ''}${stretched ? ', mana is stretched' : ''}`}
      className="flex w-full flex-col gap-3 rounded-lg border border-line bg-surface p-4 text-left hover:border-line-strong hover:bg-surface-2"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-1">
            {colors.map((c) => (
              <Pip key={c} symbol={c} size={18} />
            ))}
          </span>
          <span className="text-[15px] font-semibold">
            {colorsLabel(colors)} {style.label}
          </span>
          <span className="text-[12px] text-fg-2">{style.description}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="text-[20px] font-semibold tabular-nums">{score}</span>
          <span className="text-[11px] text-fg-2">strength</span>
        </span>
      </span>
      <span className="h-1.5 w-full overflow-hidden rounded bg-surface-2" aria-hidden>
        <span className="block h-full rounded bg-ink" style={{ width: `${Math.max(4, score)}%` }} />
      </span>
      <MiniCurve curve={explanation.curve} />
      <span className="flex flex-wrap gap-1.5">
        <span className={ui.tag}>
          {spells} spells, {explanation.lands.count} lands
        </span>
        {missing.length > 0 && (
          <span className={ui.tag}>
            Leaves out {missing.map((c) => COLOR_LABELS[c].toLowerCase()).join(' and ')}
          </span>
        )}
        {stretched && <span className={ui.tag}>Mana is stretched</span>}
      </span>
      {synergy && <span className="text-[12px] text-fg-1">{synergy}</span>}
    </button>
  );
}

/** A small mana curve: one bar per mana value, 1 through 6 and up (zero folds into 1). */
function MiniCurve({ curve }: { curve: number[] }) {
  const buckets = [
    (curve[0] ?? 0) + (curve[1] ?? 0),
    curve[2] ?? 0,
    curve[3] ?? 0,
    curve[4] ?? 0,
    curve[5] ?? 0,
    (curve[6] ?? 0) + (curve[7] ?? 0),
  ];
  const max = Math.max(1, ...buckets);
  const label = buckets.map((n, i) => `${n} at ${i === 5 ? '6 or more' : i + 1}`).join(', ');
  return (
    <span className="flex items-end gap-1" role="img" aria-label={`Mana curve: ${label}`}>
      {buckets.map((n, i) => (
        <span key={i} className="flex flex-1 flex-col items-center gap-0.5">
          <span className="flex h-8 w-full items-end">
            <span
              className="block w-full rounded-t-[2px] bg-fg-3"
              style={{ height: `${Math.max(2, (n / max) * 100)}%` }}
            />
          </span>
          <span className="text-[10px] text-fg-2 tabular-nums">{i === 5 ? '6+' : i + 1}</span>
        </span>
      ))}
    </span>
  );
}
