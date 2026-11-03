import { useState } from 'react';
import { COLORS, COLOR_LABELS, type DeckSize } from '@bulk-brew/core';
import {
  archetypeInfo,
  archetypeViability,
  buildableSizes,
  ConfirmDialog,
  Pip,
  Segmented,
  Stepper,
  scanShortfall,
  Toggle,
  ui,
  useStatus,
  type ScansBySize,
} from '@bulk-brew/ui';
import { useAppState } from '../app-context.ts';
import { PackGate } from '../screens.tsx';
import { DeckLayout, ExportMenu } from './DeckLayout.tsx';

const SIZES: { id: DeckSize; label: string }[] = [
  { id: 60, label: '60' },
  { id: 40, label: '40' },
  { id: 20, label: '20 Jumpstart' },
];

/** One line per size, in the voice of the design's 60-card line. */
function sizeLine(size: DeckSize, copies: number): string {
  const c = `Up to ${copies} ${copies === 1 ? 'copy' : 'copies'} of a card.`;
  if (size === 60) return `Casual constructed. ${c}`;
  if (size === 40) return `Draft-style limited deck. ${c}`;
  return `Jumpstart packet. Pair two for a 40-card game. ${c}`;
}

export function BuildScreen() {
  return (
    <PackGate>
      <Build />
    </PackGate>
  );
}

function Build() {
  const { build: flow } = useAppState();
  return flow.result ? <BuildResultView /> : <BuildForm />;
}

function sizesText(scans: ScansBySize | undefined, color: (typeof COLORS)[number]): string {
  if (!scans) return '';
  const sizes = buildableSizes(scans, color);
  return sizes.length ? sizes.join('/') : 'none';
}

