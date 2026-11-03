import type { DeckSize } from '@bulk-brew/core';
import { CONFIG_PROBLEMS } from '@bulk-brew/ui';
import { useAppState } from '../app-context.ts';

const muted = 'text-sm text-zinc-600 dark:text-zinc-400';
const input =
  'w-16 rounded border border-zinc-300 bg-white px-2 py-1 text-base disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900';
const button =
  'rounded border border-zinc-300 bg-white px-3 py-2 text-sm active:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900';

export function SettingsScreen() {
  const { pack, settings } = useAppState();
  const s = settings.settings;
  // Controls wait for the stored settings so an early edit cannot be overwritten.
  const ready = settings.loaded;

  return (
    <div className="flex flex-col gap-5 text-sm">
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Copies per card</h2>
        {([60, 40, 20] as DeckSize[]).map((size) => (
          <label key={size} className="flex items-center justify-between py-1">
            {size}-card deck
            <input
              type="number"
              min={1}
              max={99}
              disabled={!ready}
              value={s.maxCopies[size]}
              onChange={(e) =>
                settings.update({
                  maxCopies: { ...s.maxCopies, [size]: Math.max(1, Number(e.target.value) || 1) },
                })
              }
              className={input}
            />
          </label>
        ))}
        <p className={muted}>Basic lands are never limited.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Pool</h2>
        <label className="flex items-center gap-3 py-1">
          <input
            type="checkbox"
            disabled={!ready}
            checked={s.unlimitedBasics}
            onChange={(e) => settings.update({ unlimitedBasics: e.target.checked })}
          />
          Basic lands are unlimited
        </label>
        <label className="flex items-center gap-3 py-1">
          <input
            type="checkbox"
            disabled={!ready}
            checked={s.includeUnsets}
            onChange={(e) => settings.update({ includeUnsets: e.target.checked })}
          />
          Include Un-set and acorn cards
        </label>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Display</h2>
        <label className="flex items-center gap-3 py-1">
          <input
            type="checkbox"
            disabled={!ready}
            checked={s.showArt}
            onChange={(e) => settings.update({ showArt: e.target.checked })}
          />
          Show card art (coming with the card detail view)
        </label>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Card data</h2>
        <p className={muted}>
          {pack.status === 'ready'
            ? `Version ${pack.index.version}, ${pack.index.size} cards.`
            : pack.status === 'loading'
              ? 'Loading.'
              : `Failed to load: ${pack.error}`}
        </p>
        {CONFIG_PROBLEMS.length > 0 && (
          <div className="text-amber-600">
            <p>The shipped config has problems:</p>
            <ul className="list-disc pl-5">
              {CONFIG_PROBLEMS.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">About</h2>
        <p className={muted}>
          Bulk Brew is unofficial Fan Content permitted under the Fan Content Policy. Not approved
          or endorsed by Wizards. Portions of the materials used are property of Wizards of the
          Coast. Card data and images come from Scryfall, which is not affiliated with this project.
          Open source under the MIT License.
        </p>
        <button type="button" className={button} disabled={!ready} onClick={settings.reset}>
          Reset settings to defaults
        </button>
      </section>
    </div>
  );
}
