import type { ReactNode } from 'react';
import { COLOR_LABELS, deckToDecklist, type Deck } from '@bulk-brew/core';
import {
  DeckExplanation,
  deckFilename,
  DeckList,
  downloadText,
  Dropdown,
  MenuItem,
  Pip,
  ui,
} from '@bulk-brew/ui';
import { useAppState } from '../app-context.ts';

/** Export ▾ with Copy as text and Download .txt. Reports the copy through onStatus. */
export function ExportMenu({ deck, onStatus }: { deck: Deck; onStatus(text: string): void }) {
  const { index, config } = useAppState();
  if (!index) return null;
  const text = () => deckToDecklist(deck, index, config);
  return (
    <Dropdown label="Export ▾" buttonClassName={ui.secondary} align="right">
      {(close) => (
        <>
          <MenuItem
            onSelect={() => {
              close();
              navigator.clipboard.writeText(text()).then(
                () => onStatus('Copied the list to the clipboard.'),
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
 * actions, the list grouped by type, and the explanation panel on the right.
 */
export function DeckLayout(props: {
  deck: Deck;
  title?: ReactNode;
  meta: string;
  badge?: string | undefined;
  /** Before the title, such as a back link. */
  lead?: ReactNode;
  /** After the meta, such as "Edit settings". */
  after?: ReactNode;
  actions: ReactNode;
  status?: string | undefined;
}) {
  const { index, config, settings, detail } = useAppState();
  const { deck } = props;
  if (!index) return null;
  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface px-7 py-4">
        {props.lead}
        <Pip symbol={deck.color} size={20} label={COLOR_LABELS[deck.color]} />
        {props.title ?? <h1 className="text-[17px] font-semibold">{deck.name}</h1>}
        <span className="text-[12.5px] text-fg-1">{props.meta}</span>
        {props.badge && <span className={ui.badge}>{props.badge}</span>}
        {props.after}
        <div className="ml-auto flex flex-wrap items-center gap-2">{props.actions}</div>
        {props.status && (
          <p role="status" className="basis-full text-right text-[12px] text-fg-2">
            {props.status}
          </p>
        )}
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <div className="min-w-0 flex-1 px-7 py-5 lg:overflow-y-auto">
          <DeckList
            deck={deck}
            index={index}
            config={config}
            showArt={settings.settings.showArt}
            onOpenCard={detail.open}
          />
        </div>
        <aside
          aria-label="Why it works"
          className="shrink-0 border-t border-line bg-surface px-[22px] py-5 lg:w-[320px] lg:overflow-y-auto lg:border-t-0 lg:border-l"
        >
          <DeckExplanation deck={deck} config={config} />
        </aside>
      </div>
    </div>
  );
}
