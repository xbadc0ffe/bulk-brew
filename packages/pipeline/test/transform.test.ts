import { describe, expect, it } from 'vitest';
import { isPlayable, isUnset, parseTypes, rarityOf, toCardRecord } from '../src/transform.ts';
import type { ScryfallCard } from '../src/scryfall.ts';

/** Copy of a card without the given keys, since Scryfall omits absent fields. */
function without<K extends keyof ScryfallCard>(
  card: ScryfallCard,
  ...keys: K[]
): Omit<ScryfallCard, K> {
  const copy: Record<string, unknown> = { ...card };
  for (const k of keys) delete copy[k];
  return copy as Omit<ScryfallCard, K>;
}

const base: ScryfallCard = {
  id: 'print-1',
  oracle_id: 'oracle-1',
  name: 'Test Card',
  layout: 'normal',
  mana_cost: '{1}{G}',
  cmc: 2,
  type_line: 'Creature — Elf',
  oracle_text: 'Trample',
  colors: ['G'],
  color_identity: ['G'],
  keywords: ['Trample'],
  power: '2',
  toughness: '2',
  games: ['paper'],
  set: 'tst',
  set_type: 'expansion',
  legalities: { vintage: 'legal' },
};

describe('isPlayable', () => {
  it('keeps ordinary paper cards', () => {
    expect(isPlayable(base)).toBe(true);
  });
  it('keeps paper cards whose listed printing is digital', () => {
    expect(isPlayable({ ...base, games: ['mtgo'] })).toBe(true);
  });
  it('drops Alchemy designs, tokens, and non-deck objects', () => {
    expect(isPlayable({ ...base, set_type: 'alchemy', games: ['arena'] })).toBe(false);
    expect(isPlayable({ ...base, layout: 'token' })).toBe(false);
    expect(isPlayable({ ...base, layout: 'art_series' })).toBe(false);
    expect(isPlayable({ ...base, type_line: 'Token Creature — Elf' })).toBe(false);
    expect(isPlayable({ ...base, type_line: 'Conspiracy' })).toBe(false);
    expect(isPlayable({ ...base, oversized: true })).toBe(false);
  });
});

describe('isUnset', () => {
  it('flags acorn, playtest, and funny-set cards with no legality', () => {
    expect(isUnset({ ...base, security_stamp: 'acorn' })).toBe(true);
    expect(isUnset({ ...base, set: 'cmb1', set_type: 'funny' })).toBe(true);
    expect(isUnset({ ...base, set_type: 'funny', legalities: { vintage: 'not_legal' } })).toBe(
      true,
    );
  });
  it('keeps eternal-legal cards from funny sets', () => {
    expect(isUnset({ ...base, set_type: 'funny', legalities: { vintage: 'legal' } })).toBe(false);
  });
});

describe('parseTypes', () => {
  it('reads supertypes, types, and old Tribal wording', () => {
    expect(parseTypes('Legendary Artifact Creature — Golem')).toEqual(['artifact', 'creature']);
    expect(parseTypes('Tribal Instant — Elf')).toEqual(['kindred', 'instant']);
    expect(parseTypes('Basic Land — Forest')).toEqual(['land']);
  });
});

