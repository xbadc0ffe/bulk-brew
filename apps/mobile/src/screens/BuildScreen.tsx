import { useState } from 'react';
import { COLORS, COLOR_LABELS, RARITIES, type DeckSize } from '@bulk-brew/core';
import {
  archetypeInfo,
  archetypeViability,
  buildableSizes,
  ConfirmDialog,
  phone,
  Pip,
  RarityPicker,
  scanShortfall,
  Segmented,
  Stepper,
  Toggle,
  useStatus,
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

function sizeLine(size: DeckSize, copies: number): string {
  const c = `Up to ${copies} ${copies === 1 ? 'copy' : 'copies'}.`;
  if (size === 60) return `Casual constructed. ${c}`;
  if (size === 40) return `Draft-style limited deck. ${c}`;
  return `Jumpstart packet. Pair two for a 40-card game. ${c}`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
  const colorName = flow.color ? COLOR_LABELS[flow.color] : undefined;
  const styles = scan
    ? scan.archetypes
        .map((a) => ({ a, state: archetypeViability(a, scan) }))
        .filter((x) => x.state !== 'none')
        .sort((x, y) => (x.state === y.state ? 0 : x.state === 'viable' ? -1 : 1))
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
            Saved &quot;{flow.accepted.name}&quot; and removed its cards from your bulk list.
          </p>
        )}
        <section className="flex flex-col gap-2">
          <h2 className={phone.groupLabel}>Deck size</h2>
          <Segmented
            label="Deck size"
            options={SIZES}
            value={flow.size}
            onChange={flow.setSize}
            variant="phone"
          />
          <p className="text-[0.75rem] text-fg-2">{sizeLine(flow.size, flow.maxCopies)}</p>
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
            label="Unlimited basic lands"
            hint="Add basics freely instead of using the ones in your bulk list"
          >
            <Toggle
              label="Unlimited basic lands"
              checked={settings.settings.unlimitedBasics}
              disabled={!settings.loaded}
              onChange={(v) => settings.update({ unlimitedBasics: v })}
              variant="phone"
            />
          </ToggleRow>
        </div>

        <section className="flex flex-col gap-2">
          <h2 className={phone.groupLabel}>Color</h2>
          <div role="group" aria-label="Color" className="grid grid-cols-5 gap-1.5">
            {COLORS.map((c) => {
              const s = flow.sizeScans?.[c];
              const can = s?.possible ?? false;
              const on = flow.color === c;
              const sizes = scans ? buildableSizes(scans, c) : [];
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  aria-disabled={!can}
                  aria-label={`${COLOR_LABELS[c]}, ${s?.candidates ?? 0} candidates, ${can ? `builds ${sizes.join(', ')}` : `cannot build ${flow.size}`}`}
                  onClick={() => {
                    if (can && !on) flow.setColor(c);
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
          {flow.color && scan && !scan.possible && (
            <p className="text-[0.75rem] text-fg-2">
              {COLOR_LABELS[flow.color]} cannot build a {flow.size}-card deck:{' '}
              {scanShortfall(scan) ?? 'not enough cards'}.
            </p>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className={phone.groupLabel}>Style</h2>
          {scan?.possible ? (
            <div role="radiogroup" aria-label="Style" className={phone.group}>
              <StyleRow
                name="Best fit"
                description="Let the builder pick the strongest style"
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
                      : cap(a.notes.join(', '))
                  }
                  state={state === 'viable' ? 'Viable' : 'Near miss'}
                  disabled={state !== 'viable'}
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
      className={`flex min-h-11 items-center gap-2.5 border-b border-surface-2 px-3 py-2 last:border-b-0 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-ink ${
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
      <ConfirmDialog
        open={confirm}
        title="Accept this deck?"
        message="This will save the deck and remove the cards from your bulk list."
        confirmLabel="Accept"
        cancelLabel="Decline"
        focus="confirm"
        variant="phone"
        onConfirm={() => {
          setConfirm(false);
          flow.accept();
        }}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}
