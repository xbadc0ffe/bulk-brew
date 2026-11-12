import { useState } from 'react';
import { COLORS, COLOR_LABELS, colorsLabel, RARITIES, type DeckSize } from '@bulk-brew/core';
import {
  archetypeInfo,
  archetypeViability,
  buildableSizes,
  ChoiceDialog,
  phone,
  Pip,
  RarityPicker,
  scanShortfall,
  Segmented,
  Stepper,
  Toggle,
  useStatus,
  viabilityDetail,
  viabilityLabel,
  type Viability,
} from '@bulk-brew/ui';
import { useAppState } from '../app-context.ts';
import { LargeTitle, ToggleRow } from '../parts.tsx';
import { PackGate } from '../screens.tsx';
import { DeckScreen } from './DeckView.tsx';

const SIZES: { id: DeckSize; label: string }[] = [
  { id: 60, label: '60' },
  { id: 40, label: '40' },
  { id: 20, label: '20' },
];

/** One line per size; the copy limit has its own stepper. */
function sizeLine(size: DeckSize): string {
  if (size === 60) return 'Casual constructed.';
  if (size === 40) return 'Draft-style limited deck.';
  return 'Jumpstart packet. Pair two for a 40-card game.';
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const STYLE_ORDER: Record<Viability, number> = { viable: 0, short: 1, near: 2, none: 3 };

export function BuildScreen() {
  const { build } = useAppState();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <LargeTitle title="Build" />
      <PackGate>
        <BuildForm />
        {build.result && <BuildResult />}
      </PackGate>
    </div>
  );
}

function BuildForm() {
  const { build: flow, scans, config, settings, index } = useAppState();
  // Schema 1 packs carry no rarity, so the filter cannot act until the data is refreshed.
  const rarityKnown = (index?.pack.schema ?? 2) >= 2;
  const scan = flow.colorScan;
  const colorName = flow.colors.length > 0 ? colorsLabel(flow.colors) : undefined;
  const styles = scan
    ? scan.archetypes
        .map((a) => ({ a, state: archetypeViability(a, scan, config) }))
        .filter((x) => x.state !== 'none')
        .sort((x, y) => STYLE_ORDER[x.state] - STYLE_ORDER[y.state])
    : [];
  const label = flow.building
    ? 'Building…'
    : colorName
      ? `Build ${flow.size}-card ${colorName.toLowerCase()} deck`
      : 'Pick a color';

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
        {flow.accepted && (
          <p role="status" className={phone.error}>
            {flow.accepted.committed
              ? `Saved "${flow.accepted.name}" and removed its cards from your bulk list.`
              : `Saved "${flow.accepted.name}". Its cards stay in your bulk list.`}
          </p>
        )}
        <p className={phone.note}>
          The phone layout builds the single strongest deck for your picks. The ranked list of deck
          options and 100-card Commander decks are on the desktop layout for now and come to phones
          next.
        </p>
        <section className="flex flex-col gap-2">
          <h2 className={phone.groupLabel}>Deck size</h2>
          <Segmented
            label="Deck size"
            options={SIZES}
            value={flow.size}
            onChange={flow.setSize}
            variant="phone"
          />
          <p className="text-[0.75rem] text-fg-2">{sizeLine(flow.size)}</p>
        </section>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[0.875rem] text-fg-1">Max copies per card</span>
          <Stepper
            max={99}
            label="Max copies per card"
            value={flow.maxCopies}
            min={1}
            onChange={flow.setMaxCopies}
            variant="phone"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-[0.875rem] text-fg-1">Rarities</span>
            <span className="text-[0.75rem] text-fg-2">
              {rarityKnown
                ? 'Unchecked rarities stay out of builds'
                : 'Takes effect with the next card data update'}
            </span>
          </span>
          <RarityPicker
            value={settings.settings.rarities ?? RARITIES}
            onChange={(rarities) => {
              settings.update({ rarities });
              flow.reject();
            }}
            buttonClassName="rounded-lg border border-line-strong bg-surface px-3 py-2 text-[0.875rem] whitespace-nowrap text-ink active:bg-surface-2"
          />
        </div>

        <div className={phone.group}>
          <ToggleRow
            label="Infinite basics"
            hint="Add basics freely instead of using the ones in your bulk list"
          >
            <Toggle
              label="Infinite basics"
              checked={settings.settings.unlimitedBasics}
              disabled={!settings.loaded}
              onChange={(v) => settings.update({ unlimitedBasics: v })}
              variant="phone"
            />
          </ToggleRow>
        </div>

        <section className="flex flex-col gap-2">
          <h2 className={phone.groupLabel}>Colors</h2>
          <div role="group" aria-label="Colors" className="grid grid-cols-5 gap-1.5">
            {COLORS.map((c) => {
              const s = flow.sizeScans?.[c];
              // Any color with cards of its own can join a set; the set's scan decides the rest.
              const can = (s?.colored ?? 0) > 0;
              const on = flow.colors.includes(c);
              const sizes = scans ? buildableSizes(scans, c) : [];
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  aria-disabled={!can}
                  aria-label={`${COLOR_LABELS[c]}, ${s?.candidates ?? 0} candidates, ${sizes.length > 0 ? `builds ${sizes.join(', ')}` : 'builds no size alone'}`}
                  onClick={() => {
                    if (!can && !on) return;
                    // The phone form lists only styles the colors can build, so a color change clears the style.
                    flow.toggleColor(c);
                    flow.setStyle(undefined);
                  }}
                  className={`flex min-w-0 flex-col items-center gap-1 rounded-lg border px-0.5 pt-2.5 pb-2 ${
                    on ? 'border-ink bg-surface' : 'border-line'
                  } ${can ? '' : 'opacity-55'}`}
                >
                  <Pip symbol={c} size={24} />
                  <span aria-hidden className="text-[0.6875rem] leading-tight text-fg-2">
                    {s?.candidates ?? 0}
                    <br />
                    {can ? sizes.join('/') : `no ${flow.size}`}
                  </span>
                </button>
              );
            })}
          </div>
          {colorName && scan && !scan.possible && (
            <p className="text-[0.75rem] text-fg-2">
              {colorName} cannot build a {flow.size}-card deck:{' '}
              {scanShortfall(scan) ?? 'not enough cards'}.
            </p>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className={phone.groupLabel}>Archetype</h2>
          {scan?.possible ? (
            <div role="radiogroup" aria-label="Archetype" className={phone.group}>
              <StyleRow
                name="Best fit"
                description="Let the builder pick the strongest archetype"
                checked={flow.style === undefined}
                onSelect={() => flow.setStyle(undefined)}
              />
              {styles.map(({ a, state }) => (
                <StyleRow
                  key={a.archetype}
                  name={a.label}
                  description={
                    state === 'viable'
                      ? archetypeInfo(config, a.archetype).description
                      : state === 'short'
                        ? viabilityDetail(a, scan, state)
                        : cap(a.notes.join(', '))
                  }
                  state={viabilityLabel(state)}
                  // A short style builds the nearest deck with a note; a near miss cannot be built.
                  disabled={state === 'near'}
                  checked={flow.style === a.archetype}
                  onSelect={() => flow.setStyle(a.archetype)}
                />
              ))}
            </div>
          ) : (
            <p className={phone.note}>Pick a color to see the styles it can build.</p>
          )}
        </section>
        {flow.error && <p className="text-[0.8125rem] text-ink">{flow.error}</p>}
      </div>
      <div className="shrink-0 px-4 pt-2 pb-2.5">
        <button
          type="button"
          className={phone.primary}
          disabled={!flow.canBuild}
          onClick={flow.build}
        >
          {label}
        </button>
      </div>
    </>
  );
}

