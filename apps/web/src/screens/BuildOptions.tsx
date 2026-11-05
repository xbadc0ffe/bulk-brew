import {
  COLOR_LABELS,
  colorsLabel,
  normalizeColors,
  type CardRecord,
  type CommanderCandidate,
  type CommanderTier,
  type DeckOption,
} from '@bulk-brew/core';
import { useMemo, type ReactNode } from 'react';
import {
  archetypeInfo,
  CardArt,
  ColorBreakdown,
  CurveChart,
  deckColorShares,
  deckStyleRows,
  deckTypeCounts,
  Pip,
  RoleBar,
  RoleBars,
  TextCard,
  TypeBreakdown,
  ui,
  type DeckOptions,
} from '@bulk-brew/ui';
import { useAppState } from '../app-context.ts';

/**
 * The right side of the Build page: ranked deck options, built as you watch.
 * In Commander the list of commanders comes first, and the picked one stays
 * in a pane beside its options.
 */
export function OptionsPanel(props: { options: DeckOptions; onClear(): void }) {
  const { build: flow } = useAppState();
  if (flow.size === 100 && !flow.commander) return <CommanderList onClear={props.onClear} />;
  if (flow.size !== 100) return <OptionsBody {...props} />;
  return (
    <div className="flex min-w-0 flex-col md:min-h-0 md:flex-1 md:flex-row">
      <div className="flex min-w-0 flex-1 flex-col md:min-h-0">
        <OptionsBody {...props} />
      </div>
      <CommanderPane />
    </div>
  );
}

function OptionsBody({ options, onClear }: { options: DeckOptions; onClear(): void }) {
  const { build: flow, config, index } = useAppState();
  const lead = flow.commander ? index?.get(flow.commander) : undefined;
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
        <p>
          {lead && flow.style
            ? `Your bulk list is short of cards to build ${archetypeInfo(config, flow.style).label} under ${lead.name}.`
            : 'None of the picked colors can build the picked primary archetype.'}
        </p>
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
        <p>{options.failure ?? 'The picked colors do not have enough cards for this deck size.'}</p>
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
        {options.working && (
          <p aria-hidden className="flex items-center gap-2 text-[12px] text-fg-2">
            <Spinner />
            Building options, {options.built} of {options.planned}
          </p>
        )}
        {/* Announce once the list settles, not on every build. */}
        <span className="sr-only" aria-live="polite">
          {options.working ? '' : `${options.options.length} deck options ready.`}
        </span>
      </div>
      <ul className="grid auto-rows-min grid-cols-[repeat(auto-fill,minmax(min(335px,100%),1fr))] gap-4 p-6 md:min-h-0 md:flex-1 md:overflow-y-auto">
        {options.options.map((o) => (
          <li key={o.key}>
            <OptionCard option={o} onOpen={() => flow.open(o.result)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 p-8 text-center text-[13px] text-fg-2">
      {children}
    </div>
  );
}

const TIER_LABELS: Record<CommanderTier, string> = {
  top: 'Top commanders',
  good: 'Good commanders',
  possible: 'Possible commanders',
};

/** The card itself: its image when card art is on, else its text laid out like a card. */
function CommanderCard({ card, full = false }: { card: CardRecord; full?: boolean }) {
  const { settings } = useAppState();
  const text = <TextCard card={card} full={full} />;
  if (!settings.settings.showArt) return text;
  return (
    <CardArt
      card={card}
      size="normal"
      frameClassName="w-full rounded-[4.75%/3.4%]"
      className="block aspect-[63/88] w-full rounded-[4.75%/3.4%] object-contain"
      fallback={text}
      // A commander tile picks the commander on click; the picked one's pane can enlarge it.
      zoom={full}
    />
  );
}

/** One labeled part of a commander's details. */
function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={ui.sectionLabel}>{label}</span>
      <div className="text-[12.5px] leading-[1.45] text-fg-1">{children}</div>
    </div>
  );
}

/** What kind of deck a commander leads, in short sections. */
function CommanderDetails({ c }: { c: CommanderCandidate }) {
  const leads = new Set(c.leads.map((s) => s.id));
  const feeds = c.styles.filter((s) => !leads.has(s.id));
  return (
    <div className="flex flex-col gap-3">
      <Detail label="Deck it leads">
        {c.leads.length > 0 || feeds.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {c.leads.length > 0 && (
              <Chips lead="Rewards" items={c.leads.map((s) => s.label)} strong />
            )}
            {feeds.length > 0 && <Chips lead="Helps" items={feeds.map((s) => s.label)} />}
          </div>
        ) : (
          'No archetype of its own; options use whatever your cards build best.'
        )}
      </Detail>
      <Detail label="Your bulk list">
        {c.depth} cards in its colors{c.enough ? '' : ', not enough for the 99'}
      </Detail>
      <Detail label="Mana">
        {c.colors.length} {c.colors.length === 1 ? 'color' : 'colors'}, costs {c.mv}
        {c.mv > 5 && ', slow to cast'}
        {c.colors.length >= 3 &&
          `. ${c.fixers} ${c.fixers === 1 ? 'land makes' : 'lands make'} two or more of its colors${c.fixed ? '' : ', fewer than it wants'}`}
        .
      </Detail>
    </div>
  );
}

