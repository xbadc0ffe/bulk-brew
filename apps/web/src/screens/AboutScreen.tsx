import { configVersion, DATA_SCHEMA_VERSION } from '@bulk-brew/core';
import {
  CONFIG_PROBLEMS,
  FAN_CONTENT_NOTICE,
  LICENSE_LINE,
  REPO_URL,
  SCRYFALL_NOTICE,
  SCRYFALL_URL,
  ui,
  WIZARDS_NOTICE,
} from '@bulk-brew/ui';
import { version } from '../../package.json';
import { useAppState } from '../app-context.ts';
import logo from '../assets/badc0ffe-logo.png';

const AUTHOR = 'badc0ffe';
const WEBSITE = 'https://badc0ffe.net';
const EMAIL = 'info@badc0ffe.net';

export function AboutScreen() {
  const { pack, config } = useAppState();
  return (
    <div className="h-full overflow-y-auto px-8 py-[22px] text-[13px]">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <header className="flex items-center gap-5">
          <img src={logo} alt={`${AUTHOR} logo`} className="size-24 shrink-0" />
          <div className="flex flex-col gap-1">
            <h1 className="text-[24px] font-semibold">Bulk Brew</h1>
            <p className="text-fg-1">Version {version}</p>
            <p className="text-fg-1">Made by {AUTHOR}</p>
          </div>
        </header>

        <section className="flex flex-col gap-2">
          <h2 className={ui.sectionLabel}>Contact</h2>
          <div className={`${ui.box} divide-y divide-surface-2`}>
            <p className="flex justify-between gap-4 px-4 py-[11px]">
              <span className="text-fg-1">Website</span>
              <a className={ui.link} href={WEBSITE} target="_blank" rel="noreferrer">
                badc0ffe.net
              </a>
            </p>
            <p className="flex justify-between gap-4 px-4 py-[11px]">
              <span className="text-fg-1">Email</span>
              <a className={ui.link} href={`mailto:${EMAIL}`}>
                {EMAIL}
              </a>
            </p>
            <p className="flex justify-between gap-4 px-4 py-[11px]">
              <span className="text-fg-1">Source code</span>
              <a className={ui.link} href={REPO_URL} target="_blank" rel="noreferrer">
                github.com/xbadc0ffe/bulk-brew
              </a>
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className={ui.sectionLabel}>Card data</h2>
          <div className={`${ui.box} divide-y divide-surface-2`}>
            <div className="flex flex-col gap-0.5 px-4 py-[11px]">
              <span>
                Scryfall oracle cards · data format v
                {pack.status === 'ready' ? pack.index.pack.schema : DATA_SCHEMA_VERSION}
              </span>
              <span className="text-[11.5px] text-fg-2">
                {pack.status === 'ready'
                  ? `${pack.index.version} · ${pack.index.size.toLocaleString('en-US')} cards · config ${configVersion(config)}`
                  : pack.status === 'loading'
                    ? 'Loading'
                    : `Failed to load: ${pack.error}`}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 px-4 py-[11px]">
              <span>Updates</span>
              <span className="text-[11.5px] text-fg-2">
                New card data arrives with app updates, usually once a week. Reload the page to get
                the latest.
              </span>
            </div>
            {CONFIG_PROBLEMS.length > 0 && (
              <div className="px-4 py-[11px] text-ink">
                <p>The shipped config has problems:</p>
                <ul className="list-disc pl-5">
                  {CONFIG_PROBLEMS.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-2 text-[12.5px] leading-[1.6] text-fg-1">
          <h2 className={ui.sectionLabel}>Notices</h2>
          <p>{FAN_CONTENT_NOTICE}</p>
          <p>{WIZARDS_NOTICE}</p>
          <p>
            {SCRYFALL_NOTICE}{' '}
            <a className={ui.link} href={SCRYFALL_URL} target="_blank" rel="noreferrer">
              scryfall.com
            </a>
          </p>
          <p>{LICENSE_LINE}</p>
        </section>
      </div>
    </div>
  );
}
