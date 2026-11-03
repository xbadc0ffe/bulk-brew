import { useCallback, useEffect, useRef, useState } from 'react';
import type { Settings } from '@bulk-brew/core';
import type { KeyValueStore } from '../storage/kv.ts';
import { DEFAULT_SETTINGS } from './config.ts';

const SETTINGS_KEY = 'settings';

export interface SettingsState {
  settings: Settings;
  /** False until the stored settings were read; controls should wait for it. */
  loaded: boolean;
  update(partial: Partial<Settings>): void;
  reset(): void;
}

function merge(saved: Partial<Settings> | undefined): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...(saved ?? {}),
    maxCopies: { ...DEFAULT_SETTINGS.maxCopies, ...(saved?.maxCopies ?? {}) },
  };
}

/** User settings over the shipped defaults, persisted in the key-value store. */
export function useSettings(kv: KeyValueStore): SettingsState {
  const [settings, setSettings] = useState<Settings>(() => merge(undefined));
  const [loaded, setLoaded] = useState(false);
  const dirty = useRef(false);
  /** Keys edited before the stored value arrived; those edits win over the load. */
  const edited = useRef(new Set<keyof Settings>());

  useEffect(() => {
    let cancelled = false;
    kv.get<Partial<Settings>>(SETTINGS_KEY)
      .then((saved) => {
        if (cancelled) return;
        if (saved) {
          setSettings((current) => {
            const fromStore = merge(saved);
            for (const key of edited.current) {
              (fromStore as unknown as Record<string, unknown>)[key] = current[key];
            }
            return fromStore;
          });
          if (edited.current.size > 0) dirty.current = true;
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [kv]);

  useEffect(() => {
    if (!loaded || !dirty.current) return;
    dirty.current = false;
    void kv.set(SETTINGS_KEY, settings);
  }, [kv, settings, loaded]);

  const update = useCallback((partial: Partial<Settings>) => {
    dirty.current = true;
    for (const key of Object.keys(partial) as (keyof Settings)[]) edited.current.add(key);
    setSettings((s) => merge({ ...s, ...partial }));
  }, []);

  const reset = useCallback(() => {
    dirty.current = true;
    edited.current = new Set(Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]);
    setSettings(merge(undefined));
  }, []);

  return { settings, loaded, update, reset };
}
