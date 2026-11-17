// Compares the card needs reader with the independent expectations in
// needs-expected.json (written by hand from each card's text, then corrected by
// the coordinator's verdicts). Ported from the reconciliation script.
import { cardNeeds, creditNeeds, type NeedRef } from '../src/card-needs.ts';
import type { BulkBrewConfig } from '../src/config.ts';
import type { CardRecord } from '../src/types.ts';

/**
 * Vocabulary differences, expectation id to reader id. Each is the same
 * resource under another name (the reader keeps `cast:` for spells cast and
 * `spells` for instants and sorceries; the expectation used plain types).
 */
export const ALIASES: Record<string, string> = {
  'cast:artifact': 'type:artifact',
  'cast:enchantment': 'type:enchantment',
  'cast:noncreature': 'type:noncreature',
  'cast:instant-sorcery': 'type:instant-sorcery',
  'cast:sorcery': 'type:instant-sorcery',
  spells: 'type:instant-sorcery',
  'cast:commander': 'commander',
  'cast:tribe:Goblin': 'tribe:Goblin',
  'cast:tribe:Dragon': 'tribe:Dragon',
  'cast:tribe:Villain': 'tribe:Villain',
  'cast:tribe:Demon': 'tribe:Demon',
  'cast:tribe:Spirit': 'tribe:Spirit',
  'cast:subtype:Equipment': 'subtype:Equipment',
  'cast:subtype:Vehicle': 'subtype:Vehicle',
  'cast:subtype:Arcane': 'subtype:Arcane',
  'graveyard:sorcery': 'graveyard:instant-sorcery',
  'graveyard:permanent': 'graveyard:any',
  // Colored spells and permanents: the reader's `colored:` family.
  'cast:W': 'colored:W',
  'cast:creature:B': 'colored:B',
  'creatures:G': 'colored:G',
  'permanents:G': 'colored:G',
  multicolor: 'colored:multi',
  'graveyard:multicolor': 'graveyard:colored:multi',
  // Spells and qualifiers the reader names its own way.
  'cast:kicked': 'cast:kicked',
  'cast:mv7': 'cast:mv:7',
  'land:snow': 'type:snow',
  scry: 'action:scry',
  'keyword:Disturb': 'keyword:disturb',
};

const norm = (r: string) => ALIASES[r] ?? r;

interface Ref {
  kind: string;
  anyOf: string[];
  unparsed?: boolean;
}

const key = (r: Ref) => `${r.kind} ${[...new Set(r.anyOf.map(norm))].sort().join('|')}`;

function dedupe(refs: Ref[]): Ref[] {
  const seen = new Map<string, Ref>();
  for (const r of refs) {
    const k = key(r) + (r.unparsed ? ' U' : '');
    if (!seen.has(k)) seen.set(k, r);
  }
  return [...seen.values()];
}

/** A resource's core, for pairing near misses: graveyard:tribe:Elf has the core tribe:Elf. */
function cores(r: string): string[] {
  const n = norm(r);
  const out = [n];
  let m: RegExpExecArray | null;
  if ((m = /^(?:graveyard|cast):(.+)$/.exec(n))) out.push(m[1]!);
  if ((m = /^(?:type|subtype|tribe|land):(.+)$/.exec(n))) out.push(m[1]!.toLowerCase());
  if ((m = /^(?:graveyard|cast):(?:type:|subtype:|tribe:|land:)?(.+)$/.exec(n)))
    out.push(m[1]!.toLowerCase());
  if (n.startsWith('counters:')) out.push('counters');
  return out;
}

function overlap(a: Ref, b: Ref): number {
  const A = new Set(a.anyOf.map(norm));
  const B = new Set(b.anyOf.map(norm));
  let exact = 0;
  for (const x of A) if (B.has(x)) exact++;
  const ca = new Set(a.anyOf.flatMap(cores));
  const cb = new Set(b.anyOf.flatMap(cores));
  let soft = 0;
  for (const x of ca) if (cb.has(x)) soft++;
  return exact * 10 + soft;
}

const sameRes = (a: Ref, b: Ref) =>
  [...new Set(a.anyOf.map(norm))].sort().join('|') ===
  [...new Set(b.anyOf.map(norm))].sort().join('|');

