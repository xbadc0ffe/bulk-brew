// Swapping one card of a built deck for another from the bulk list: which
// cards can go in, ranked by the jobs they share with the card going out,
// and the deck with the swap made and its explanation brought up to date.
// A spell replaces a spell and a land a land, so the land count stands.

import { deckThemes, landNote, spellSynergyLines, type DeckTheme } from './builder.ts';
import { factsFor, listCandidates, type Candidate, type CardFacts } from './candidates.ts';
import { templateFor, type BulkBrewConfig } from './config.ts';
import {
  creditsFor,
  deckCredits,
  earnedTheme,
  swapSupply,
  type DeckCredits,
} from './deck-credits.ts';
import { draftOnly, isFetch, landColors, planLandCount, scoreNonbasic } from './lands.ts';
import type { CardIndex } from './pack.ts';
import {
  COLOR_LABELS,
  COLORS,
  type BuildExplanation,
  type CardRecord,
  type Color,
  type Deck,
  type DeckCard,
  type Pool,
  type PrintingHint,
  type Settings,
} from './types.ts';

/**
 * How suggestions are ranked. They only order a list the player picks from;
 * the builder never reads them, so they are not part of the config version.
 */
const WEIGHTS = {
  /** Per job of the card going out that the option also does. */
  sharedJob: 3,
  /** Per job the deck counts that the option does and the card going out does not. */
  newJob: 0.5,
  /** Per point of card strength (0 to 10). */
  strength: 0.5,
  /** Per point of mana value away from the card going out, up to `mvCap` points. */
  mvStep: 1,
  mvCap: 4,
  /** Both creatures, or both not. */
  sameKind: 1,
  /** Taken off in proportion to the copies of the card going out that have to stay. */
  short: 1,
};

/** The start of a swapped-in card's `why`; the name of the card it replaced follows. */
export const SWAP_WHY_PREFIX = 'Swapped in for ';

/** Something a card does in a deck: a role the deck counts, or a side of one of its themes. */
export interface DeckJob {
  id: string;
  /** Plain words, such as "Removal" or "Tokens enabler". */
  label: string;
}

export interface ReplacementOption {
  card: CardRecord;
  printing?: PrintingHint;
  /** Copies that go in: as many as go out, or fewer when the bulk list runs short. */
  qty: number;
  /** Jobs of the card going out that this card does too. */
  shared: DeckJob[];
  /** Jobs the deck counts that this card does and the card going out does not. */
  added: DeckJob[];
}

export interface Replacements {
  /** The card going out. */
  card: CardRecord;
  /** Its copies in the deck. */
  qty: number;
  /** What it does in this deck. */
  jobs: DeckJob[];
  /** Cards from the bulk list that can take its place, best first. */
  options: ReplacementOption[];
}

interface JobContext {
  roles: { id: string; label: string }[];
  themes: DeckTheme[];
}

function deckColorsOf(deck: Deck): Color[] {
  return deck.colors ?? [deck.color];
}

/** The deck's style ids, as the mana base reads them; merged packets record "a+b". */
function deckStyles(deck: Deck): string[] {
  return [...deck.archetype.split('+'), ...(deck.secondary ? [deck.secondary] : [])];
}

/** The deck color whose basic land this card is, by the land rules' names. */
function basicColorOf(card: CardRecord, config: BulkBrewConfig): Color | undefined {
  return COLORS.find((c) => config.landRules.basics.names[c] === card.name);
}

/** The roles the deck counts (those its size asks for) and its themes. */
function jobContext(deck: Deck, config: BulkBrewConfig): JobContext {
  const counted = deck.explanation
    ? new Set(
        Object.entries(deck.explanation.roles)
          .filter(([, c]) => c.want > 0)
          .map(([id]) => id),
      )
    : undefined;
  return {
    roles: config.roles.roles
      .filter((r) => !counted || counted.has(r.id))
      .map((r) => ({ id: r.id, label: r.label })),
    themes: deckThemes(deck, config),
  };
}

/**
 * Theme sides first, as the deck's Roles bars list them, then roles in config
 * order. Lands have none: the builders count roles and themes over spells only.
 * A job counts only when the card earns it in the deck it plays in, whose
 * credits are asked for only when the card has a job to check.
 */
