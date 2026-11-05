import { configVersion, DATA_SCHEMA_VERSION } from '@bulk-brew/core';
import {
  CONFIG_PROBLEMS,
  DECK_DATA_NOTICE,
  FAN_CONTENT_NOTICE,
  LICENSE_LINE,
  MTGJSON_URL,
  phone,
  REPO_URL,
  SCRYFALL_NOTICE,
  SCRYFALL_URL,
  SEVENTEEN_LANDS_URL,
  WIZARDS_NOTICE,
} from '@bulk-brew/ui';
import { version } from '../../package.json';
import { useAppState } from '../app-context.ts';
import logo from '../assets/badc0ffe-logo.png';
import { Group, Pushed, Row } from '../parts.tsx';

const AUTHOR = 'badc0ffe';
const WEBSITE = 'https://badc0ffe.net';
const EMAIL = 'info@badc0ffe.net';

/** About Bulk Brew, pushed from Settings. */
export function AboutPage({ onBack }: { onBack(): void }) {
  const { pack, config } = useAppState();
  const link = 'text-ink underline';
  return (
    <Pushed back={{ label: 'Settings', onClick: onBack }} title="About">
      <div className="flex flex-col gap-4 px-4 pb-6">
        <header className="flex items-center gap-4 pt-2">
          <img src={logo} alt={`${AUTHOR} logo`} className="size-20 shrink-0" />
          <div className="flex flex-col">
            <h2 className="text-[1.375rem] font-bold">Bulk Brew</h2>
            <p className="text-[0.875rem] text-fg-1">Version {version}</p>
            <p className="text-[0.875rem] text-fg-1">Made by {AUTHOR}</p>
          </div>
        </header>

        <Group label="Contact">
          <Row
            label="Website"
            value={
              <a className={link} href={WEBSITE} target="_blank" rel="noreferrer">
                badc0ffe.net
              </a>
            }
          />
          <Row
            label="Email"
            value={
              <a className={link} href={`mailto:${EMAIL}`}>
                {EMAIL}
              </a>
            }
          />
          <Row
            label="Source code"
            value={
              <a className={link} href={REPO_URL} target="_blank" rel="noreferrer">
                GitHub
              </a>
            }
          />
        </Group>

        <Group label="Card data">
          <Row
            label={`Scryfall data v${pack.status === 'ready' ? pack.index.pack.schema : DATA_SCHEMA_VERSION}`}
            hint={
              pack.status === 'ready'
                ? `${pack.index.version} · ${pack.index.size.toLocaleString('en-US')} cards · config ${configVersion(config)}`
                : pack.status === 'loading'
                  ? 'Loading'
                  : `Failed to load: ${pack.error}`
            }
          />
          <Row
            label="Updates"
            hint="Checking for new card data on the phone is coming in a later update."
          />
          {CONFIG_PROBLEMS.length > 0 && (
            <div className="px-4 py-2.5 text-[0.8125rem] text-ink">
              The shipped config has problems: {CONFIG_PROBLEMS.join('; ')}
            </div>
          )}
        </Group>

        <section className="flex flex-col gap-2 px-1 text-[0.75rem] leading-[1.55] text-fg-1">
          <h2 className={phone.groupLabel}>Notices</h2>
          <p>{FAN_CONTENT_NOTICE}</p>
          <p>{WIZARDS_NOTICE}</p>
          <p>
            {SCRYFALL_NOTICE}{' '}
            <a className={link} href={SCRYFALL_URL} target="_blank" rel="noreferrer">
              scryfall.com
            </a>
          </p>
          <p>
            {DECK_DATA_NOTICE}{' '}
            <a className={link} href={SEVENTEEN_LANDS_URL} target="_blank" rel="noreferrer">
              17lands.com
            </a>{' '}
            <a className={link} href={MTGJSON_URL} target="_blank" rel="noreferrer">
              mtgjson.com
            </a>
          </p>
          <p>{LICENSE_LINE}</p>
        </section>
      </div>
    </Pushed>
  );
}
