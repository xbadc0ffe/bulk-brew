import { Component, type ErrorInfo, type ReactNode } from 'react';
import { STORAGE_KEYS } from '../storage/keys.ts';
import type { KeyValueStore } from '../storage/kv.ts';

interface Props {
  kv: KeyValueStore;
  children: ReactNode;
}

interface State {
  error: Error | undefined;
}

const button =
  'rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800';

/**
 * Last line of defense: a render crash (for example from bad stored data)
 * shows a plain message with a way out instead of a blank page.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: undefined };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Bulk Brew crashed', error, info.componentStack);
  }

  clearAll = async (): Promise<void> => {
    if (!window.confirm('Delete your pool, every saved deck, and your settings, then reload?'))
      return;
    for (const key of Object.values(STORAGE_KEYS)) {
      try {
        await this.props.kv.delete(key);
      } catch {
        // Keep going; a reload with whatever is left is still better than a blank page.
      }
    }
    window.location.reload();
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-3 p-8 text-sm">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p>Bulk Brew hit an error it could not recover from.</p>
        <pre className="overflow-x-auto rounded bg-zinc-100 p-3 text-xs dark:bg-zinc-900">
          {error.message}
        </pre>
        <p className="text-zinc-600 dark:text-zinc-400">
          Reloading usually helps. If it keeps happening, stored data may be damaged; clearing it
          removes your pool, decks, and settings.
        </p>
        <div className="flex gap-2">
          <button type="button" className={button} onClick={() => window.location.reload()}>
            Reload
          </button>
          <button type="button" className={button} onClick={() => void this.clearAll()}>
            Clear all data
          </button>
        </div>
      </div>
    );
  }
}