function jobsOf(cand: Candidate, ctx: JobContext, credits: () => DeckCredits): DeckJob[] {
  const out: DeckJob[] = [];
  if (!cand.facts.spell) return out;
  const card = cand.facts.card;
  for (const t of ctx.themes) {
    const name = t.tribal ? t.id.slice('tribal:'.length) : t.label;
    // The reader has no credit for a tribe; its cards count as the Roles bars count them.
    const earned = (side: 'setup' | 'payoff') =>
      t.tribal || earnedTheme(card, t.id, side, credits());
    if (t.isEnabler(cand) && earned('setup'))
      out.push({ id: `${t.id}:enabler`, label: t.tribal ? `${name} creature` : `${name} enabler` });
    if (t.isPayoff(cand) && earned('payoff'))
      out.push({ id: `${t.id}:payoff`, label: `${name} payoff` });
  }
  for (const r of ctx.roles)
    if (cand.facts.roles.includes(r.id) && credits().earned(card, r.id)) out.push(r);
  return out;
}

function asCandidate(facts: CardFacts): Candidate {
  return { facts, available: 0, preferred: 0 };
}

/** The deck card a swap can take out: in the deck and not its commander. */
function swappable(deck: Deck, cardId: string): DeckCard | undefined {
  if (cardId === deck.commander) return undefined;
  return deck.cards.find((c) => c.cardId === cardId);
}

/**
 * Cards from the bulk list that can take the place of one deck card, best
 * first: the same deck colors, copy limit, and settings the builder used;
 * spells for a spell and nonbasic lands for a land. Each takes as many copies
 * as go out when the bulk list has them spare, within the builder's usual
 * copies of legendary and expensive cards. A nonbasic land can also give
 * way to a basic of a deck color it makes (any deck color for a land that
 * makes none), as many as the pool has spare when basics are tracked.
 * Spells rank by the jobs they share with the card going out, then strength,
 * mana value, and creature or not; lands and basics by the land rules. A job
 * counts only when earned: the outgoing card's in the deck now, an option's
 * in the deck after the swap.
 * Undefined for a card the deck does not hold, a basic land, or the commander.
 */
export function replacementOptions(
  deck: Deck,
  cardId: string,
  pool: Pool,
  index: CardIndex,
  config: BulkBrewConfig,
  settings: Settings,
): Replacements | undefined {
  const out = swappable(deck, cardId);
  const outCard = index.get(cardId);
  if (!out || !outCard) return undefined;
  const outFacts = factsFor(index, config, outCard);
  const colors = deckColorsOf(deck);
  const styles = deckStyles(deck);
  const ctx = jobContext(deck, config);
  const now = deckCredits(deck, index, config);
  const outJobs = jobsOf(asCandidate(outFacts), ctx, () => now);
  const outIds = new Set(outJobs.map((j) => j.id));
  const inDeck = new Map(deck.cards.map((c) => [c.cardId, c.qty]));
  const short = (qty: number) => WEIGHTS.short * (1 - qty / out.qty);

  const ranked: { option: ReplacementOption; score: number }[] = [];
  if (!outFacts.spell && !outFacts.basic) {
    const makes = landColors(outCard, colors, deck.size);
    for (const c of makes.length > 0 ? makes : colors) {
      const basic = index.find(config.landRules.basics.names[c]);
      if (!basic) continue;
      // Tracked basics: the pool's copies beyond those the deck already runs.
      const spare = settings.unlimitedBasics
        ? out.qty
        : (pool.entries[basic.id]?.qty ?? 0) - (deck.basics[c] ?? 0);
      if (spare <= 0) continue;
      const qty = Math.min(out.qty, spare);
      const score = scoreNonbasic(basic, colors, config, deck.size, styles).score - short(qty);
      ranked.push({ option: { card: basic, qty, shared: [], added: [] }, score });
    }
  }
  for (const cand of listCandidates(pool, index, config, settings, colors, deck.size)) {
    const f = cand.facts;
    const id = f.card.id;
    if (id === cardId || id === deck.commander || f.basic || f.spell !== outFacts.spell) continue;
    if (!f.spell && draftOnly(f.card)) continue;
    const spare = cand.preferred - (inDeck.get(id) ?? 0);
    if (spare <= 0) continue;
    const qty = Math.min(out.qty, spare);
    // Its jobs as earned in the deck after the swap: the outgoing copies out, its copies in.
    let after: DeckCredits | undefined;
    const jobs = jobsOf(
      cand,
      ctx,
      () =>
        (after ??= creditsFor(swapSupply(now.supply, outCard, qty, f.card, qty, config), config)),
    );
    const shared = jobs.filter((j) => outIds.has(j.id));
    const added = jobs.filter((j) => !outIds.has(j.id));
    let score = WEIGHTS.sharedJob * shared.length + WEIGHTS.newJob * added.length - short(qty);
    if (f.spell) {
      score +=
        WEIGHTS.strength * f.strength -
        WEIGHTS.mvStep * Math.min(WEIGHTS.mvCap, Math.abs(f.card.mv - outCard.mv)) +
        (f.creature === outFacts.creature ? WEIGHTS.sameKind : 0);
    } else {
      score += scoreNonbasic(f.card, colors, config, deck.size, styles).score;
    }
    const option: ReplacementOption = { card: f.card, qty, shared, added };
    if (cand.printing) option.printing = cand.printing;
    ranked.push({ option, score });
  }
  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      (a.option.card.name < b.option.card.name
        ? -1
        : a.option.card.name > b.option.card.name
          ? 1
          : 0) ||
      (a.option.card.id < b.option.card.id ? -1 : 1),
  );
  return { card: outCard, qty: out.qty, jobs: outJobs, options: ranked.map((r) => r.option) };
}

