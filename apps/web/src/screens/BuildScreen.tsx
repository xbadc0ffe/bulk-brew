import { useEffect, useState } from 'react';
import {
  COLORS,
  COLOR_LABELS,
  colorsLabel,
  RARITIES,
  type DeckSize,
  type ScanReport,
} from '@bulk-brew/core';
import {
  archetypeViability,
  ConfirmDialog,
  Dropdown,
  Pip,
  RarityPicker,
  Segmented,
  Stepper,
  scanShortfall,
  Toggle,
  ui,
  useStatus,
} from '@bulk-brew/ui';
import { useAppState } from '../app-context.ts';
import { PackGate } from '../screens.tsx';
import { OptionsPanel } from './BuildOptions.tsx';
import { DeckLayout, ExportMenu } from './DeckLayout.tsx';

const SIZES: { id: DeckSize; label: string }[] = [
  { id: 60, label: '60' },
  { id: 40, label: '40' },
  { id: 20, label: '20' },
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
  const { build: flow, setBuildVisible } = useAppState();
  // Options build only while this screen shows.
  useEffect(() => {
    setBuildVisible(true);
    return () => setBuildVisible(false);
  }, [setBuildVisible]);
  return flow.result ? <BuildResultView /> : <BuildForm />;
}

function BuildForm() {
  const { build: flow, config, settings, index, options } = useAppState();
  // Schema 1 packs carry no rarity, so the filter cannot act until the data is refreshed.
  const rarityKnown = (index?.pack.schema ?? 2) >= 2;
  const colorName = flow.colors.length > 0 ? colorsLabel(flow.colors) : undefined;
  const scan = flow.colorScan;
  const choices = styleChoices(config, options.scans);

  return (
    <div className="flex h-full flex-col overflow-y-auto md:flex-row md:overflow-hidden">
      <section className="flex shrink-0 flex-col gap-5 border-line bg-surface px-6 py-[22px] md:w-[400px] md:overflow-y-auto md:border-r">
        <h1 id="build-title" tabIndex={-1} className="text-[20px] font-semibold">
          Build
        </h1>
        {flow.accepted && (
          <p role="status" className={ui.error}>
            Saved &quot;{flow.accepted.name}&quot; and removed its cards from your bulk list. The
            deck options are rebuilt from what is left.
          </p>
        )}
        {flow.error && <p className={ui.error}>{flow.error}</p>}

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

        <div className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-[13px] text-fg-1">Rarities</span>
            <span className="text-[11.5px] text-fg-2">
              {rarityKnown
                ? 'Unchecked rarities stay out of builds'
                : 'Takes effect with the next card data update'}
            </span>
          </span>
          <RarityPicker
            value={settings.settings.rarities ?? RARITIES}
            onChange={(rarities) => settings.update({ rarities })}
            buttonClassName={`${ui.secondary} whitespace-nowrap`}
          />
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

        <div className="flex flex-col gap-2">
          <h2 className={ui.sectionLabel}>Colors</h2>
          <div role="group" aria-label="Colors" className="grid grid-cols-5 gap-1.5">
            {COLORS.map((c) => {
              const s = flow.sizeScans?.[c];
              // Any color with cards of its own can join a set; the set's scan decides the rest.
              const can = (s?.colored ?? 0) > 0;
              const on = flow.colors.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  aria-disabled={!can && !on}
                  title={
                    can ? undefined : `No ${COLOR_LABELS[c].toLowerCase()} cards in your bulk list`
                  }
                  onClick={() => {
                    if (can || on) flow.toggleColor(c);
                  }}
                  className={`flex min-w-0 flex-col items-center gap-1 rounded-md border px-1 pt-2.5 pb-2 text-center ${
                    on ? 'border-ink bg-surface' : 'border-line'
                  } ${can || on ? (on ? '' : 'hover:bg-surface-2') : 'cursor-default opacity-55'}`}
                >
                  <Pip symbol={c} size={22} />
                  <span className="text-[12px] font-medium">{COLOR_LABELS[c]}</span>
                  <span className="text-[10.5px] leading-tight text-fg-2">
                    {s?.colored ?? 0} cards
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[12px] text-fg-2">
            {colorName
              ? scan && !scan.possible && flow.colors.length > 1
                ? `${colorName} together falls short (${scanShortfall(scan) ?? 'not enough cards'}); options use fewer of these colors.`
                : `Options use ${flow.colors.length > 1 ? 'any of these colors' : 'this color'}.`
              : 'Pick one or more colors. Options can use any of them.'}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className={ui.sectionLabel}>Primary style</h2>
          <StylePicker
            label="Primary style"
            value={flow.style}
            emptyLabel="Best fit"
            emptyDescription="Show the strongest decks of any style"
            choices={choices}
            disabled={flow.colors.length === 0}
            onChange={flow.setStyle}
          />
          <h2 className={`${ui.sectionLabel} mt-2`}>Secondary style</h2>
          {flow.style ? (
            <p className="text-[12px] text-fg-2">Secondary styles arrive with the next update.</p>
          ) : (
            <p className="text-[12px] text-fg-2">Pick a primary style first.</p>
          )}
        </div>
      </section>

      <OptionsPanel
        options={options}
        onClear={() => {
          flow.clearChoices();
          requestAnimationFrame(() => document.getElementById('build-title')?.focus());
        }}
      />
    </div>
  );
}

interface StyleChoice {
  id: string;
  label: string;
  description: string;
  state: 'viable' | 'near';
}

/**
 * Styles worth offering for the picked colors: the best viability any subset
 * of them reaches, viable first. Near misses show what they lack and cannot
 * be picked, as on the old form.
 */
function styleChoices(
  config: ReturnType<typeof useAppState>['config'],
  scans: ReadonlyMap<string, ScanReport>,
): StyleChoice[] {
  const out: StyleChoice[] = [];
  for (const a of config.archetypes.archetypes) {
    let best: StyleChoice | undefined;
    for (const scan of scans.values()) {
      const report = scan.archetypes.find((r) => r.archetype === a.id);
      if (!report) continue;
      const state = archetypeViability(report, scan);
      if (state === 'viable') {
        best = { id: a.id, label: a.label, description: a.description, state };
        break;
      }
      if (state === 'near' && !best) {
        best = {
          id: a.id,
          label: a.label,
          description: capitalize(report.notes.join(', ')),
          state,
        };
      }
    }
    if (best) out.push(best);
  }
  return out.sort((x, y) => (x.state === y.state ? 0 : x.state === 'viable' ? -1 : 1));
}

function StylePicker(props: {
  label: string;
  value: string | undefined;
  emptyLabel: string;
  emptyDescription: string;
  choices: StyleChoice[];
  disabled?: boolean;
  onChange(id: string | undefined): void;
}) {
  const { label, value, emptyLabel, emptyDescription, choices, disabled, onChange } = props;
  const { config } = useAppState();
  // A picked style stays shown even when the current colors cannot build it.
  const current = choices.find((c) => c.id === value);
  const picked = value ? config.archetypes.archetypes.find((a) => a.id === value) : undefined;
  const shown = current?.label ?? (picked ? `${picked.label} (not available)` : emptyLabel);
  if (disabled) {
    return (
      <button
        type="button"
        disabled
        aria-label={`${label}: ${shown}`}
        className={`${ui.secondary} justify-between`}
      >
        {shown} <span aria-hidden>▾</span>
      </button>
    );
  }
  return (
    <Dropdown
      label={`${shown} ▾`}
      ariaLabel={`${label}: ${shown}`}
      buttonClassName={`${ui.secondary} w-full justify-between`}
    >
      {(close) => (
        <div role="menu" aria-label={label} className="flex w-[340px] flex-col">
          <StyleItem
            name={emptyLabel}
            description={emptyDescription}
            checked={value === undefined}
            onSelect={() => {
              close();
              onChange(undefined);
            }}
          />
          {choices.map((c) => (
            <StyleItem
              key={c.id}
              name={c.label}
              description={c.description}
              state={c.state === 'viable' ? 'Viable' : 'Near miss'}
              checked={value === c.id}
              disabled={c.state !== 'viable'}
              onSelect={() => {
                close();
                onChange(c.id);
              }}
            />
          ))}
        </div>
      )}
    </Dropdown>
  );
}

function StyleItem(props: {
  name: string;
  description: string;
  state?: string;
  checked: boolean;
  disabled?: boolean;
  onSelect(): void;
}) {
  const { name, description, state, checked, disabled, onSelect } = props;
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onSelect}
      className={`grid grid-cols-[1fr_auto] items-center gap-2.5 rounded px-2.5 py-2 text-left ${
        disabled ? 'cursor-default opacity-55' : 'hover:bg-surface-2'
      } ${checked ? 'bg-surface-2' : ''}`}
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px] font-medium">{name}</span>
        <span className="text-[11.5px] whitespace-normal text-fg-2">{description}</span>
      </span>
      <span className="text-[11px] text-fg-1">{state}</span>
    </button>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The deck view goes away after Accept or Back; land on the options' heading, or the form's. */
function focusForm() {
  requestAnimationFrame(() =>
    (document.getElementById('options-title') ?? document.getElementById('build-title'))?.focus(),
  );
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
              Back to options
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
