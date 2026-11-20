import { useState, type MouseEvent, type ReactNode } from 'react';
import {
  COLOR_LABELS,
  deckToDecklist,
  type Deck,
  type ReplacementOption,
  type Replacements,
} from '@bulk-brew/core';
import {
  CardDetail,
  ChoiceDialog,
  ConfirmDialog,
  DeckExplanation,
  deckColors,
  DeckCounts,
  deckFilename,
  DeckList,
  Pip,
  ReplaceDialog,
  Sheet,
  ui,
  useMediaQuery,
} from '@bulk-brew/ui';
import { useAppState } from '../app-context.ts';
import { isNative, saveText } from '../native.ts';

// The app hands the file to the share sheet, where Save to Files is one choice.
const SAVE_LABEL = isNative ? 'Share .txt' : 'Download .txt';
const SAVE_DETAIL = isNative ? 'Save it to Files or send it' : 'Save it as a text file';

/**
 * Export asks in a popup, as Remove does: Copy as text, Download .txt (Share
 * .txt in the app), or Cancel. Reports the copy through onStatus.
 */
export function ExportButton({ deck, onStatus }: { deck: Deck; onStatus(text: string): void }) {
  const { index, config } = useAppState();
  const [open, setOpen] = useState(false);
  if (!index) return null;
  const text = () => deckToDecklist(deck, index, config);
  return (
    <>
      <button type="button" className={ui.neutral} onClick={() => setOpen(true)}>
        Export
      </button>
      <ChoiceDialog
        open={open}
        title={`Export "${deck.name}"`}
        message="As a plain text decklist, one card per line."
        choices={[
          {
            label: 'Copy as text',
            detail: 'Paste it into another app or site',
            tone: 'go-soft',
            onSelect: () => {
              setOpen(false);
              navigator.clipboard.writeText(text()).then(
                () => onStatus(`Copied "${deck.name}" to the clipboard.`),
                () => onStatus(`Copy failed. Try ${SAVE_LABEL} instead.`),
              );
            },
          },
          {
            label: SAVE_LABEL,
            detail: SAVE_DETAIL,
            tone: 'go-soft',
            onSelect: () => {
              setOpen(false);
              saveText(deckFilename(deck.name), text(), 'text/plain').catch((err: unknown) =>
                onStatus(`Sharing failed: ${err instanceof Error ? err.message : String(err)}`),
              );
            },
          },
          { label: 'Cancel', tone: 'stop-soft', onSelect: () => setOpen(false) },
        ]}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

/**
 * Asked before leaving a fresh build whose cards were swapped, which drops
 * the swaps: Back, Build in the sidebar, or another deck from Analyze.
 */
export function DiscardSwapsDialog(props: {
  open: boolean;
  edits: number;
  /** What leaving does, such as "Going back". */
  leaving?: string;
  confirmLabel?: string;
  onDiscard(): void;
  onCancel(): void;
}) {
  const { leaving = 'Going back', confirmLabel = 'Discard and go back' } = props;
  return (
    <ConfirmDialog
      open={props.open}
      title="Discard your changes?"
      message={`You replaced ${props.edits === 1 ? 'a card' : 'cards'} in the deck you built. ${leaving} loses those changes. Accept the deck to keep them.`}
      confirmLabel={confirmLabel}
      cancelLabel="Keep editing"
      onConfirm={props.onDiscard}
      onCancel={props.onCancel}
    />
  );
}

/**
 * The card detail over the right side of a deck view's body, below its
 * header, so the header's actions stay in view. Its parent must be
 * positioned. Below 1024px it is a sheet that rolls up from the bottom.
 * The card's tags show what it earns in `deck`. With `onReplace`, the card
 * gets a Replace button.
 */
export function DeckCardPanel({
  deck,
  onReplace,
}: {
  deck: Deck | undefined;
  onReplace?: ((cardId: string) => void) | undefined;
}) {
  const { detail, index, config, settings, decks, pool } = useAppState();
  const wide = useMediaQuery('(min-width: 1024px)');
  const open = detail.current;
  const card = open && index ? index.get(open.cardId) : undefined;
  if (!card || !index) return null;
  const inDecks = decks.decks.filter((d) => d.cards.some((c) => c.cardId === card.id));
  const body = (sheet: boolean) => (
    <CardDetail
      card={card}
      printing={open?.printing}
      index={index}
      config={config}
      showArt={settings.settings.showArt}
      qty={pool.pool.entries[card.id]?.qty ?? 0}
      inDecks={inDecks.map((d) => d.name)}
      deck={deck}
      onClose={sheet ? undefined : detail.close}
      onReplace={onReplace ? () => onReplace(card.id) : undefined}
      variant={sheet ? 'phone' : 'desktop'}
    />
  );
  // A swipe moves through the deck's cards in the order the list shows them, around the ends.
  const stepCard = (direction: 1 | -1) => {
    const rows = [...document.querySelectorAll<HTMLElement>('#root [data-card-id]')];
    const ids = [...new Set(rows.map((r) => r.dataset.cardId!))];
    if (ids.length < 2) return;
    const id = ids[(Math.max(0, ids.indexOf(card.id)) + direction + ids.length) % ids.length]!;
    const printing = deck?.cards.find((c) => c.cardId === id)?.printing;
    detail.open(id, printing, rows.find((r) => r.dataset.cardId === id) ?? null);
  };
  if (!wide)
    return (
      <Sheet open onClose={detail.close} label="Card detail" onStep={stepCard} stepName="card">
        {body(true)}
      </Sheet>
    );
  return (
    <aside
      className="absolute inset-y-0 right-0 z-30 w-[320px] max-w-full overflow-y-auto border-l border-line bg-surface p-[22px]"
      aria-label="Card detail"
    >
      {body(false)}
    </aside>
  );
}

/** Swapping cards of a deck that can still change, such as a fresh build. */
export interface DeckReplace {
  /** Cards that can take the place of one deck card. */
  options(cardId: string): Replacements | undefined;
  apply(cardId: string, option: ReplacementOption): void;
}

/**
 * The deck view for a fresh build and a saved deck: a header bar with the
 * actions, the list grouped by type, and the details on the right. The
 * handle on the divider widens the details to half the screen. A card opens
 * over the details; with `replace`, it can be swapped for another card.
 * A phone gets one scrolling page with the actions pinned under it.
 */
export function DeckLayout(props: {
  deck: Deck;
  title?: ReactNode;
  meta: string;
  /** Before the title, such as a back button. */
  lead?: ReactNode;
  actions: ReactNode;
  status?: string | undefined;
  replace?: DeckReplace | undefined;
}) {
  const { index, config, settings, detail } = useAppState();
  const [wide, setWide] = useState(false);
  const phone = useMediaQuery('(max-width: 767.98px)');
  const [replacing, setReplacing] = useState<Replacements>();
  const { deck, replace } = props;
  if (!index) return null;
  const colors = deckColors(deck, index);
  // The commander and basics stay; any other card of the deck can be swapped.
  const canReplace = (id: string) =>
    id !== deck.commander && deck.cards.some((c) => c.cardId === id);
  const pips = (
    <span className="flex gap-1">
      {colors.map((c) => (
        <Pip key={c} symbol={c} size={20} label={COLOR_LABELS[c]} />
      ))}
    </span>
  );
  const title = props.title ?? <h1 className="text-[1.0625rem] font-semibold">{deck.name}</h1>;
  const list = (
    <DeckList
      deck={deck}
      index={index}
      config={config}
      showArt={settings.settings.showArt}
      onOpenCard={detail.open}
      singleColumn={wide}
    />
  );
  const cardPanel = (
    <DeckCardPanel
      deck={deck}
      onReplace={
        replace && detail.current && canReplace(detail.current.cardId)
          ? (id) => setReplacing(replace.options(id))
          : undefined
      }
    />
  );
  // Any action closes the card detail.
  const dismissOnAction = (e: MouseEvent) => {
    if ((e.target as Element).closest('button')) detail.dismiss();
  };
  return (
    <div className="flex h-full flex-col">
      {phone ? (
        // Phone: one scrolling page, the name and a short overview first, then the
        // cards and the details, with the actions held at the bottom in reach of a thumb.
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <header className="flex flex-col items-center gap-1.5 bg-surface px-4 pt-4 pb-3 text-center">
              {pips}
              {title}
              <span className="text-[0.78125rem] text-fg-1">{props.meta}</span>
            </header>
            <div className="border-b border-line bg-surface px-4 pb-4">
              <DeckCounts deck={deck} index={index} config={config} />
            </div>
            <div className="px-4 py-4">{list}</div>
            <aside aria-label="Deck details" className="border-t border-line bg-surface px-4 py-5">
              <DeckExplanation deck={deck} config={config} index={index} />
            </aside>
          </div>
          <footer
            onClickCapture={dismissOnAction}
            className="flex shrink-0 flex-col gap-1.5 border-t border-line-strong bg-surface px-3 py-2"
          >
            {/* Always present, so screen readers announce new text. */}
            <p
              role="status"
              className={props.status ? 'text-center text-[0.75rem] text-fg-2' : 'sr-only'}
            >
              {props.status}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {props.lead}
              {props.actions}
            </div>
          </footer>
          {cardPanel}
        </>
      ) : (
        <>
          <header
            onClickCapture={dismissOnAction}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface px-6 py-3.5"
          >
            {props.lead}
            {pips}
            {title}
            <span className="text-[0.78125rem] text-fg-1">{props.meta}</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">{props.actions}</div>
            {/* Always present, so screen readers announce new text. */}
            <p
              role="status"
              className={
                props.status ? 'basis-full text-right text-[0.75rem] text-fg-2' : 'sr-only'
              }
            >
              {props.status}
            </p>
          </header>
          <div className="relative min-h-0 flex-1">
            <div className="flex h-full flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
              <div className="min-w-0 flex-1 px-7 py-5 lg:overflow-y-auto">{list}</div>
              <div className="relative hidden w-px shrink-0 bg-line lg:block">
                <button
                  type="button"
                  aria-expanded={wide}
                  aria-label={wide ? 'Narrow the deck details' : 'Widen the deck details'}
                  title={wide ? 'Narrow the deck details' : 'Widen the deck details'}
                  onClick={() => setWide((w) => !w)}
                  className="absolute top-1/2 left-1/2 z-10 flex h-10 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border border-line-strong bg-surface text-[0.8125rem] text-fg-1 hover:bg-surface-2 hover:text-ink"
                >
                  {wide ? '›' : '‹'}
                </button>
              </div>
              <aside
                aria-label="Deck details"
                className={`shrink-0 border-t border-line bg-surface px-[22px] py-5 lg:overflow-y-auto lg:border-t-0 ${
                  wide ? 'lg:w-1/2' : 'lg:w-[320px]'
                }`}
              >
                <DeckExplanation deck={deck} config={config} index={index} detailed={wide} />
              </aside>
            </div>
            {cardPanel}
          </div>
        </>
      )}
      <ReplaceDialog
        replacements={replacing}
        printing={
          replacing && detail.current?.cardId === replacing.card.id
            ? detail.current.printing
            : undefined
        }
        showArt={settings.settings.showArt}
        onPick={(option) => {
          if (!replace || !replacing) return;
          replace.apply(replacing.card.id, option);
          setReplacing(undefined);
          // Show the card that went in once the list has its row, which takes focus back on close.
          requestAnimationFrame(() =>
            detail.open(
              option.card.id,
              option.printing,
              document.querySelector<HTMLElement>(`[data-card-id="${option.card.id}"]`),
            ),
          );
        }}
        onCancel={() => setReplacing(undefined)}
      />
    </div>
  );
}