/**
 * The deck with `qty` copies of one card swapped for another (all of them
 * when `qty` is at least the copies in the deck). The new card's line says
 * what it replaced; a card already in the deck just gains copies. A basic
 * land in place of a nonbasic raises the deck's basics of its color, and a
 * builder note says what it replaced, since basics have no line of their
 * own. The explanation's curve, roles, land notes, and synergies follow the
 * swap; its score is dropped, since it scored the deck as built.
 */
export function replaceCard(
  deck: Deck,
  outId: string,
  inId: string,
  qty: number,
  index: CardIndex,
  config: BulkBrewConfig,
  printing?: PrintingHint,
): Deck {
  const out = swappable(deck, outId);
  const outCard = index.get(outId);
  const inCard = index.get(inId);
  if (!out || !outCard) throw new Error(`${outCard?.name ?? outId} cannot be swapped out`);
  if (!inCard || inId === outId || inId === deck.commander)
    throw new Error(`${inCard?.name ?? inId} cannot be swapped in`);
  const outFacts = factsFor(index, config, outCard);
  const inFacts = factsFor(index, config, inCard);
  if (outFacts.spell !== inFacts.spell)
    throw new Error('A spell replaces a spell and a land a land');
  const n = Math.max(1, Math.min(Math.floor(qty), out.qty));

  if (inFacts.basic) {
    const color = basicColorOf(inCard, config);
    if (!color || !deckColorsOf(deck).includes(color) || outFacts.basic)
      throw new Error(`${inCard.name} cannot be swapped in`);
    const cards = deck.cards.flatMap((dc): DeckCard[] =>
      dc.cardId !== outId ? [dc] : dc.qty > n ? [{ ...dc, qty: dc.qty - n }] : [],
    );
    const next: Deck = {
      ...deck,
      cards,
      basics: { ...deck.basics, [color]: (deck.basics[color] ?? 0) + n },
    };
    if (deck.explanation) {
      next.explanation = followSwap(
        deck.explanation,
        next,
        deck,
        outFacts,
        inFacts,
        n,
        index,
        config,
      );
    }
    return next;
  }

  const present = deck.cards.some((c) => c.cardId === inId);
  const added: DeckCard = { cardId: inId, qty: n, why: `${SWAP_WHY_PREFIX}${outCard.name}` };
  if (printing) added.printing = printing;
  const cards = deck.cards.flatMap((dc): DeckCard[] => {
    if (dc.cardId === outId) {
      const kept = dc.qty > n ? [{ ...dc, qty: dc.qty - n }] : [];
      return present ? kept : [...kept, added];
    }
    if (dc.cardId === inId) return [{ ...dc, qty: dc.qty + n }];
    return [dc];
  });

  const next: Deck = { ...deck, cards };
  if (deck.explanation) {
    next.explanation = followSwap(
      deck.explanation,
      next,
      deck,
      outFacts,
      inFacts,
      n,
      index,
      config,
    );
  }
  return next;
}