function Chips({ lead, items, strong }: { lead: string; items: string[]; strong?: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="text-[12px] text-fg-2">{lead}</span>
      {items.map((label) => (
        <span
          key={label}
          className={`rounded-full px-2 py-[2px] text-[12px] ${strong ? 'border border-line-strong bg-surface font-semibold text-ink' : 'bg-surface-2 text-fg-1'}`}
        >
          {label}
        </span>
      ))}
    </span>
  );
}

/**
 * Commanders in the bulk list, best first. Picked colors and a style filter
 * the list. Without a style the groups are tiers; with one they are whether
 * the bulk list can build it under each commander, moving as the background
 * checks finish. Picking one starts the options.
 */
function CommanderList({ onClear }: { onClear(): void }) {
  const { build: flow, commanders, index, config } = useAppState();
  const { list, shown, fit, checking } = commanders;
  if (!list || !index) {
    return (
      <Centered>
        <Spinner />
        <p>Looking for commanders in your bulk list...</p>
      </Centered>
    );
  }
  if (list.length === 0) {
    return (
      <Centered>
        <p className="text-ink">No commanders in your bulk list.</p>
        <p>
          A commander is a legendary creature, Vehicle, or Spacecraft, or a card that says it can be
          your commander.
        </p>
      </Centered>
    );
  }
  const style = flow.style ? archetypeInfo(config, flow.style).label : undefined;
  const colorName = flow.colors.length > 0 ? colorsLabel(flow.colors) : undefined;
  if (shown.length === 0) {
    return (
      <Centered>
        <p className="text-ink">
          {style && commanders.inColors.length > 0
            ? `No commanders ${colorName ? `within ${colorName} ` : ''}lead ${style}.`
            : `No commanders within ${colorName ?? 'these colors'}.`}
        </p>
        <p>
          {style && commanders.inColors.length > 0
            ? 'A commander leads a style when its own text rewards or feeds it.'
            : 'A commander shows when all its colors are picked.'}
        </p>
        <button type="button" className={`${ui.secondary} mt-2`} onClick={onClear}>
          Clear settings
        </button>
      </Centered>
    );
  }
  const groups: { key: string; title: string; items: CommanderCandidate[] }[] = style
    ? [
        { key: 'fits', title: `Can build ${style}` },
        { key: 'checking', title: 'Checking your bulk list' },
        { key: 'short', title: `Not enough cards for ${style}` },
      ].map((g) => ({ ...g, items: shown.filter((c) => fit.get(c.id) === g.key) }))
    : (['top', 'good', 'possible'] as const).map((t) => ({
        key: t,
        title: TIER_LABELS[t],
        items: shown.filter((c) => c.tier === t),
      }));
  const filtered = shown.length < list.length;
  return (
    <div className="flex flex-col md:min-h-0 md:flex-1">
      <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-3">
        <h2 id="options-title" tabIndex={-1} className="text-[15px] font-semibold">
          Pick a commander
        </h2>
        {style && checking > 0 ? (
          <p aria-hidden className="flex items-center gap-2 text-[12px] text-fg-2">
            <Spinner />
            Checking which can build {style}, {shown.length - checking} of {shown.length}
          </p>
        ) : (
          <p className="text-[12px] text-fg-2">
            {filtered ? `${shown.length} of ${list.length}` : list.length} in your bulk list
            {style ? '' : ', most promising first'}
          </p>
        )}
        {/* Announce once the checks settle, not on every one. */}
        <span className="sr-only" aria-live="polite">
          {style && checking === 0
            ? `${shown.filter((c) => fit.get(c.id) === 'fits').length} of ${shown.length} commanders can build ${style}.`
            : ''}
        </span>
      </div>
      <div className="flex flex-col gap-6 p-6 md:min-h-0 md:flex-1 md:overflow-y-auto">
        {groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <section key={g.key} className="flex flex-col gap-3">
              <h3 className={ui.sectionLabel}>
                {g.title} ({g.items.length})
              </h3>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(275px,100%),1fr))] gap-4">
                {g.items.map((c) => {
                  const card = index.get(c.id);
                  if (!card) return null;
                  return (
                    <li
                      key={c.id}
                      className="relative flex flex-col gap-3.5 rounded-xl border border-line bg-surface p-3 hover:border-line-strong hover:bg-surface-2"
                    >
                      <CommanderCard card={card} />
                      <CommanderDetails c={c} />
                      <Cover onClick={() => flow.setCommander(c.id)}>
                        Pick {c.name} as commander
                      </Cover>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
      </div>
    </div>
  );
}

/** The picked commander beside its deck options, with its details and a way back to the list. */
function CommanderPane() {
  const { build: flow, index, commanders } = useAppState();
  const card = flow.commander && index ? index.get(flow.commander) : undefined;
  if (!card) return null;
  const candidate = commanders.list?.find((c) => c.id === card.id);
  return (
    <aside
      aria-label="Commander"
      className="order-first flex shrink-0 flex-col gap-4 border-b border-line bg-surface p-4 md:order-none md:w-[300px] md:overflow-y-auto md:border-b-0 md:border-l"
    >
      {/* The pips sit under the label so a five-color commander still leaves room for the button; it wraps below if not. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-col gap-1.5">
          <span className={ui.sectionLabel}>Commander</span>
          <span className="flex items-center gap-1.5">
            {normalizeColors(card.identity).map((c) => (
              <Pip key={c} symbol={c} size={16} label={COLOR_LABELS[c]} />
            ))}
          </span>
        </span>
        <button
          type="button"
          className={`${ui.stop} whitespace-nowrap`}
          onClick={() => {
            flow.setCommander(undefined);
            requestAnimationFrame(() => document.getElementById('options-title')?.focus());
          }}
        >
          Change Commander
        </button>
      </div>
      <CommanderCard card={card} full />
      {candidate && <CommanderDetails c={candidate} />}
    </aside>
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
  const { config, build: flow, index } = useAppState();
  const { deck, explanation } = option.result;
  const colors = normalizeColors(deck.colors ?? [deck.color]);
  const style = archetypeInfo(config, deck.archetype);
  const missing = flow.colors.filter((c) => !colors.includes(c));
  const synergy = explanation.synergies[0];
  const stretched = explanation.notes.find((n) => n.includes('is stretched'));
  const secondary = explanation.secondary;
  const title = `${colorsLabel(colors)} ${style.label}${secondary ? ` with ${secondary.label}` : ''}`;
  const shares = useMemo(() => (index ? deckColorShares(deck, index) : []), [deck, index]);
  const types = useMemo(() => (index ? deckTypeCounts(deck, index) : []), [deck, index]);
  const styles = useMemo(
    () => (index ? deckStyleRows(deck, index, config) : []),
    [deck, index, config],
  );
  // A role the deck size does not ask for (a target of 0) has nothing to show.
  const roles = Object.entries(explanation.roles).filter(([, c]) => c.want > 0);
  const left = missing.map((c) => COLOR_LABELS[c].toLowerCase()).join(' and ');
  return (
    <div className="relative flex h-full flex-col gap-4 rounded-lg border border-line bg-surface p-4 hover:border-line-strong hover:bg-surface-2">
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex items-center gap-1">
          {colors.map((c) => (
            <Pip key={c} symbol={c} size={18} />
          ))}
        </span>
        <span className="text-[15px] font-semibold">{title}</span>
        <span className="text-[12px] text-fg-2">{style.description}</span>
      </span>
      <ColorBreakdown shares={shares} size={84} />
      <Part label="Mana curve">
        <CurveChart curve={explanation.curve} />
      </Part>
      <Part label="Card types">
        <TypeBreakdown counts={types} />
      </Part>
      {(styles.length > 0 || roles.length > 0) && (
        <Part label="Roles">
          <span className="text-[12.5px]">
            <RoleBars>
              {styles.map((r) => (
                <RoleBar key={r.key} label={r.label} have={r.have} want={r.want} />
              ))}
              {roles.map(([id, c]) => (
                <RoleBar
                  key={id}
                  label={config.roles.roles.find((r) => r.id === id)?.label ?? id}
                  have={c.have}
                  want={c.want}
                />
              ))}
            </RoleBars>
          </span>
        </Part>
      )}
      {(missing.length > 0 || stretched || (secondary && !secondary.met)) && (
        <span className="flex flex-wrap gap-1.5">
          {missing.length > 0 && <span className={ui.tag}>Leaves out {left}</span>}
          {stretched && <span className={ui.tag}>Mana is stretched</span>}
          {secondary && !secondary.met && (
            <span className={ui.tag}>{secondary.label} not fully met</span>
          )}
        </span>
      )}
      {synergy && <span className="text-[12px] text-fg-1">{synergy}</span>}
      <Cover onClick={onOpen}>Open {title}</Cover>
    </div>
  );
}

/**
 * A button laid over a whole card, so the card's content stays ordinary
 * content for screen readers while a click anywhere picks it.
 */
function Cover({ onClick, children }: { onClick(): void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="absolute inset-0 rounded-[inherit]">
      <span className="sr-only">{children}</span>
    </button>
  );
}

/** A labeled block inside an option card. */
function Part({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex flex-col gap-2 border-t border-line pt-3">
      <span className={ui.sectionLabel}>{label}</span>
      {children}
    </span>
  );
}
