import { useEffect, useState, type ReactNode } from 'react';
import {
  COLORS,
  COLOR_LABELS,
  colorsLabel,
  commanderSuits,
  filterCommanders,
  RARITIES,
  secondaryChoices,
  secondaryLabel,
  type Color,
  type CommanderCandidate,
  type DeckSize,
  type ScanReport,
} from '@bulk-brew/core';
import {
  archetypeViability,
  ChoiceDialog,
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
  { id: 100, label: '100' },
  { id: 60, label: '60' },
  { id: 40, label: '40' },
  { id: 20, label: '20' },
];

/** One line per size. The copy limit has its own control below, so it is not repeated here. */
function sizeLine(size: DeckSize): string {
  if (size === 100) return 'Commander. One commander plus 99 cards.';
  if (size === 60) return 'Casual constructed.';
  if (size === 40) return 'Draft-style limited deck.';
  return 'Jumpstart packet. Pair two for a 40-card game.';
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
  const { build: flow, config, settings, index, options, commanders } = useAppState();
  // Schema 1 packs carry no rarity, so the filter cannot act until the data is refreshed.
  const rarityKnown = (index?.pack.schema ?? 2) >= 2;
  const colorName = flow.colors.length > 0 ? colorsLabel(flow.colors) : undefined;
  const scan = flow.colorScan;
  // At 100, colors and styles filter the commander list; with a commander picked,
  // changing one returns to that list, so the pickers offer its choices: the
  // commanders within the colors picked before the commander.
  const listing = flow.size === 100 && !flow.commander;
  const commanderMode = flow.size === 100;
  const listed =
    flow.commander && commanders.list
      ? filterCommanders(commanders.list, flow.pickedColors, undefined, config)
      : commanders.inColors;
  const styleScans = commanderMode ? colorScans(listed, commanders.scans) : options.scans;
  const choices = commanderMode
    ? commanderStyleChoices(config, listed, commanders.scans)
    : styleChoices(config, options.scans);
  // Say so when a changed setting drops the commander and the list comes back.
  const [seenCommander, setSeenCommander] = useState(flow.commander);
  const [notice, setNotice] = useState('');
  if (flow.commander !== seenCommander) {
    setSeenCommander(flow.commander);
    setNotice(seenCommander && !flow.commander ? 'Back to the commander list.' : '');
  }
  // A setting changed under a picked commander returns to the commander list, as Change Commander does.
  const leaveCommander = () => {
    if (flow.commander) flow.setCommander(undefined);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto md:flex-row md:overflow-hidden">
      <section className="flex shrink-0 flex-col gap-5 border-line bg-surface px-6 py-[22px] md:w-[400px] md:overflow-y-auto md:border-r">
        <h1 id="build-title" tabIndex={-1} className="text-[20px] font-semibold">
          Build
        </h1>
        {flow.accepted && (
          <p role="status" className={ui.error}>
            {flow.accepted.committed
              ? `Saved "${flow.accepted.name}" and removed its cards from your bulk list. The deck options are rebuilt from what is left.`
              : `Saved "${flow.accepted.name}". Its cards stay in your bulk list; accept it from Decks to remove them.`}
          </p>
        )}
        {flow.error && <p className={ui.error}>{flow.error}</p>}
        <span className="sr-only" aria-live="polite">
          {notice}
        </span>

        <div className="flex flex-col gap-2">
          <h2 className={ui.sectionLabel}>Deck size</h2>
          <Segmented
            label="Deck size"
            options={SIZES}
            value={flow.size}
            onChange={flow.setSize}
            full
          />
          <p className="text-[12px] text-fg-2">{sizeLine(flow.size)}</p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className={ui.label}>Rarities</span>
            <span className={ui.hint}>
              {rarityKnown
                ? 'Unchecked rarities stay out of builds'
                : 'Takes effect with the next card data update'}
            </span>
          </span>
          <RarityPicker
            value={settings.settings.rarities ?? RARITIES}
            onChange={(rarities) => {
              leaveCommander();
              settings.update({ rarities });
            }}
            buttonClassName={`${ui.secondary} whitespace-nowrap`}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className={ui.label}>Max copies per card</span>
          {/* Commander allows one of each card, so the stepper holds at 1. */}
          <Stepper
            label="Max copies per card"
            value={flow.size === 100 ? 1 : flow.maxCopies}
            min={1}
            max={flow.size === 100 ? 1 : 99}
            onChange={flow.setMaxCopies}
          />
        </div>

        <label className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className={ui.label}>Infinite basics</span>
            <span className={ui.hint}>Basic lands do not come from your bulk list</span>
          </span>
          <Toggle
            label="Infinite basics"
            checked={settings.settings.unlimitedBasics}
            disabled={!settings.loaded}
            onChange={(v) => {
              leaveCommander();
              settings.update({ unlimitedBasics: v });
            }}
          />
        </label>

        {flow.size === 100 ? (
          <CommanderColors />
        ) : (
          <div className="flex flex-col gap-2">
            <h2 className={ui.sectionLabel}>Colors</h2>
            <div role="group" aria-label="Colors" className="grid grid-cols-5 gap-1.5">
              {COLORS.map((c) => {
                const s = flow.sizeScans?.[c];
                // Any color with cards of its own can join a set; the set's scan decides the rest.
                const can = (s?.colored ?? 0) > 0;
                return (
                  <ColorToggle
                    key={c}
                    color={c}
                    on={flow.colors.includes(c)}
                    can={can}
                    count={`${s?.colored ?? 0} cards`}
                    title={
                      can
                        ? undefined
                        : `No ${COLOR_LABELS[c].toLowerCase()} cards in your bulk list`
                    }
                    onToggle={() => flow.toggleColor(c)}
                  />
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
        )}

        <div className="flex flex-col gap-2">
          <h2 className={ui.sectionLabel}>Primary archetype</h2>
          <StylePicker
            label="Primary archetype"
            value={flow.style}
            emptyLabel="Best fit"
            emptyDescription={
              commanderMode
                ? 'Show every commander, most promising first'
                : 'Show the strongest decks of any archetype'
            }
            choices={choices}
            disabled={commanderMode ? !commanders.list : flow.colors.length === 0}
            onChange={flow.setStyle}
          />
          {listing && flow.style && (
            <p className="text-[12px] text-fg-2">
              Commanders that can build it move to the top as each one is checked.
            </p>
          )}
          <h2 className={`${ui.sectionLabel} mt-2`}>Secondary archetype</h2>
          {flow.style ? (
            <StylePicker
              label="Secondary archetype"
              value={flow.secondary}
              emptyLabel="None"
              emptyDescription="Build around the primary archetype alone"
              choices={secondaryStyleChoices(config, styleScans, flow.style)}
              onChange={flow.setSecondary}
            />
          ) : (
            <p className="text-[12px] text-fg-2">Pick a primary archetype first.</p>
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

/** One color button: its symbol, name, and a count below. */
function ColorToggle(props: {
  color: Color;
  on: boolean;
  /** Whether it can be picked; a picked color can always be dropped. */
  can: boolean;
  count: ReactNode;
  title: string | undefined;
  onToggle(): void;
}) {
  const { color, on, can, count, title, onToggle } = props;
  const active = can || on;
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-disabled={!active}
      title={title}
      onClick={() => {
        if (active) onToggle();
      }}
      className={`flex min-w-0 flex-col items-center gap-1 rounded-md border px-1 pt-2.5 pb-2 text-center ${
        on ? 'border-ink bg-surface' : 'border-line'
      } ${active ? (on ? '' : 'hover:bg-surface-2') : on ? 'cursor-default' : 'cursor-default opacity-55'}`}
    >
      <Pip symbol={color} size={22} />
      <span className="text-[12px] font-semibold">{COLOR_LABELS[color]}</span>
      <span className="text-[10.5px] leading-tight text-fg-2">{count}</span>
    </button>
  );
}

const COUNT_WORDS = ['', 'one', 'both', 'all three', 'all four', 'all five'];

/**
 * Commander colors: before a commander is picked, the buttons filter the
 * commander list (a commander shows when every one of its colors is picked);
 * once one is picked, they show its colors, and changing one returns to the
 * list with the colors on screen as the filter.
 */
function CommanderColors() {
  const { build: flow, commanders } = useAppState();
  const list = commanders.list;
  const picked = flow.colors;
  const name = picked.length > 0 ? colorsLabel(picked) : undefined;
  return (
    <div className="flex flex-col gap-2">
      <h2 className={ui.sectionLabel}>Colors</h2>
      <div role="group" aria-label="Colors" className="grid grid-cols-5 gap-1.5">
        {COLORS.map((c) => {
          const n = list?.filter((x) => x.colors.includes(c)).length ?? 0;
          const label = COLOR_LABELS[c].toLowerCase();
          // "Commanders" does not fit the button, so the line below says what the number counts.
          // A no-break space keeps the button height while the list loads.
          const count = list ? (
            <>
              {n}
              <span className="sr-only"> {n === 1 ? 'commander' : 'commanders'}</span>
            </>
          ) : (
            ' '
          );
          return (
            <ColorToggle
              key={c}
              color={c}
              on={picked.includes(c)}
              can={n > 0}
              count={count}
              title={
                flow.commander
                  ? 'Changing colors returns to the commander list'
                  : list && n === 0
                    ? `No ${label} commanders in your bulk list`
                    : undefined
              }
              onToggle={() => flow.toggleColor(c)}
            />
          );
        })}
      </div>
      <p className="text-[12px] text-fg-2">
        {flow.commander
          ? `Colors come from the commander: ${name ?? 'colorless'}. Changing a setting returns to the commander list.`
          : !name
            ? 'Numbers count the commanders with each color. Pick colors to narrow the list: a commander shows when all its colors are picked.'
            : picked.length === 1
              ? `Showing ${name.toLowerCase()} commanders. Pick more colors to add multicolor ones.`
              : `Showing commanders within ${name}, the ones with ${COUNT_WORDS[picked.length]} colors first.`}
      </p>
    </div>
  );
}

interface StyleChoice {
  id: string;
  label: string;
  description: string;
  /** Near misses cannot be picked; a commander style the pool is short for can, to see who leads it. */
  state: 'viable' | 'near' | 'short';
}

/** Scans of the commanders' colors, keyed by color letters, for the style pickers. */
function colorScans(
  list: readonly CommanderCandidate[],
  scans: ReadonlyMap<string, ScanReport>,
): Map<string, ScanReport> {
  const out = new Map<string, ScanReport>();
  for (const c of list) {
    const key = c.colors.join('');
    const scan = scans.get(key);
    if (scan) out.set(key, scan);
  }
  return out;
}

/**
 * Styles to filter the commanders by: every style a listed commander leads.
 * Viable when some leader's colors can build it; short when none can, still
 * pickable so the player sees which commanders lead it.
 */
function commanderStyleChoices(
  config: ReturnType<typeof useAppState>['config'],
  list: readonly CommanderCandidate[],
  scans: ReadonlyMap<string, ScanReport>,
): StyleChoice[] {
  const out: StyleChoice[] = [];
  for (const a of config.archetypes.archetypes) {
    const leaders = list.filter((c) => commanderSuits(c, a.id, config));
    if (leaders.length === 0) continue;
    const viable = leaders.some(
      (c) => scans.get(c.colors.join(''))?.archetypes.find((r) => r.archetype === a.id)?.viable,
    );
    // Plain shapes suit every commander, so a count says nothing there.
    const count =
      a.kind === 'synergy'
        ? `${leaders.length} ${leaders.length === 1 ? 'commander leads' : 'commanders lead'} it`
        : undefined;
    out.push({
      id: a.id,
      label: a.label,
      description: viable
        ? `${a.description}${count ? ` ${capitalize(count)}.` : ''}`
        : `${count ? `${capitalize(count)}, but your` : 'Your'} bulk list is short of cards for it`,
      state: viable ? 'viable' : 'short',
    });
  }
  return out.sort((x, y) => Number(x.state !== 'viable') - Number(y.state !== 'viable'));
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

/** Secondary styles for the primary, with the best viability any color subset reaches. */
function secondaryStyleChoices(
  config: ReturnType<typeof useAppState>['config'],
  scans: ReadonlyMap<string, ScanReport>,
  primary: string,
): StyleChoice[] {
  const best = new Map<string, StyleChoice>();
  for (const scan of scans.values()) {
    for (const c of secondaryChoices(scan, config, primary)) {
      const have = best.get(c.id);
      if (have?.state === 'viable') continue;
      if (c.state === 'viable' || !have) {
        const description =
          c.state === 'viable'
            ? c.kind === 'tribal'
              ? `More ${c.id.slice(7)} creatures and the cards that reward them`
              : (config.archetypes.archetypes.find((a) => a.id === c.id)?.description ?? '')
            : capitalize(c.note);
        best.set(c.id, { id: c.id, label: c.label, description, state: c.state });
      }
    }
  }
  return [...best.values()].sort((x, y) =>
    x.state === y.state ? 0 : x.state === 'viable' ? -1 : 1,
  );
}

const STATE_LABELS: Record<StyleChoice['state'], string> = {
  viable: 'Viable',
  near: 'Near miss',
  short: 'Short',
};

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
  const shown =
    current?.label ?? (value ? `${secondaryLabel(config, value)} (not available)` : emptyLabel);
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
              state={STATE_LABELS[c.state]}
              checked={value === c.id}
              disabled={c.state === 'near'}
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
        <span className="text-[13px] font-semibold">{name}</span>
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
  const copies = flow.resultMaxCopies ?? flow.maxCopies;

  return (
    <>
      <DeckLayout
        deck={deck}
        meta={`${deck.size} cards · ${lands} lands · ${deck.commander ? 'one copy of each' : `max ${copies} ${copies === 1 ? 'copy' : 'copies'}`}`}
        status={flow.error ?? status}
        actions={
          <>
            <button
              type="button"
              className={ui.go}
              disabled={flow.building}
              onClick={() => setConfirm(true)}
            >
              Accept
            </button>
            <button
              type="button"
              className={ui.stop}
              disabled={flow.building}
              onClick={() => {
                flow.reject();
                focusForm();
              }}
            >
              Back
            </button>
            <ExportMenu deck={deck} onStatus={setStatus} label="Export ▾" />
          </>
        }
      />
      <ChoiceDialog
        open={confirm}
        title="Accept this deck?"
        message="Save the deck to Decks. Its cards can leave your bulk list now or stay there."
        choices={[
          {
            label: 'Confirm',
            detail: 'Remove cards from bulk list',
            tone: 'go',
            onSelect: () => {
              setConfirm(false);
              if (flow.accept(true)) focusForm();
            },
          },
          {
            label: 'Confirm',
            detail: 'Keep cards in bulk list',
            tone: 'go-soft',
            onSelect: () => {
              setConfirm(false);
              if (flow.accept(false)) focusForm();
            },
          },
          { label: 'Decline', tone: 'stop', onSelect: () => setConfirm(false) },
        ]}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}