/** The explanation after swapping `n` copies of one card for another; `before` is the deck before it. */
function followSwap(
  e: BuildExplanation,
  deck: Deck,
  before: Deck,
  outFacts: CardFacts,
  inFacts: CardFacts,
  n: number,
  index: CardIndex,
  config: BulkBrewConfig,
): BuildExplanation {
  const colors = deckColorsOf(deck);
  const curve = [...e.curve];
  const roles: BuildExplanation['roles'] = {};
  for (const [id, c] of Object.entries(e.roles)) roles[id] = { ...c };
  const lands = { ...e.lands };
  const sources = e.lands.sources ? { ...e.lands.sources } : undefined;

  if (inFacts.spell) {
    // The builders count the curve, roles, and cheap mana sources over spells only.
    const spells = curve.reduce((a, b) => a + b, 0);
    if (spells > 0) {
      const total = lands.averageMv * spells + (inFacts.card.mv - outFacts.card.mv) * n;
      lands.averageMv = Math.round((total / spells) * 100) / 100;
    }
    const template = templateFor(config, deck.size);
    const move = (f: CardFacts, by: number) => {
      if (f.bucket >= 0) curve[f.bucket] = (curve[f.bucket] ?? 0) + by;
      // Rocks, dorks, and land ramp, as the land formula counts them.
      const cheap = planLandCount(template, [{ facts: f, qty: 1 }], config.landRules.mdfc);
      lands.cheapManaSources += cheap.cheapManaSources * by;
    };
    move(outFacts, -n);
    move(inFacts, n);
  } else if (sources) {
    // A fetch land counts for the colors the deck runs basics of, as the mana base counts it.
    const move = (f: CardFacts, by: number, basics: Deck['basics']) => {
      for (const c of landColors(f.card, colors, deck.size))
        if (!isFetch(f.card) || (basics[c] ?? 0) > 0) sources[c] = (sources[c] ?? 0) + by;
    };
    move(outFacts, -n, before.basics);
    move(inFacts, n, deck.basics);
    // A first basic of a color lets the deck's fetch lands find it.
    for (const c of colors) {
      if ((before.basics[c] ?? 0) > 0 || (deck.basics[c] ?? 0) === 0) continue;
      for (const dc of deck.cards) {
        const card = index.get(dc.cardId);
        if (card && isFetch(card) && landColors(card, colors, deck.size).includes(c))
          sources[c] = (sources[c] ?? 0) + dc.qty;
      }
    }
    lands.sources = sources;
  }
  if (inFacts.basic) lands.nonbasics -= n;

  // A role counts the spells that earn it in their deck, and a swap can change what the
  // other cards earn too, so the counts move by the difference over the whole deck.
  const shift = (d: Deck, by: number) => {
    const credits = deckCredits(d, index, config);
    for (const dc of d.cards) {
      const card = index.get(dc.cardId);
      if (!card || dc.cardId === d.commander) continue;
      const f = factsFor(index, config, card);
      if (!f.spell) continue;
      for (const id of f.roles) {
        const r = roles[id];
        if (r && credits.earned(card, id)) r.have += by * dc.qty;
      }
    }
  };
  shift(before, -1);
  shift(deck, 1);

  const spellList: { facts: CardFacts; qty: number }[] = [];
  for (const dc of deck.cards) {
    const card = index.get(dc.cardId);
    if (!card || dc.cardId === deck.commander) continue;
    const facts = factsFor(index, config, card);
    if (facts.spell) spellList.push({ facts, qty: dc.qty });
  }

  const notes = followNotes(e, lands, sources, outFacts.card.name);
  // Basics have no line of their own to say what they replaced.
  if (inFacts.basic) notes.push(`${n} ${inFacts.card.name} swapped in for ${outFacts.card.name}.`);
  const next: BuildExplanation = {
    ...e,
    curve,
    roles,
    lands,
    synergies: spellSynergyLines(spellList, config),
    notes,
  };
  delete next.score;
  return next;
}

const COLOR_BY_LABEL = new Map(COLORS.map((c) => [COLOR_LABELS[c], c]));

/**
 * The builder notes after a swap: the land line and the colored sources with
 * the new numbers, a stretched color only while it still is, and no note on
 * the copies of the card that went out.
 */
function followNotes(
  e: BuildExplanation,
  lands: BuildExplanation['lands'],
  sources: Partial<Record<Color, number>> | undefined,
  outName: string,
): string[] {
  const oldLand = landNote(
    e.lands.count,
    e.lands.averageMv,
    e.lands.cheapManaSources,
    e.lands.nonbasics,
  );
  const have = (label: string) => sources?.[COLOR_BY_LABEL.get(label) ?? 'W'] ?? 0;
  return e.notes.flatMap((note) => {
    if (note === oldLand)
      return [landNote(lands.count, lands.averageMv, lands.cheapManaSources, lands.nonbasics)];
    if (note.startsWith('Played ') && note.includes(` copies of ${outName}, more than the usual `))
      return [];
    if (!sources) return [note];
    if (note.startsWith('Colored sources: '))
      return [
        note.replace(/(White|Blue|Black|Red|Green) \d+/g, (_, l: string) => `${l} ${have(l)}`),
      ];
    const stretched =
      /^(White|Blue|Black|Red|Green) mana is stretched: \d+ sources where (\d+) /.exec(note);
    if (stretched) {
      const now = have(stretched[1]!);
      if (now >= Number(stretched[2])) return [];
      return [note.replace(/stretched: \d+ sources/, `stretched: ${now} sources`)];
    }
    return [note];
  });
}
