import { useEffect, useMemo, type ReactNode } from 'react';
import {
  BEST_DECK_SIZES,
  COLORS,
  COLOR_LABELS,
  colorsLabel,
  normalizeColors,
  type Color,
  type DeckOption,
  type DeckSize,
} from '@bulk-brew/core';
import {
  COLOR_PAIRS,
  deckTypeCounts,
  MV_BUCKETS,
  Pip,
  poolStats,
  Segmented,
  poolSummary,
  STAT_COLORS,
  TypeBreakdown,
  ui,
  type BestDecksSize,
  type ColorDepth,
  type ColorKey,
  type NamedCount,
} from '@bulk-brew/ui';
import { useAppState } from '../app-context.ts';
import { useNav } from '../nav.ts';

const fmt = (n: number) => n.toLocaleString('en-US');

const SIZE_TITLES: Record<DeckSize, string> = {
  100: 'Commander',
  60: '60 cards',
  40: '40 cards',
  20: '20 cards',
};
const SIZE_LINES: Record<DeckSize, string> = {
  100: 'One commander and 99 cards',
  60: 'Casual constructed',
  40: 'Draft-style limited',
  20: 'Jumpstart packet',
};
/** Sizes a color or pair is checked at, largest first. */
const DEPTH_SIZES: readonly DeckSize[] = [60, 40, 20];
const COLOR_KEY_LABELS: Record<ColorKey, string> = {
  ...COLOR_LABELS,
  C: 'Colorless',
  M: 'Multicolor',
};
/** Creature types and other subtypes listed before the rest are summed up. */
const SUBTYPES_SHOWN = 12;

/**
 * What the bulk list can build and what it holds, shown under the Bulk List.
 * The best decks come from a background search that runs while this shows.
 */
export function AnalysisPanel() {
  const { pool, index, config, setAnalysisVisible } = useAppState();
  useEffect(() => {
    setAnalysisVisible(true);
    return () => setAnalysisVisible(false);
  }, [setAnalysisVisible]);
  const stats = useMemo(
    () => (index ? poolStats(pool.pool, index, config) : undefined),
    [index, pool.pool, config],
  );
  const summary = useMemo(
    () => (index ? poolSummary(pool.pool, index) : undefined),
    [index, pool.pool],
  );
  if (!stats || !summary || !pool.loaded) return <p className={`${ui.note} p-6`}>Loading</p>;

  // Colors with spells of their own get a column or a row; empty ones would only add zeros.
  const colorKeys = STAT_COLORS.filter((c) => stats.curve[c].some((n) => n > 0));
  const mvRows = colorKeys.map((c) => ({
    key: c,
    label: <ColorName id={c} />,
    values: stats.curve[c],
  }));
  const allSpells = MV_BUCKETS.map((_, i) => colorKeys.reduce((n, c) => n + stats.curve[c][i]!, 0));

  return (
    <div className="flex flex-col gap-6 px-6 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[16px] font-semibold">Analysis</h2>
        <span className="text-[12.5px] text-fg-2">
          {fmt(summary.cards)} cards · {fmt(summary.distinct)} unique
        </span>
      </div>

      <BestDecks />
      <ColorDepths fixing={stats.fixing} />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(460px,100%),1fr))] gap-4">
        <Panel
          title="Mana value by color"
          hint="Copies of spells at each mana value. Lands are left out."
        >
          <HeatTable
            caption="Spells by color and mana value"
            columns={MV_BUCKETS.map((b) => ({ key: b, head: b, label: `mana value ${b}` }))}
            rows={mvRows}
            footer={{ label: 'All', values: allSpells }}
          />
        </Panel>
        <Panel
          title="Roles by color"
          hint="Copies that fill each job the builder looks for in a deck."
        >
          {stats.roles.length > 0 ? (
            <HeatTable
              caption="Roles by color"
              columns={colorKeys.map((c) => ({
                key: c,
                head: <ColorHead id={c} />,
                label: COLOR_KEY_LABELS[c],
              }))}
              rows={stats.roles.map((r) => ({
                key: r.id,
                label: r.label,
                values: colorKeys.map((c) => r.byColor[c]),
              }))}
            />
          ) : (
            <p className={ui.note}>No cards fill a role yet.</p>
          )}
        </Panel>
        <Panel title="Card types" hint="Copies of each type, a card counted once.">
          <TypeBreakdown counts={stats.types} />
          <h4 className={`${ui.sectionLabel} mt-2`}>Other subtypes</h4>
          <BarList
            items={stats.otherSubtypes}
            empty="No Auras, Equipment, Vehicles, or other subtypes."
          />
        </Panel>
        <Panel
          title="Creature types"
          hint="Copies of each type, and of the cards in your bulk list that reward it."
        >
          <BarList
            items={stats.creatureTypes}
            empty="No creatures yet."
            extra={(t) =>
              t.payoffs > 0 ? `${fmt(t.payoffs)} ${t.payoffs === 1 ? 'payoff' : 'payoffs'}` : ''
            }
          />
          {stats.changelings > 0 && (
            <p className="text-[12px] text-fg-2">
              {stats.changelings === 1
                ? 'Plus 1 changeling, which counts as every type.'
                : `Plus ${fmt(stats.changelings)} changelings, which count as every type.`}
            </p>
          )}
        </Panel>
      </div>
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

