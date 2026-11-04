// The subset of Scryfall's card and tag objects the pipeline reads.
// Field names follow Scryfall exactly. See https://scryfall.com/docs/api/cards

export interface ScryfallFace {
  name: string;
  mana_cost: string;
  type_line?: string;
  oracle_text?: string;
  colors?: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  defense?: string;
}

export interface ScryfallCard {
  id: string;
  oracle_id?: string;
  name: string;
  layout: string;
  mana_cost?: string;
  cmc?: number;
  type_line?: string;
  oracle_text?: string;
  colors?: string[];
  color_identity: string[];
  keywords?: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  produced_mana?: string[];
  card_faces?: ScryfallFace[];
  games?: string[];
  set: string;
  set_type?: string;
  security_stamp?: string;
  legalities?: Record<string, string>;
  oversized?: boolean;
  game_changer?: boolean;
  edhrec_rank?: number;
}

export interface TaggerTagging {
  oracle_id: string;
  weight: string;
}

export interface TaggerTag {
  id: string;
  slug: string;
  type: string;
  parent_ids: string[];
  taggings: TaggerTagging[];
}
