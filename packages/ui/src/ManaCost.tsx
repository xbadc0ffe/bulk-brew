const SYMBOL = /\{([^}]+)\}/g;

/** Renders a Scryfall mana cost string like "{1}{G}{G}" as inline symbols. */
export function ManaCost({ cost }: { cost: string | undefined }) {
  if (!cost) return null;
  const symbols = Array.from(cost.matchAll(SYMBOL), (m) => m[1] ?? '');
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={cost}>
      {symbols.map((s, i) => (
        <span key={i} className={`mana mana-${s.toLowerCase().replace('/', '')}`}>
          {s}
        </span>
      ))}
    </span>
  );
}
