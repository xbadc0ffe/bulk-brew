/** Mana curve as simple bars: spell counts for cost 0 through 7-plus. */
export function CurveBars({ curve }: { curve: number[] }) {
  const max = Math.max(1, ...curve);
  return (
    <div className="flex items-end gap-1" aria-label="Mana curve">
      {curve.map((n, i) => (
        <div key={i} className="flex w-7 flex-col items-center gap-1 text-[10px]">
          <span className="tabular-nums">{n}</span>
          <div
            className="w-full rounded-t bg-zinc-400 dark:bg-zinc-500"
            style={{ height: `${Math.max(2, (n / max) * 48)}px` }}
            title={`${n} spells at cost ${i === 7 ? '7+' : i}`}
          />
          <span className="text-zinc-500">{i === 7 ? '7+' : i}</span>
        </div>
      ))}
    </div>
  );
}