/** A titled box with one line of explanation. */
function Panel({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className={`${ui.box} flex min-w-0 flex-col gap-3 px-4 py-3.5`}>
      <div className="flex flex-col gap-0.5">
        <h3 className="text-[13.5px] font-semibold">{title}</h3>
        <p className="text-[12px] text-fg-2">{hint}</p>
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- Best decks

const COLOR_LIMITS = COLORS.map((_, i) => ({ id: i + 1, label: String(i + 1) }));

function BestDecks() {
  const { bestDecks } = useAppState();
  const nav = useNav();
  const { sizes, built, planned, working, error } = bestDecks;
  const scanning = BEST_DECK_SIZES.some((s) => sizes[s].planned === undefined);
  const progress = error
    ? 'The deck search stopped.'
    : !working
      ? `Checked ${fmt(built)} ${built === 1 ? 'deck' : 'decks'}`
      : scanning
        ? 'Looking through your bulk list'
        : `Checking decks, ${fmt(built)} of ${fmt(planned)}`;
  return (
    <section aria-labelledby="best-decks-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h3 id="best-decks-title" className="text-[14px] font-semibold">
            Best decks
          </h3>
          <p aria-hidden className="flex items-center gap-2 text-[12px] text-fg-2">
            {working && <Spinner />}
            {progress}
          </p>
          {/* Announce once the search settles, not on every build. */}
          <span className="sr-only" aria-live="polite">
            {working ? '' : progress}
          </span>
        </div>
        <p className="text-[12px] text-fg-2">
          The strongest decks found so far. Each one is built from your whole bulk list, so two
          decks can share cards. The search keeps going while this pane is open; pick a deck to open
          it on the Build page.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-fg-1">
        <span>Up to</span>
        <Segmented
          label="Most colors per deck"
          options={COLOR_LIMITS}
          value={nav.analysisColors}
          onChange={nav.setAnalysisColors}
          compact
        />
        <span>{nav.analysisColors === 1 ? 'color per deck.' : 'colors per deck.'}</span>
        <span className="text-[12px] text-fg-2">
          Decks with more colors can rank high here but are harder to cast.
        </span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(250px,100%),1fr))] gap-4">
        {BEST_DECK_SIZES.map((size) => (
          <SizeColumn
            key={size}
            size={size}
            state={sizes[size]}
            limit={nav.analysisColors}
            stopped={Boolean(error)}
          />
        ))}
      </div>
    </section>
  );
}

function SizeColumn(props: {
  size: DeckSize;
  state: BestDecksSize;
  limit: number;
  /** The whole search stopped, not only this size. */
  stopped: boolean;
}) {
  const { size, state, limit, stopped } = props;
  const { planned, built, done } = state;
  const error = state.error ?? (stopped ? 'stopped' : undefined);
  const options = state.options[limit - 1] ?? [];
  const more = state.options[COLORS.length - 1]?.length ?? 0;
  const count =
    error !== undefined
      ? 'Stopped'
      : planned === undefined
        ? ''
        : done
          ? `${fmt(planned)} checked`
          : `${fmt(built)} of ${fmt(planned)}`;
  let body: ReactNode;
  if (options.length > 0) {
    body = (
      <ol aria-labelledby={`best-${size}`} className="flex flex-col divide-y-1 divide-surface-2">
        {options.map((o, i) => (
          <BestDeckRow key={o.key} rank={i + 1} option={o} />
        ))}
      </ol>
    );
  } else if (error) {
    body = <Empty>Something went wrong while checking these decks.</Empty>;
  } else if (!done) {
    body = (
      <Empty>
        <Spinner />
        {size === 100 ? 'Looking for commanders' : 'Looking for decks'}
      </Empty>
    );
  } else {
    body = (
      <Empty>
        {more > 0
          ? `None with up to ${limit} ${limit === 1 ? 'color' : 'colors'}. Allow more colors to see some.`
          : size === 100
            ? 'No commanders with enough cards in their colors for a 100-card deck.'
            : `Not enough cards for a ${size}-card deck.`}
      </Empty>
    );
  }
  return (
    <div className={`${ui.box} flex min-w-0 flex-col`}>
      <div className="flex items-start justify-between gap-2 border-b border-line px-3.5 py-2.5">
        <span className="flex flex-col">
          <h4 id={`best-${size}`} className="text-[13px] font-semibold">
            {SIZE_TITLES[size]}
          </h4>
          <span className="text-[11.5px] text-fg-2">{SIZE_LINES[size]}</span>
        </span>
        <span className="pt-px text-right text-[11.5px] text-fg-2 tabular-nums">{count}</span>
      </div>
      {body}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="flex flex-1 items-center justify-center gap-2 px-4 py-6 text-center text-[12.5px] text-fg-2">
      {children}
    </p>
  );
}

