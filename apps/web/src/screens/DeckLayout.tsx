import { useState, type ReactNode } from 'react';
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
  deckFilename,
  DeckList,
  downloadText,
  Pip,
  ReplaceDialog,
  ui,
} from '@bulk-brew/ui';
import { useAppState } from '../app-context.ts';

/**
 * Export asks in a popup, as Remove does: Copy as text, Download .txt, or
 * Cancel. Reports the copy through onStatus.
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
                () => onStatus('Copy failed. Try Download .txt instead.'),
              );
            },
          },
          {
            label: 'Download .txt',
            detail: 'Save it as a text file',
            tone: 'go-soft',
            onSelect: () => {
              setOpen(false);
              downloadText(deckFilename(deck.name), text(), 'text/plain');
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
 * positioned. The card's tags show what it earns in `deck`. With
 * `onReplace`, the card gets a Replace button.
 */
export function DeckCardPanel({
  deck,
  onReplace,
}: {
  deck: Deck | undefined;
  onReplace?: ((cardId: string) => void) | undefined;
}) {
  const { detail, index, config, settings, decks, pool } = useAppState();
  const open = detail.current;
  const card = open && index ? index.get(open.cardId) : undefined;
  if (!card || !index) return null;
  const inDecks = decks.decks.filter((d) => d.cards.some((c) => c.cardId === card.id));
  return (
    <aside
      className="absolute inset-y-0 right-0 z-30 w-[320px] max-w-full overflow-y-auto border-l border-line bg-surface p-[22px]"
      aria-label="Card detail"
    >
      <CardDetail
        card={card}
        printing={open?.printing}
        index={index}
        config={config}
        showArt={settings.settings.showArt}
        qty={pool.pool.entries[card.id]?.qty ?? 0}
        inDecks={inDecks.map((d) => d.name)}
        deck={deck}
        onClose={detail.close}
        onReplace={onReplace ? () => onReplace(card.id) : undefined}
      />
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
  const [replacing, setReplacing] = useState<Replacements>();
  const { deck, replace } = props;
  if (!index) return null;
  const colors = deckColors(deck, index);
  // The commander and basics stay; any other card of the deck can be swapped.
  const canReplace = (id: string) =>
    id !== deck.commander && deck.cards.some((c) => c.cardId === id);
  return (
    <div className="flex h-full flex-col">
      <header
        // Any action in the header closes the card detail.
        onClickCapture={(e) => {
          if ((e.target as Element).closest('button')) detail.dismiss();
        }}
        className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface px-6 py-3.5"
      >
        {props.lead}
        <span className="flex gap-1">
          {colors.map((c) => (
            <Pip key={c} symbol={c} size={20} label={COLOR_LABELS[c]} />
          ))}
        </span>
        {props.title ?? <h1 className="text-[1.0625rem] font-semibold">{deck.name}</h1>}
        <span className="text-[0.78125rem] text-fg-1">{props.meta}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">{props.actions}</div>
        {/* Always present, so screen readers announce new text. */}
        <p
          role="status"
          className={props.status ? 'basis-full text-right text-[0.75rem] text-fg-2' : 'sr-only'}
        >
          {props.status}
        </p>
      </header>
      <div className="relative min-h-0 flex-1">
        <div className="flex h-full flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          <div className="min-w-0 flex-1 px-7 py-5 lg:overflow-y-auto">
            <DeckList
              deck={deck}
              index={index}
              config={config}
              showArt={settings.settings.showArt}
              onOpenCard={detail.open}
              singleColumn={wide}
            />
          </div>
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
        <DeckCardPanel
          deck={deck}
          onReplace={
            replace && detail.current && canReplace(detail.current.cardId)
              ? (id) => setReplacing(replace.options(id))
              : undefined
          }
        />
      </div>
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