function lineKey(s: string): string {
  return s
    .replace(/^•\s*/, '')
    .replace(/[’‘]/g, "'")
    .replace(/\s+([.,])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ExpectedCard {
  name: string;
  why: string;
  abilities: { starts: string; face?: number; refs: { kind: string; anyOf: string[] }[] }[];
  selfSupplies: string[];
  credits?: Record<string, string>;
  record: CardRecord;
}

/** One difference: the card, what differs (`ability "<starts>"`, `self`, `credit:<role>`), and how. */
export interface Disagreement {
  card: string;
  item: string;
  detail: string;
}

export interface Comparison {
  abilities: number;
  abilitiesAgree: number;
  disagreements: Disagreement[];
}

export function compareExpectations(
  config: BulkBrewConfig,
  cards: readonly ExpectedCard[],
): Comparison {
  let abilities = 0;
  let abilitiesAgree = 0;
  const out: Disagreement[] = [];
  for (const exp of cards) {
    const rec = exp.record;
    const read = cardNeeds(rec, config);
    const rAbs = read.abilities.map((a) => ({ a, used: false }));
    for (const ea of exp.abilities) {
      abilities++;
      const face = ea.face ?? 0;
      const want = lineKey(ea.starts);
      let hit = rAbs.find(
        (x) => !x.used && x.a.face === face && lineKey(x.a.text).startsWith(want),
      );
      // Ability words and chapter numbers: try the text after a dash.
      hit ??= rAbs.find(
        (x) =>
          !x.used &&
          x.a.face === face &&
          (lineKey(x.a.text).includes(want) ||
            lineKey(x.a.text)
              .replace(/^[^—]*— /, '')
              .startsWith(want)),
      );
      const item = `ability "${ea.starts}"`;
      const eRefs: Ref[] = dedupe(ea.refs.map((r) => ({ kind: r.kind, anyOf: r.anyOf })));
      if (!hit) {
        out.push({ card: exp.name, item, detail: 'no reader ability matches' });
        continue;
      }
      hit.used = true;
      const rRefs: Ref[] = dedupe(
        hit.a.refs.map((r: NeedRef) => ({
          kind: r.kind,
          anyOf: r.anyOf,
          unparsed: r.place === 'unparsed',
        })),
      );
      const eLeft = [...eRefs];
      const rLeft = [...rRefs];
      const diffs: string[] = [];
      const take = (score: (e: Ref, r: Ref) => number, label: string) => {
        for (;;) {
          let best: [number, number, number] | undefined;
          eLeft.forEach((e, i) =>
            rLeft.forEach((r, j) => {
              const s = score(e, r);
              if (s > 0 && (!best || s > best[0])) best = [s, i, j];
            }),
          );
          if (!best) return;
          const [, i, j] = best;
          if (label !== 'agree')
            diffs.push(
              `${label}: expected ${key(eLeft[i]!)}, reader ${key(rLeft[j]!)}${rLeft[j]!.unparsed ? ' (unparsed)' : ''}`,
            );
          eLeft.splice(i, 1);
          rLeft.splice(j, 1);
        }
      };
      take((e, r) => (key(e) === key(r) && !r.unparsed ? 1 : 0), 'agree');
      take((e, r) => (sameRes(e, r) ? 1 : 0), 'kind');
      take((e, r) => (e.kind === r.kind ? overlap(e, r) : 0), 'resource');
      take((e, r) => overlap(e, r), 'kind and resource');
      for (const e of eLeft) diffs.push(`missing: ${key(e)}`);
      for (const r of rLeft) diffs.push(`extra: ${key(r)}${r.unparsed ? ' (unparsed)' : ''}`);
      if (diffs.length === 0) abilitiesAgree++;
      else out.push({ card: exp.name, item, detail: diffs.join('; ') });
    }
    for (const x of rAbs.filter((y) => !y.used))
      out.push({ card: exp.name, item: `reader ability "${x.a.starts}"`, detail: 'not expected' });
    const eSelf = [...new Set(exp.selfSupplies.map(norm))].sort();
    const rSelf = [...new Set(read.selfSupplies.map(norm))].sort();
    if (eSelf.join('|') !== rSelf.join('|'))
      out.push({
        card: exp.name,
        item: 'self',
        detail: `expected [${eSelf.join(', ')}], reader [${rSelf.join(', ')}]`,
      });
    for (const [role, want] of Object.entries(exp.credits ?? {})) {
      const c = creditNeeds(rec, role, config, 60);
      const got = c.kind === 'untied' ? c.clauses[0]!.kind : c.kind;
      if (got !== want)
        out.push({
          card: exp.name,
          item: `credit:${role}`,
          detail: `expected ${want}, reader ${c.kind}${c.kind === 'untied' ? ` (${got})` : ''}`,
        });
    }
  }
  return { abilities, abilitiesAgree, disagreements: out };
}
