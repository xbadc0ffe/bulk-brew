import { useState, type ReactNode } from 'react';
import { COLOR_LABELS, deckToDecklist, type Deck } from '@bulk-brew/core';
import {
  DeckExplanation,
  deckColors,
  deckFilename,
  DeckList,
  downloadText,
  Dropdown,
  MenuItem,
  Pip,
  ui,
} from '@bulk-brew/ui';
import { useAppState } from '../app-context.ts';

/** Export with Copy as text and Download .txt. Reports the copy through onStatus. */
export function ExportMenu({
  deck,
  onStatus,
  label = 'Export ▾',
}: {
  deck: Deck;
  onStatus(text: string): void;
  label?: string;
}) {
  const { index, config } = useAppState();
  if (!index) return null;
  const text = () => deckToDecklist(deck, index, config);
  return (
    <Dropdown label={label} buttonClassName={ui.secondary} align="right">
      {(close) => (
        <>
          <MenuItem
            onSelect={() => {
              close();
              navigator.clipboard.writeText(text()).then(
                () => onStatus(`Copied "${deck.name}" to the clipboard.`),
                () => onStatus('Copy failed. Try Download .txt instead.'),
              );
            }}
          >
            Copy as text
          </MenuItem>
          <MenuItem
            onSelect={() => {
              close();
              downloadText(deckFilename(deck.name), text());
            }}
          >
            Download .txt
          </MenuItem>
        </>
      )}
    </Dropdown>
  );
}

/**
 * The deck view for a fresh build and a saved deck: a header bar with the
 * actions, the list grouped by type, and the details on the right. The
 * handle on the divider widens the details to half the screen.
 */
export function DeckLayout(props: {
  deck: Deck;
  title?: ReactNode;
  meta: string;
  /** Before the title, such as a back button. */
  lead?: ReactNode;
  actions: ReactNode;
  status?: string | undefined;
}) {
  const { index, config, settings, detail } = useAppState();
  const [wide, setWide] = useState(false);
  const { deck } = props;
  if (!index) return null;
  const colors = deckColors(deck, index);
  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface px-6 py-3.5">
        {props.lead}
        <span className="flex gap-1">
          {colors.map((c) => (
            <Pip key={c} symbol={c} size={20} label={COLOR_LABELS[c]} />
          ))}
        </span>
        {props.title ?? <h1 className="text-[17px] font-semibold">{deck.name}</h1>}
        <span className="text-[12.5px] text-fg-1">{props.meta}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">{props.actions}</div>
        {/* Always present, so screen readers announce new text. */}
        <p
          role="status"
          className={props.status ? 'basis-full text-right text-[12px] text-fg-2' : 'sr-only'}
        >
          {props.status}
        </p>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
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
            className="absolute top-1/2 left-1/2 z-10 flex h-10 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border border-line-strong bg-surface text-[13px] text-fg-1 hover:bg-surface-2 hover:text-ink"
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
    </div>
  );
}