/** One found deck; picking it opens it on the Build page like any deck option. */
function BestDeckRow({ rank, option }: { rank: number; option: DeckOption }) {
  const { index, build } = useAppState();
  const nav = useNav();
  const { deck, explanation } = option.result;
  const colors = normalizeColors(deck.colors ?? [deck.color]);
  // Deck names end in the size, which the column already says.
  const title = deck.name.replace(/\s+\d+$/, '');
  const creatures = useMemo(
    () => (index ? deckTypeCounts(deck, index).find((t) => t.label === 'Creatures')?.count : 0),
    [deck, index],
  );
  const detail = [
    deck.commander ? colorsLabel(colors) : undefined,
    `${creatures ?? 0} ${creatures === 1 ? 'creature' : 'creatures'}`,
    `${explanation.lands.count} lands`,
    explanation.notes.some((n) => n.includes('is stretched')) ? 'mana is stretched' : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          build.openBuilt(option.result);
          nav.go('build');
        }}
        className="grid w-full grid-cols-[1.1rem_1fr] gap-x-2 px-3.5 py-2.5 text-left hover:bg-surface-2"
      >
        <span className="text-[12px] text-fg-2 tabular-nums">{rank}</span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="flex shrink-0 items-center gap-0.5">
              {colors.map((c) => (
                <Pip key={c} symbol={c} size={14} label={COLOR_LABELS[c]} />
              ))}
            </span>
            <span className="truncate text-[13px] font-semibold">{title}</span>
          </span>
          <span className="text-[11.5px] text-fg-2">{detail}</span>
        </span>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------- Color depth

function ColorDepths({ fixing }: { fixing: Record<string, number> }) {
  const { bestDecks } = useAppState();
  const tile = (colors: Color[]) => {
    const key = colors.join('');
    return (
      <DepthTile
        key={key}
        colors={colors}
        depth={bestDecks.depth.get(key)}
        fixing={fixing[key]}
        stopped={Boolean(bestDecks.error)}
      />
    );
  };
  return (
    <section aria-labelledby="depth-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h3 id="depth-title" className="text-[14px] font-semibold">
          Colors
        </h3>
        <p className="text-[12px] text-fg-2">
          Spells a deck in each color or pair can use, the largest deck it can build, and for pairs
          the lands that make both colors.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <h4 className={ui.sectionLabel}>One color</h4>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
          {COLORS.map((c) => tile([c]))}
        </ul>
        <h4 className={`${ui.sectionLabel} mt-1`}>Two colors</h4>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
          {COLOR_PAIRS.map((p) => tile(p))}
        </ul>
      </div>
    </section>
  );
}

