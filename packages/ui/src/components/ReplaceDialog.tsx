import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { DeckJob, PrintingHint, ReplacementOption, Replacements } from '@bulk-brew/core';
import { copiesOf } from '../data/deckGroups.ts';
import { useMediaQuery } from '../data/useMediaQuery.ts';
import { ui } from '../styles.ts';
import { CardArt } from './CardArt.tsx';
import { CardImage } from './CardImage.tsx';
import { TextCard } from './TextCard.tsx';
import { useModal } from './useModal.ts';

/** Options shown at first and added by each Show more. */
const PAGE = 12;

const labels = (jobs: DeckJob[]) => jobs.map((j) => j.label);

/**
 * Pick a card from the bulk list to take the place of one deck card: the
 * closest matches first, as card images when art is on and as text cards
 * otherwise, with the jobs each shares with the card going out. The picked
 * card shows large beside the list, or over it on a narrow window. Shows
 * while `replacements` is set; Escape and the backdrop cancel.
 */
export function ReplaceDialog(props: {
  replacements: Replacements | undefined;
  /** The printing the deck shows for the card going out. */
  printing?: PrintingHint | undefined;
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
  printing?: PrintingHint | undefined;
  showArt: boolean;
  onPick(option: ReplacementOption): void;
  onCancel(): void;
}) {
  const { replacements: r, showArt, onPick, onCancel } = props;
  const id = useId();
  const wide = useMediaQuery('(min-width: 768px)');
  const [picked, setPicked] = useState<string>();
  // On a narrow window the picked card covers the list until Back.
  const [zoomed, setZoomed] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const first = useRef<HTMLButtonElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const choice = r.options.find((o) => o.card.id === picked);
  const covered = !wide && zoomed && choice !== undefined;
  const visible = r.options.slice(0, shown);
  const jobs = labels(r.jobs);

  const unzoom = () => {
    setZoomed(false);
    // Back on the tile that was open, once the list is usable again.
    requestAnimationFrame(() =>
      list.current?.querySelector<HTMLElement>(`[data-option-id="${picked}"]`)?.focus(),
    );
  };
  // Escape steps back from the large card before it closes the dialog.
  useModal(true, () => (covered ? unzoom() : onCancel()), first);
  useEffect(() => {
    if (covered) back.current?.focus();
  }, [covered, picked]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancel"
        tabIndex={-1}
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-message`}
        className="relative flex max-h-[92dvh] w-full max-w-[max(1200px,75rem)] flex-col rounded-xl border border-line bg-surface"
      >
        <header className="flex flex-col gap-1.5 border-b border-line px-5 pt-5 pb-4">
          <h2 id={`${id}-title`} className="text-[1rem] font-semibold">
            Replace {r.card.name}
          </h2>
          <p id={`${id}-message`} className="text-[0.8125rem] leading-[1.5] text-fg-1">
            {r.qty > 1 ? `${r.qty} copies in this deck. ` : ''}
            {jobs.length > 0
              ? `It counts as ${jobs.join(', ')}. `
              : 'It fills no role or theme the deck counts. '}
            These cards fit the deck, closest matches first.
          </p>
        </header>

        <div className="relative flex min-h-0 flex-1">
          <div inert={covered} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {r.options.length === 0 ? (
              <p className={ui.note}>
                Nothing in your bulk list can take its place: no card of the same kind that fits
                this deck has a copy to spare.
              </p>
            ) : (
              <>
                {/* Text cards need more width than images to stay readable. */}
                <ul
                  ref={list}
                  className={`grid gap-3 ${
                    showArt
                      ? 'grid-cols-[repeat(auto-fill,minmax(max(140px,8.75rem),1fr))] md:grid-cols-[repeat(auto-fill,minmax(max(170px,10.625rem),1fr))]'
                      : 'grid-cols-[repeat(auto-fill,minmax(max(190px,11.875rem),1fr))] md:grid-cols-[repeat(auto-fill,minmax(max(210px,13.125rem),1fr))]'
                  }`}
                >
                  {visible.map((o, i) => {
                    const on = o.card.id === picked;
                    const partial = partialOf(o, r);
                    const name = [o.card.name, ...labels(o.shared), ...labels(o.added), partial]
                      .filter(Boolean)
                      .join(', ');
                    return (
                      <li key={o.card.id} className="flex">
                        <button
                          ref={i === 0 ? first : undefined}
                          type="button"
                          data-option-id={o.card.id}
                          aria-pressed={on}
                          aria-label={name}
                          title={o.card.name}
                          onClick={() => {
                            setPicked(o.card.id);
                            setZoomed(true);
                          }}
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
                          {partial && <span className="text-[0.75rem] text-fg-2">{partial}</span>}
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
          {r.options.length > 0 && (wide || covered) && (
            <Preview
              replacements={r}
              printing={props.printing}
              choice={choice}
              showArt={showArt}
              className={
                wide
                  ? 'w-[max(360px,22.5rem)] shrink-0 border-l border-line'
                  : 'absolute inset-0 bg-surface'
              }
              action={
                !wide && (
                  <button
                    ref={back}
                    type="button"
                    className={`${ui.quiet} text-[0.8125rem] font-semibold`}
                    onClick={unzoom}
                  >
                    Back to the list
                  </button>
                )
              }
            />
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-5 py-3.5">
          <p aria-live="polite" className="min-w-0 flex-1 text-[0.8125rem] text-fg-1">
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
              onClick={onCancel}
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

const partialOf = (o: ReplacementOption, r: Replacements) =>
  o.qty < r.qty ? `Replaces ${o.qty} of ${r.qty} copies` : '';

/**
 * The picked card at a readable size, or the card going out until one is
 * picked.
 */
function Preview(props: {
  replacements: Replacements;
  printing: PrintingHint | undefined;
  choice: ReplacementOption | undefined;
  showArt: boolean;
  className: string;
  /** Shown beside the heading. */
  action: ReactNode;
}) {
  const { replacements: r, choice, showArt } = props;
  const card = choice?.card ?? r.card;
  const printing = choice ? choice.printing : props.printing;
  const heading = choice ? 'Coming in' : 'Going out';
  const jobs = labels(r.jobs);
  const partial = choice ? partialOf(choice, r) : '';
  return (
    <section
      aria-label={`${heading}: ${card.name}`}
      className={`flex flex-col gap-3 overflow-y-auto px-5 py-4 ${props.className}`}
    >
      <div className="flex min-h-7 items-center justify-between gap-3">
        <h3 className={ui.sectionLabel}>{heading}</h3>
        {props.action}
      </div>
      {showArt ? (
        // A new image element per card, so the last card never shows under the new name.
        <CardArt
          key={card.id}
          card={card}
          printing={printing}
          size="large"
          zoom={false}
          frameClassName="mx-auto w-full max-w-[max(360px,22.5rem)]"
          className="block aspect-[672/936] h-auto w-full rounded-[4.75%/3.4%] bg-surface-2"
          fallback={<TextCard card={card} full />}
        />
      ) : (
        <TextCard card={card} full className="mx-auto max-w-[max(360px,22.5rem)]" />
      )}
      <div className="mx-auto flex w-full max-w-[max(360px,22.5rem)] flex-col gap-1">
        {choice ? (
          <JobLine option={choice} big />
        ) : (
          <span className="text-[0.8125rem] leading-snug text-fg-1">
            {jobs.length > 0
              ? `Counts as ${jobs.join(' · ')}`
              : 'Fills no role or theme the deck counts'}
          </span>
        )}
        {partial && <span className="text-[0.8125rem] text-fg-2">{partial}</span>}
      </div>
    </section>
  );
}

/** The jobs an option shares with the card going out in bold, then the ones it adds. */
function JobLine({ option, big = false }: { option: ReplacementOption; big?: boolean }) {
  const shared = labels(option.shared);
  const added = labels(option.added);
  const size = big ? 'text-[0.8125rem]' : 'text-[0.75rem]';
  if (shared.length === 0 && added.length === 0)
    return <span className={`${size} text-fg-2`}>No role the deck counts</span>;
  return (
    <span className={`${size} leading-snug`}>
      {shared.length > 0 && <span className="font-semibold text-ink">{shared.join(' · ')}</span>}
      {shared.length > 0 && added.length > 0 && <span className="text-fg-2"> · </span>}
      {added.length > 0 && <span className="text-fg-2">{added.join(' · ')}</span>}
    </span>
  );
}