function StyleRow(props: {
  name: string;
  description: string;
  state?: string;
  checked: boolean;
  disabled?: boolean;
  onSelect(): void;
}) {
  const { name, description, state, checked, disabled, onSelect } = props;
  return (
    <label
      className={`flex min-h-11 items-center gap-2.5 border-b-1 border-surface-2 px-3 py-2 last:border-b-0 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-ink ${
        disabled ? 'opacity-55' : 'active:bg-surface-2'
      }`}
    >
      <input
        type="radio"
        name="style"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
      />
      <span
        aria-hidden
        className={`size-4 shrink-0 rounded-full border-[1.5px] border-ink ${checked ? 'bg-ink shadow-[inset_0_0_0_2.5px_var(--surface)]' : ''}`}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[0.875rem] font-medium">{name}</span>
        <span className="text-[0.75rem] text-fg-2">{description}</span>
      </span>
      {state && <span className="shrink-0 text-[0.6875rem] text-fg-1">{state}</span>}
    </label>
  );
}

function BuildResult() {
  const { build: flow, config } = useAppState();
  const [status, setStatus] = useStatus();
  const [confirm, setConfirm] = useState(false);
  const result = flow.result;
  if (!result) return null;
  const deck = result.deck;
  return (
    <>
      <DeckScreen
        deck={deck}
        back={{ label: 'Build', onClick: flow.reject }}
        chips={[
          `${deck.size} cards`,
          `${result.explanation.lands.count} lands`,
          archetypeInfo(config, deck.archetype).label,
        ]}
        actions={[]}
        status={flow.error ?? status}
        onStatus={setStatus}
        bottom={
          <div className="grid grid-cols-[1fr_1.4fr] gap-2">
            <button
              type="button"
              className={phone.secondary}
              disabled={flow.building}
              onClick={flow.reject}
            >
              Reject
            </button>
            <button
              type="button"
              className={phone.primary}
              disabled={flow.building}
              onClick={() => setConfirm(true)}
            >
              Accept
            </button>
          </div>
        }
      />
      <ChoiceDialog
        open={confirm}
        title="Accept this deck?"
        message="Save the deck to Decks. Its cards can leave your bulk list now or stay there."
        variant="phone"
        choices={[
          {
            label: 'Confirm',
            detail: 'Remove cards from bulk list',
            tone: 'go',
            onSelect: () => {
              setConfirm(false);
              flow.accept(true);
            },
          },
          {
            label: 'Confirm',
            detail: 'Keep cards in bulk list',
            tone: 'go-soft',
            onSelect: () => {
              setConfirm(false);
              flow.accept(false);
            },
          },
          { label: 'Decline', tone: 'stop', onSelect: () => setConfirm(false) },
        ]}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}
