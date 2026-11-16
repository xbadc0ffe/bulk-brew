import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DeckJob, ReplacementOption, Replacements } from '@bulk-brew/core';
import { copiesOf } from '../data/deckGroups.ts';
import { ui } from '../styles.ts';
import { CardImage } from './CardImage.tsx';
import { TextCard } from './TextCard.tsx';
import { useModal } from './useModal.ts';

/** Options shown at first and added by each Show more. */
const PAGE = 12;

const labels = (jobs: DeckJob[]) => jobs.map((j) => j.label);

/**
 * Pick a card from the bulk list to take the place of one deck card: the
 * closest matches first, as card images when art is on and as text cards
 * otherwise, with the jobs each shares with the card going out. Shows while
 * `replacements` is set; Escape and the backdrop cancel.
 */
export function ReplaceDialog(props: {
  replacements: Replacements | undefined;
  showArt: boolean;
  onPick(option: ReplacementOption): void;
  onCancel(): void;
}) {
  if (!props.replacements) return null;
  // A new card starts with nothing picked and the first page shown.
  return <Picker key={props.replacements.card.id} {...props} replacements={props.replacements} />;
}

function Picker(props: {
  replacements: Replacements;
  showArt: boolean;
  onPick(option: ReplacementOption): void;
  onCancel(): void;
}) {
  const { replacements: r, showArt, onPick } = props;
  const id = useId();
  const [picked, setPicked] = useState<string>();
  const [shown, setShown] = useState(PAGE);
  const first = useRef<HTMLButtonElement>(null);
  const cancel = useModal(true, props.onCancel, first);
  const choice = r.options.find((o) => o.card.id === picked);
  const visible = r.options.slice(0, shown);
  const jobs = labels(r.jobs);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancel"
        tabIndex={-1}
        className="absolute inset-0 bg-black/40"
        onClick={() => cancel.current()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-message`}
        className="relative flex max-h-[90dvh] w-full max-w-[920px] flex-col rounded-xl border border-line bg-surface"
      >
        <header className="flex flex-col gap-1.5 border-b border-line px-5 pt-5 pb-4">
          <h2 id={`${id}-title`} className="text-[16px] font-semibold">
            Replace {r.card.name}
          </h2>
          <p id={`${id}-message`} className="text-[13px] leading-[1.5] text-fg-1">
            {r.qty > 1 ? `${r.qty} copies in this deck. ` : ''}
            {jobs.length > 0
              ? `It counts as ${jobs.join(', ')}. `
              : 'It fills no role or theme the deck counts. '}
            These cards from your bulk list fit the deck, closest matches first.
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {r.options.length === 0 ? (
            <p className={ui.note}>
              Nothing in your bulk list can take its place: no card of the same kind that fits this
              deck has a copy to spare.
            </p>
          ) : (
            <>
              {/* Text cards need more width than images to stay readable. */}
              <ul
                className={`grid gap-3 ${showArt ? 'grid-cols-[repeat(auto-fill,minmax(150px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(190px,1fr))]'}`}
              >
                {visible.map((o, i) => {
                  const on = o.card.id === picked;
                  const partial = o.qty < r.qty ? `Replaces ${o.qty} of ${r.qty} copies` : '';
                  const name = [o.card.name, ...labels(o.shared), ...labels(o.added), partial]
                    .filter(Boolean)
                    .join(', ');
                  return (
                    <li key={o.card.id} className="flex">
                      <button
                        ref={i === 0 ? first : undefined}
                        type="button"
                        aria-pressed={on}
                        aria-label={name}
                        title={o.card.name}
                        onClick={() => setPicked(o.card.id)}
                        onDoubleClick={() => onPick(o)}
                        className={`flex w-full flex-col gap-1.5 rounded-lg border p-1.5 text-left ${
                          on
                            ? 'border-ink bg-surface-2 ring-2 ring-ink'
                            : 'border-line hover:border-line-strong hover:bg-surface-2'
                        }`}
                      >
                        {showArt ? (
                          <CardImage
                            card={o.card}
                            printing={o.printing}
                            size="normal"
                            className="block h-auto w-full rounded-[4.75%/3.4%]"
                            fallback={<TextCard card={o.card} />}
                          />
                        ) : (
                          <TextCard card={o.card} />
                        )}
                        <JobLine option={o} />
                        {partial && <span className="text-[11px] text-fg-2">{partial}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {r.options.length > shown && (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    className={ui.secondary}
                    onClick={() => setShown((n) => n + PAGE)}
                  >
                    Show more ({r.options.length - shown} left)
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-5 py-3.5">
          <p aria-live="polite" className="min-w-0 flex-1 text-[13px] text-fg-1">
            {choice
              ? `Swap ${copiesOf(choice.qty, r.card.name, r.qty)} for ${copiesOf(choice.qty, choice.card.name)}.`
              : r.options.length > 0
                ? 'Pick a card to swap in.'
                : ''}
          </p>
          <div className="ml-auto flex gap-2">
            <button
              ref={r.options.length === 0 ? first : undefined}
              type="button"
              className={ui.secondary}
              onClick={() => cancel.current()}
            >
              Cancel
            </button>
            <button
              type="button"
              className={ui.go}
              disabled={!choice}
              onClick={() => choice && onPick(choice)}
            >
              Replace
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

/** The jobs an option shares with the card going out in bold, then the ones it adds. */
function JobLine({ option }: { option: ReplacementOption }) {
  const shared = labels(option.shared);
  const added = labels(option.added);
  if (shared.length === 0 && added.length === 0)
    return <span className="text-[11.5px] text-fg-2">No role the deck counts</span>;
  return (
    <span className="text-[11.5px] leading-snug">
      {shared.length > 0 && <span className="font-semibold text-ink">{shared.join(' · ')}</span>}
      {shared.length > 0 && added.length > 0 && <span className="text-fg-2"> · </span>}
      {added.length > 0 && <span className="text-fg-2">{added.join(' · ')}</span>}
    </span>
  );
}