function BuildForm() {
  const { build: flow, scans, config, settings } = useAppState();
  const colorName = flow.color ? COLOR_LABELS[flow.color] : undefined;
  const scan = flow.colorScan;
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
      : `Build ${flow.size}-card deck`;
  const sizes = flow.color && scans ? buildableSizes(scans, flow.color) : [];

  return (
    <div className="flex h-full flex-col overflow-y-auto md:flex-row md:overflow-hidden">
      <section className="flex shrink-0 flex-col gap-5 border-line bg-surface px-6 py-[22px] md:w-[400px] md:overflow-y-auto md:border-r">
        <h1 id="build-title" tabIndex={-1} className="text-[20px] font-semibold">
          Build
        </h1>
        {flow.accepted && (
          <p role="status" className={`${ui.error} leading-[1.5]`}>
            Saved &quot;{flow.accepted.name}&quot; and removed its cards from your bulk list. Build
            another from what is left.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <h2 className={ui.sectionLabel}>Deck size</h2>
          <Segmented
            label="Deck size"
            options={SIZES}
            value={flow.size}
            onChange={flow.setSize}
            full
          />
          <p className="text-[12px] text-fg-2">{sizeLine(flow.size, flow.maxCopies)}</p>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className={ui.sectionLabel}>Color</h2>
          <div role="group" aria-label="Color" className="grid grid-cols-5 gap-1.5">
            {COLORS.map((c) => {
              const s = flow.sizeScans?.[c];
              const can = s?.possible ?? false;
              const on = flow.color === c;
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  aria-disabled={!can}
                  title={can ? undefined : s?.notes.join('; ')}
                  onClick={() => {
                    if (can && !on) flow.setColor(c);
                  }}
                  className={`flex min-w-0 flex-col items-center gap-1 rounded-md border px-1 pt-2.5 pb-2 text-center ${
                    on ? 'border-ink bg-surface' : 'border-line'
                  } ${can ? (on ? '' : 'hover:bg-surface-2') : 'cursor-default opacity-55'}`}
                >
                  <Pip symbol={c} size={22} />
                  <span className="text-[12px] font-medium">{COLOR_LABELS[c]}</span>
                  <span className="text-[10.5px] leading-tight text-fg-2">
                    {s?.candidates ?? 0} · {can ? sizesText(scans, c) : `no ${flow.size}`}
                  </span>
                </button>
              );
            })}
          </div>
          {flow.color && scan && !scan.possible && (
            <p className="text-[12px] text-fg-2">
              {COLOR_LABELS[flow.color]} cannot build a {flow.size}-card deck:{' '}
              {scanShortfall(scan) ?? 'not enough cards'}.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h2 className={ui.sectionLabel}>Style</h2>
          {scan?.possible ? (
            <div role="radiogroup" aria-label="Style" className="rounded-md border border-line">
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
                      : capitalize(a.notes.join(', '))
                  }
                  state={state === 'viable' ? 'Viable' : 'Near miss'}
                  disabled={state !== 'viable'}
                  checked={flow.style === a.archetype}
                  onSelect={() => flow.setStyle(a.archetype)}
                />
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-fg-2">Pick a color to see the styles it can build.</p>
          )}
        </div>

        <label className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-[13px] text-fg-1">Unlimited basic lands</span>
            <span className="text-[11.5px] text-fg-2">
              Add basics freely instead of using the ones in your bulk list
            </span>
          </span>
          <Toggle
            label="Unlimited basic lands"
            checked={settings.settings.unlimitedBasics}
            disabled={!settings.loaded}
            onChange={(v) => settings.update({ unlimitedBasics: v })}
          />
        </label>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-fg-1">Max copies per card</span>
          <Stepper
            max={99}
            label="Max copies per card"
            value={flow.maxCopies}
            min={1}
            onChange={flow.setMaxCopies}
          />
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-[22px] mt-auto flex flex-col gap-2 border-t border-line bg-surface px-6 pt-3 pb-[22px]">
          {flow.error && <p className="text-[13px] text-ink">{flow.error}</p>}
          <button
            type="button"
            className={`${ui.primary} h-10 w-full text-[14px]`}
            disabled={!flow.canBuild}
            onClick={flow.build}
          >
            {label}
          </button>
        </div>
      </section>

      <div className="flex flex-1 flex-col items-center justify-center gap-1 p-8 text-center text-[13px] text-fg-2">
        <p>Your deck appears here.</p>
        <p>
          {!colorName || !scan
            ? 'Pick a size and a color to start.'
            : sizes.length === 3
              ? `${colorName} has ${scan.candidates} candidates and builds all three sizes.`
              : sizes.length > 0
                ? `${colorName} has ${scan.candidates} candidates and builds ${sizes.join(' and ')}.`
                : `${colorName} has ${scan.candidates} candidates, not enough for a deck yet.`}
        </p>
      </div>
    </div>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
      className={`grid grid-cols-[16px_1fr_auto] items-center gap-2.5 border-b border-surface-2 px-3 py-[9px] last:border-b-0 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-ink ${
        disabled ? 'opacity-55' : 'cursor-pointer hover:bg-surface-2'
      }`}
    >
      <input
        type="radio"
        name="style"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
      />
      <span
        aria-hidden
        className={`size-3.5 rounded-full border-[1.5px] border-ink ${checked ? 'bg-ink shadow-[inset_0_0_0_2px_var(--surface)]' : ''}`}
      />
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px] font-medium">{name}</span>
        <span className="text-[11.5px] text-fg-2">{description}</span>
      </span>
      <span className="text-[11px] text-fg-1">{state}</span>
    </label>
  );
}

/** The result view goes away after Accept or Reject; land on the form's heading. */
function focusForm() {
  requestAnimationFrame(() => document.getElementById('build-title')?.focus());
}

function BuildResultView() {
  const { build: flow, index } = useAppState();
  const [status, setStatus] = useStatus();
  const [confirm, setConfirm] = useState(false);
  const result = flow.result;
  if (!result || !index) return null;
  const deck = result.deck;
  const lands = result.explanation.lands.count;

  return (
    <>
      <DeckLayout
        deck={deck}
        meta={`${deck.size} cards · ${lands} lands · max ${flow.resultMaxCopies ?? flow.maxCopies} copies`}
        status={flow.error ?? status}
        actions={
          <>
            <button
              type="button"
              className={ui.primary}
              disabled={flow.building}
              onClick={() => setConfirm(true)}
            >
              Accept
            </button>
            <button
              type="button"
              className={ui.secondary}
              disabled={flow.building}
              onClick={() => {
                flow.reject();
                focusForm();
              }}
            >
              Reject
            </button>
            <ExportMenu deck={deck} onStatus={setStatus} label="Export ▾" />
          </>
        }
      />
      <ConfirmDialog
        open={confirm}
        title="Accept this deck?"
        message="This will save the deck and remove the cards from your bulk list."
        confirmLabel="Accept"
        cancelLabel="Decline"
        focus="confirm"
        onConfirm={() => {
          setConfirm(false);
          if (flow.accept()) focusForm();
        }}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}
