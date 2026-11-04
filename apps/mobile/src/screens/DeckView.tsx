import { useState, type ReactNode } from 'react';
import { deckToDecklist, type Deck } from '@bulk-brew/core';
import { CurveChart, DeckExplanation, DeckList, phone, Segmented } from '@bulk-brew/ui';
import { useAppState } from '../app-context.ts';
import { exportActions } from '../deck-actions.ts';
import { ActionSheet, Pushed, type SheetAction } from '../parts.tsx';

type Tab = 'cards' | 'why';
const TABS: { id: Tab; label: string }[] = [
  { id: 'cards', label: 'Cards' },
  { id: 'why', label: 'Why it works' },
];

/**
 * A deck as a pushed screen: meta chips, Cards and Why it works, an Export
 * sheet with the given actions, and a bottom bar.
 */
export function DeckScreen(props: {
  deck: Deck;
  back: { label: string; onClick(): void };
  chips: string[];
  /** Extra actions after Copy and Download in the Export sheet. */
  actions: SheetAction[];
  bottom: ReactNode;
  status?: string | undefined;
  onStatus(s: string): void;
}) {
  const { deck, back, chips, actions, bottom, status, onStatus } = props;
  const { index, config, settings, detail } = useAppState();
  const [tab, setTab] = useState<Tab>('cards');
  const [sheet, setSheet] = useState(false);
  if (!index) return null;
  const text = () => deckToDecklist(deck, index, config);
  return (
    <Pushed
      back={back}
      title={deck.name}
      action={{ label: 'Export', onClick: () => setSheet(true) }}
      bottom={bottom}
    >
      <div className="flex flex-col gap-2.5 px-4 pb-3">
        <ul className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <li key={c} className="rounded bg-surface-2 px-2 py-1 text-[0.75rem] text-fg-1">
              {c}
            </li>
          ))}
        </ul>
        <Segmented<Tab>
          label="Deck view"
          options={TABS}
          value={tab}
          onChange={setTab}
          variant="phone"
        />
        <p role="status" className={status ? phone.note : 'sr-only'}>
          {status}
        </p>
      </div>
      {tab === 'cards' ? (
        <>
          {deck.explanation && (
            <div className="px-4 pb-3">
              <CurveChart curve={deck.explanation.curve} variant="phone" />
            </div>
          )}
          <DeckList
            deck={deck}
            index={index}
            config={config}
            showArt={settings.settings.showArt}
            onOpenCard={detail.open}
            variant="phone"
          />
        </>
      ) : (
        <div className="px-4 pb-4">
          <DeckExplanation deck={deck} config={config} index={index} variant="phone" />
        </div>
      )}
      <ActionSheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Export"
        actions={[...exportActions(deck, text, onStatus), ...actions]}
      />
    </Pushed>
  );
}