function DepthTile(props: {
  colors: Color[];
  depth: ColorDepth | undefined;
  fixing: number | undefined;
  stopped: boolean;
}) {
  const { colors, depth, fixing, stopped } = props;
  const known = DEPTH_SIZES.filter((s) => depth?.possible[s] !== undefined);
  const largest = DEPTH_SIZES.find((s) => depth?.possible[s]);
  const checked = known.length === DEPTH_SIZES.length;
  const builds =
    largest !== undefined
      ? `Builds ${largest}`
      : checked
        ? 'Too few cards'
        : stopped
          ? 'Not checked'
          : 'Checking';
  return (
    <li
      className={`flex flex-col gap-1 rounded-md border border-line px-3 py-2 ${largest === undefined && checked ? 'opacity-70' : ''}`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-0.5" aria-label={colorsLabel(colors)} role="img">
          {colors.map((c) => (
            <Pip key={c} symbol={c} size={16} />
          ))}
        </span>
        <span
          className={`text-[11.5px] ${largest !== undefined ? 'font-semibold text-ink' : 'text-fg-2'}`}
        >
          {builds}
        </span>
      </span>
      <span className="text-[12.5px] text-fg-1">
        {depth?.spells !== undefined
          ? `${fmt(depth.spells)} spells`
          : stopped
            ? 'Spells not counted'
            : 'Counting spells'}
      </span>
      {colors.length === 2 && (
        <span className="text-[11.5px] text-fg-2">
          {fixing
            ? `${fmt(fixing)} ${fixing === 1 ? 'land makes' : 'lands make'} both`
            : 'No dual lands'}
        </span>
      )}
    </li>
  );
}

// ---------------------------------------------------------------- Tables and bars

/** A color class as a column head: its symbol, or "Multi". */
function ColorHead({ id }: { id: ColorKey }) {
  if (id === 'M') return <span title="Multicolor">Multi</span>;
  return <Pip symbol={id} size={15} label={COLOR_KEY_LABELS[id]} />;
}

/** A color class as a row label: symbol and name. */
function ColorName({ id }: { id: ColorKey }) {
  return (
    <span className="flex items-center gap-1.5">
      {id !== 'M' && <Pip symbol={id} size={14} />}
      {COLOR_KEY_LABELS[id]}
    </span>
  );
}

/** Shade for a cell holding `share` of the table's largest value. */
function shade(share: number): string | undefined {
  if (share <= 0) return undefined;
  return `color-mix(in oklch, var(--bar) ${Math.round(10 + 45 * share)}%, transparent)`;
}

/**
 * Counts in a grid, each cell shaded by its size so the deep spots stand
 * out; the number is always printed, so the shade is never the only cue.
 */
function HeatTable(props: {
  caption: string;
  columns: { key: string; head: ReactNode; label: string }[];
  rows: { key: string; label: ReactNode; values: number[] }[];
  footer?: { label: string; values: number[] };
}) {
  const { caption, columns, rows, footer } = props;
  const max = Math.max(1, ...rows.flatMap((r) => r.values));
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-[3px] text-[12px] tabular-nums">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <td />
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                aria-label={c.label}
                className="px-1 pb-1 text-center font-semibold text-fg-2"
              >
                <span className="inline-flex justify-center">{c.head}</span>
              </th>
            ))}
            <th scope="col" className="pb-1 pl-2 text-right font-semibold text-fg-2">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row" className="pr-2 text-left font-normal whitespace-nowrap text-fg-1">
                {r.label}
              </th>
              {r.values.map((v, i) => (
                <td
                  key={columns[i]!.key}
                  className={`h-7 min-w-8 rounded-[3px] text-center ${v > 0 ? 'text-ink' : 'text-fg-3'}`}
                  style={{ background: shade(v / max) }}
                >
                  {fmt(v)}
                </td>
              ))}
              <td className="pl-2 text-right font-semibold text-ink">{fmt(sum(r.values))}</td>
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr>
              <th scope="row" className="pt-1 pr-2 text-left font-semibold text-fg-1">
                {footer.label}
              </th>
              {footer.values.map((v, i) => (
                <td key={columns[i]!.key} className="pt-1 text-center font-semibold text-ink">
                  {fmt(v)}
                </td>
              ))}
              <td className="pt-1 pl-2 text-right font-semibold text-ink">
                {fmt(sum(footer.values))}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/** Named counts as bars, most first, the long tail summed up in one line. */
function BarList<T extends NamedCount>(props: {
  items: T[];
  empty: string;
  /** A short note after the count, such as how many cards reward a creature type. */
  extra?: (item: T) => string;
}) {
  const { items, empty, extra } = props;
  if (items.length === 0) return <p className={ui.note}>{empty}</p>;
  const shown = items.slice(0, SUBTYPES_SHOWN);
  const rest = items.slice(SUBTYPES_SHOWN);
  const max = Math.max(1, ...shown.map((t) => t.count));
  return (
    <div className="flex flex-col gap-2">
      <div
        className={`grid ${extra ? 'grid-cols-[minmax(76px,max-content)_1fr_auto_auto]' : 'grid-cols-[minmax(76px,max-content)_1fr_auto]'} items-center gap-x-2.5 gap-y-1.5 text-[12.5px]`}
      >
        {shown.map((t) => {
          return (
            <div key={t.name} className="contents">
              <span className="text-fg-1">{t.name}</span>
              <span aria-hidden className="h-1.5 overflow-hidden rounded-[3px] bg-line">
                <span
                  className="block h-full bg-bar"
                  style={{ width: `${(t.count / max) * 100}%` }}
                />
              </span>
              <span className="text-right font-mono text-[12px] text-ink tabular-nums">
                {fmt(t.count)}
              </span>
              {extra && (
                <span className="min-w-[9ch] text-[12px] text-fg-2 tabular-nums">{extra(t)}</span>
              )}
            </div>
          );
        })}
      </div>
      {rest.length > 0 && (
        <p className="text-[12px] text-fg-2">
          And {fmt(rest.length)} more, {fmt(rest.reduce((n, t) => n + t.count, 0))} copies in all.
        </p>
      )}
    </div>
  );
}