describe('toCardRecord', () => {
  it('trims a normal card', () => {
    const rec = toCardRecord(base, ['trample-matters']);
    expect(rec).toMatchObject({
      id: 'oracle-1',
      name: 'Test Card',
      manaCost: '{1}{G}',
      mv: 2,
      colors: ['G'],
      identity: ['G'],
      types: ['creature'],
      power: '2',
      img: 'print-1',
      tags: ['trample-matters'],
    });
    expect(rec.faces).toBeUndefined();
    expect(rec.unset).toBeUndefined();
  });

  it('uses the front face for transforming cards', () => {
    const rec = toCardRecord(
      {
        ...without(base, 'colors', 'power', 'toughness'),
        name: 'Front // Back',
        layout: 'transform',
        type_line: 'Creature — Human // Creature — Wolf',
        card_faces: [
          {
            name: 'Front',
            mana_cost: '{1}{R}',
            type_line: 'Creature — Human',
            oracle_text: 'A',
            colors: ['R'],
            power: '1',
            toughness: '1',
          },
          {
            name: 'Back',
            mana_cost: '',
            type_line: 'Creature — Wolf',
            oracle_text: 'B',
            colors: ['R'],
            power: '3',
            toughness: '3',
          },
        ],
      },
      [],
    );
    expect(rec.manaCost).toBe('{1}{R}');
    expect(rec.colors).toEqual(['R']);
    expect(rec.power).toBe('1');
    expect(rec.types).toEqual(['creature']);
    expect(rec.text).toBe('A\n//\nB');
    expect(rec.faces?.map((f) => f.name)).toEqual(['Front', 'Back']);
  });

  it('counts a modal land face as a land and a spell', () => {
    const rec = toCardRecord(
      {
        ...without(base, 'colors'),
        name: 'Spell // Place',
        layout: 'modal_dfc',
        card_faces: [
          {
            name: 'Spell',
            mana_cost: '{3}{W}',
            type_line: 'Creature — Human',
            oracle_text: 'X',
            colors: ['W'],
          },
          {
            name: 'Place',
            mana_cost: '',
            type_line: 'Land',
            oracle_text: 'This land enters tapped.',
            colors: [],
          },
        ],
      },
      [],
    );
    expect(rec.types).toEqual(['creature', 'land']);
    expect(rec.entersTapped).toBe(true);
  });

  it('keeps both halves of adventure and split cards with inherited colors', () => {
    const rec = toCardRecord(
      {
        ...base,
        name: 'Beast // Trick',
        layout: 'adventure',
        mana_cost: '{3}{B} // {B}',
        cmc: 4,
        type_line: 'Creature — Horror // Sorcery — Adventure',
        colors: ['B'],
        card_faces: [
          {
            name: 'Beast',
            mana_cost: '{3}{B}',
            type_line: 'Creature — Horror',
            oracle_text: 'Menace',
            power: '4',
            toughness: '3',
          },
          {
            name: 'Trick',
            mana_cost: '{B}',
            type_line: 'Sorcery — Adventure',
            oracle_text: 'Do a thing.',
          },
        ],
      },
      [],
    );
    expect(rec.manaCost).toBe('{3}{B}');
    expect(rec.types).toEqual(['creature']);
    expect(rec.faces?.[1]).toMatchObject({ name: 'Trick', manaCost: '{B}', colors: ['B'] });
  });

  it('marks taplands and un-set cards', () => {
    const land = toCardRecord(
      {
        ...base,
        name: 'Slow Land',
        mana_cost: '',
        cmc: 0,
        type_line: 'Land',
        oracle_text: 'Slow Land enters the battlefield tapped.',
        colors: [],
        produced_mana: ['G'],
      },
      [],
    );
    expect(land.entersTapped).toBe(true);
    expect(land.produces).toEqual(['G']);
    const silly = toCardRecord({ ...base, security_stamp: 'acorn' }, []);
    expect(silly.unset).toBe(true);
  });

  it('keeps Commander legality, the Game Changer flag, and the popularity rank', () => {
    const plain = toCardRecord({ ...base, legalities: { commander: 'legal' } }, []);
    expect(plain.commanderLegality).toBeUndefined();
    expect(plain.gameChanger).toBeUndefined();
    expect(plain.rank).toBeUndefined();
    const flagged = toCardRecord(
      { ...base, legalities: { commander: 'banned' }, game_changer: true, edhrec_rank: 42 },
      [],
    );
    expect(flagged).toMatchObject({ commanderLegality: 'banned', gameChanger: true, rank: 42 });
    const unreleased = toCardRecord({ ...base, legalities: { commander: 'not_legal' } }, []);
    expect(unreleased.commanderLegality).toBe('not_legal');
  });
});

describe('rarityOf', () => {
  it('keeps the four rarities and stores special and bonus as rare', () => {
    expect(rarityOf('common')).toBe('common');
    expect(rarityOf('mythic')).toBe('mythic');
    expect(rarityOf('special')).toBe('rare');
    expect(rarityOf('bonus')).toBe('rare');
    expect(rarityOf(undefined)).toBeUndefined();
    expect(toCardRecord({ ...base, rarity: 'uncommon' }, []).rarity).toBe('uncommon');
  });
});
