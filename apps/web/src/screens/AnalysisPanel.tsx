import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BEST_DECK_SIZES,
  COLORS,
  COLOR_LABELS,
  normalizeColors,
  type DeckOption,
  type DeckSize,
} from '@bulk-brew/core';
import {
  MV_BUCKETS,
  Pip,
  poolStats,
  poolSummary,
  Segmented,
  STAT_COLORS,
  ui,
  type BestDecksSize,
  type ColorKey,
  type ColorRow,
  type PoolStats,
} from '@bulk-brew/ui';
import { useAppState } from '../app-context.ts';
import { useNav } from '../nav.ts';
import {
  ColorMark,
  ColorPie,
  HeatTable,
  ManaValueBars,
  type HeatColumn,
  type HeatRow,
} from './AnalysisCharts.tsx';
import { COLOR_KEY_LABELS, fmt } from './analysisLabels.ts';

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
/** Creature types and subtypes listed before the rest are summed up. */
const ROWS_SHOWN = 12;
const LIST = new Intl.ListFormat('en', { type: 'conjunction' });

/**
 * What the bulk list can build and what it holds, shown under the Bulk List.
 * The recommended decks come from a background search that runs while this shows.
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

  // Color classes with cards get a column; empty ones would only add zeros. Card types
  // count lands; the other tables count spells only, so they use the colors with spells.
  const allKeys = STAT_COLORS.filter((c) => stats.colors[c] > 0);
  const spellKeys = STAT_COLORS.filter((c) => stats.curve[c].some((n) => n > 0));
  const columns = (keys: ColorKey[]) =>
    keys.map((c) => ({ key: c, head: <ColorHead id={c} />, label: COLOR_KEY_LABELS[c] }));
  const byColor =
    (keys: ColorKey[]) =>
    (rows: ColorRow[]): HeatRow[] =>
      rows.map((r) => ({ key: r.id, label: r.label, values: keys.map((c) => r.byColor[c]) }));

  return (
    <div className="flex flex-col gap-6 px-6 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[16px] font-semibold">Analysis</h2>
        <span className="text-[12.5px] text-fg-2">
          {fmt(summary.cards)} cards · {fmt(summary.distinct)} unique
        </span>
      </div>

      <RecommendedDecks />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(460px,100%),1fr))] gap-4">
        <Panel title="Colors">
          <ColorPie counts={stats.colors} keys={STAT_COLORS} />
          <details className="group border-t border-line pt-3">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[12.5px] font-semibold text-fg-1 hover:text-ink [&::-webkit-details-marker]:hidden">
              <span aria-hidden className="inline-block transition-transform group-open:rotate-90">
                ›
              </span>
              Multicolor cards in each of their colors
            </summary>
            <div className="pt-3">
              <ColorPie counts={stats.eachColor} keys={STAT_COLORS} />
            </div>
          </details>
        </Panel>
        <ManaValuePanel stats={stats} />
        <Panel title="Card types">
          <HeatTable
            caption="Card types by color"
            rowHead="Type"
            columns={columns(allKeys)}
            rows={byColor(allKeys)(stats.types)}
          />
        </Panel>
        <Panel title="Roles by color">
          {stats.roles.length > 0 ? (
            <HeatTable
              caption="Roles by color"
              rowHead="Role"
              columns={columns(spellKeys)}
              rows={byColor(spellKeys)(stats.roles)}
            />
          ) : (
            <p className={ui.note}>No cards fill a role yet.</p>
          )}
        </Panel>
        <Panel title="Creature types">
          <LongTable
            caption="Creature types by color"
            rowHead="Creature type"
            columns={columns(spellKeys)}
            rows={stats.creatureTypes}
            toRows={byColor(spellKeys)}
            what="types"
            empty="No creatures yet."
          />
          {stats.changelings > 0 && (
            <p className="text-[12px] text-fg-2">
              {stats.changelings === 1
                ? 'Plus 1 changeling, which counts as every type.'
                : `Plus ${fmt(stats.changelings)} changelings, which count as every type.`}
            </p>
          )}
        </Panel>
        <Panel title="Subtypes">
          <LongTable
            caption="Subtypes by color"
            rowHead="Subtype"
            columns={columns(spellKeys)}
            rows={stats.subtypes}
            toRows={byColor(spellKeys)}
            what="subtypes"
            empty="No Auras, Equipment, Vehicles, or other subtypes."
          />
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

/** A titled box, with an optional line of explanation. */
function Panel({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className={`${ui.box} flex min-w-0 flex-col gap-3 px-4 py-3.5`}>
      <div className="flex flex-col gap-0.5">
        <h3 className="text-[13.5px] font-semibold">{title}</h3>
        {hint && <p className="text-[12px] text-fg-2">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** A color class as a column head: its symbol, or "Multi". */
function ColorHead({ id }: { id: ColorKey }) {
  if (id === 'M') return <span title="Multicolor">Multi</span>;
  return <Pip symbol={id} size={15} label={COLOR_KEY_LABELS[id]} />;
}

/** The first rows of a long by-color list, the rest summed up in one line. */
function LongTable(props: {
  caption: string;
  rowHead: string;
  columns: HeatColumn[];
  rows: ColorRow[];
  toRows(rows: ColorRow[]): HeatRow[];
  what: string;
  empty: string;
}) {
  const { caption, rowHead, columns, rows, toRows, what, empty } = props;
  if (rows.length === 0) return <p className={ui.note}>{empty}</p>;
  const rest = rows.slice(ROWS_SHOWN);
  return (
    <>
      <HeatTable
        caption={caption}
        rowHead={rowHead}
        columns={columns}
        rows={toRows(rows.slice(0, ROWS_SHOWN))}
      />
      {rest.length > 0 && (
        <p className="text-[12px] text-fg-2">
          And {fmt(rest.length)} more {what}, {fmt(rest.reduce((n, r) => n + r.total, 0))} copies in
          all.
        </p>
      )}
    </>
  );
}

/** Spells by color and mana value; picked colors fill the bars under the table. */
function ManaValuePanel({ stats }: { stats: PoolStats }) {
  const [picked, setPicked] = useState<ReadonlySet<ColorKey>>(new Set());
  const keys = STAT_COLORS.filter((c) => stats.curve[c].some((n) => n > 0));
  // Picks of colors the list no longer has drop out.
  const live = keys.filter((c) => picked.has(c));
  const charted = live.length > 0 ? live : keys;
  const values = MV_BUCKETS.map((_, i) => charted.reduce((n, c) => n + stats.curve[c][i]!, 0));
  const all = MV_BUCKETS.map((_, i) => keys.reduce((n, c) => n + stats.curve[c][i]!, 0));
  const label =
    live.length > 0 ? `${LIST.format(live.map((c) => COLOR_KEY_LABELS[c]))} spells` : 'All spells';
  return (
    <Panel title="Mana value by color" hint="Spells only. Pick colors to chart them.">
      <HeatTable
        caption="Spells by color and mana value"
        rowHead="Color"
        columns={MV_BUCKETS.map((b) => ({ key: b, head: b, label: `mana value ${b}` }))}
        rows={keys.map((c) => ({
          key: c,
          label: (
            <span className="flex items-center gap-1.5">
              <ColorMark id={c} />
              {COLOR_KEY_LABELS[c]}
            </span>
          ),
          values: stats.curve[c],
        }))}
        footer={{ label: 'All', values: all }}
        picked={new Set(live)}
        onPick={(key) =>
          setPicked((p) => {
            if (key === undefined) return new Set();
            const next = new Set(keys.filter((c) => p.has(c)));
            if (next.has(key as ColorKey)) next.delete(key as ColorKey);
            else next.add(key as ColorKey);
            return next;
          })
        }
      />
      <ManaValueBars values={values} label={label} />
    </Panel>
  );
}

// ---------------------------------------------------------------- Recommended decks

const COLOR_LIMITS = COLORS.map((_, i) => ({ id: i + 1, label: String(i + 1) }));

function RecommendedDecks() {
  const { bestDecks } = useAppState();
  const nav = useNav();
  const { sizes, built, working, error } = bestDecks;
  return (
    <section aria-labelledby="best-decks-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h3 id="best-decks-title" className="flex items-center gap-2 text-[14px] font-semibold">
          Recommended decks
          {working && <Spinner />}
        </h3>
        {/* Announce once the search settles, not on every build. */}
        <span className="sr-only" aria-live="polite">
          {working
            ? ''
            : error
              ? 'The deck search stopped.'
              : `Checked ${fmt(built)} ${built === 1 ? 'deck' : 'decks'}.`}
        </span>
        <div className="flex items-center gap-2 text-[12.5px] text-fg-1">
          <span aria-hidden>Max colors per deck</span>
          <Segmented
            label="Max colors per deck"
            options={COLOR_LIMITS}
            value={nav.analysisColors}
            onChange={nav.setAnalysisColors}
            compact
          />
        </div>
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
          <DeckRow key={o.key} rank={i + 1} option={o} />
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

/**
 * One recommended deck: its colors and name, centered in a row tall enough
 * for a name on two lines. Picking it opens it on the Build page.
 */
function DeckRow({ rank, option }: { rank: number; option: DeckOption }) {
  const { build } = useAppState();
  const nav = useNav();
  const { deck } = option.result;
  const colors = normalizeColors(deck.colors ?? [deck.color]);
  // Deck names end in the size, which the column already says.
  const title = deck.name.replace(/\s+\d+$/, '');
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          build.openBuilt(option.result);
          nav.go('build');
        }}
        className="grid min-h-14 w-full grid-cols-[1.1rem_1fr] items-center gap-x-2 px-3.5 py-2 text-left hover:bg-surface-2"
      >
        <span className="text-[12px] text-fg-2 tabular-nums">{rank}</span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="flex shrink-0 items-center gap-0.5">
            {colors.map((c) => (
              <Pip key={c} symbol={c} size={14} label={COLOR_LABELS[c]} />
            ))}
          </span>
          <span className="text-[13px] font-semibold">{title}</span>
        </span>
      </button>
    </li>
  );
}
