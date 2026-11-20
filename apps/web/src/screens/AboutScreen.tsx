import { configVersion, DATA_SCHEMA_VERSION } from '@bulk-brew/core';
import {
  CONFIG_PROBLEMS,
  DECK_DATA_NOTICE,
  EDHREC_URL,
  FAN_CONTENT_NOTICE,
  LEARNED_DATA_NOTICE,
  LICENSE_LINE,
  MTGJSON_URL,
  REPO_URL,
  SCRYFALL_NOTICE,
  SCRYFALL_URL,
  SEVENTEEN_LANDS_URL,
  SPELLBOOK_URL,
  ui,
  WIZARDS_NOTICE,
} from '@bulk-brew/ui';
import { version } from '../../package.json';
import { useAppState } from '../app-context.ts';
import logo from '../assets/badc0ffe-logo.png';
import { isNative } from '../native.ts';

const AUTHOR = 'badc0ffe';
const WEBSITE = 'https://badc0ffe.net';
const EMAIL = 'info@badc0ffe.net';
// The app opens the policy in Safari, so it needs the site's full address.
const PRIVACY_URL = isNative
  ? 'https://xbadc0ffe.github.io/bulk-brew/privacy.html'
  : `${import.meta.env.BASE_URL}privacy.html`;
const DATA_UPDATES = isNative
  ? 'Card data updates by itself, about once a week, and new data is used the next time the app opens.'
  : 'New card data arrives with app updates, usually once a week. Reload the page to get the latest.';

export function AboutScreen() {
  const { pack, config } = useAppState();
  return (
    <div className="h-full overflow-y-auto px-4 py-[22px] text-[0.8125rem] md:px-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        {/* A phone has no sidebar to show the app's icon, so the icon sits beside the name
            (it follows light and dark mode) and the maker's logo goes on top, larger. */}
        <img src={logo} alt={`${AUTHOR} logo`} className="size-36 self-center md:hidden" />
        <header className="flex items-center gap-5">
          <img src={logo} alt={`${AUTHOR} logo`} className="hidden size-24 shrink-0 md:block" />
          <img
            src={`${import.meta.env.BASE_URL}icon-light.svg`}
            alt="Bulk Brew icon"
            className="size-24 shrink-0 rounded-[22%] md:hidden dark:hidden"
          />
          <img
            src={`${import.meta.env.BASE_URL}icon.svg`}
            alt="Bulk Brew icon"
            className="hidden size-24 shrink-0 rounded-[22%] max-md:dark:block"
          />
          <div className="flex flex-col gap-1">
            <h1 className="text-[1.5rem] font-semibold">Bulk Brew</h1>
            <p className="text-fg-1">Version {version}</p>
            <p className="text-fg-1">Made by {AUTHOR}</p>
          </div>
        </header>

        <section className="flex flex-col gap-2">
          <h2 className={ui.sectionLabel}>Contact</h2>
          <div className={`${ui.box} divide-y-1 divide-surface-2`}>
            <p className="flex justify-between gap-4 px-4 py-[11px]">
              <span className="font-semibold">Website</span>
              <a className={ui.link} href={WEBSITE} target="_blank" rel="noreferrer">
                badc0ffe.net
              </a>
            </p>
            <p className="flex justify-between gap-4 px-4 py-[11px]">
              <span className="font-semibold">Email</span>
              <a className={ui.link} href={`mailto:${EMAIL}`}>
                {EMAIL}
              </a>
            </p>
            <p className="flex justify-between gap-4 px-4 py-[11px]">
              <span className="font-semibold">Source code</span>
              <a className={ui.link} href={REPO_URL} target="_blank" rel="noreferrer">
                github.com/xbadc0ffe/bulk-brew
              </a>
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className={ui.sectionLabel}>Card data</h2>
          <div className={`${ui.box} divide-y-1 divide-surface-2`}>
            <div className="flex flex-col gap-0.5 px-4 py-[11px]">
              <span className="font-semibold">
                Scryfall oracle cards · data format v
                {pack.status === 'ready' ? pack.index.pack.schema : DATA_SCHEMA_VERSION}
              </span>
              {/* The config id is one long word; it breaks rather than overflow on a narrow window. */}
              <span className="text-[0.71875rem] wrap-anywhere text-fg-2">
                {pack.status === 'ready'
                  ? `${pack.index.version} · ${pack.index.size.toLocaleString('en-US')} cards · config ${configVersion(config)}`
                  : pack.status === 'loading'
                    ? 'Loading'
                    : `Failed to load: ${pack.error}`}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 px-4 py-[11px]">
              <span className="font-semibold">Updates</span>
              <span className="text-[0.71875rem] text-fg-2">{DATA_UPDATES}</span>
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

        <section className="flex flex-col gap-2">
          <h2 className={ui.sectionLabel}>Privacy</h2>
          <div className={`${ui.box} flex flex-col gap-1 px-4 py-[11px]`}>
            <p>
              No accounts, analytics, tracking, or ads. Your bulk list, decks, and settings stay on
              this device.
            </p>
            <a
              className={`${ui.link} self-start`}
              href={PRIVACY_URL}
              target="_blank"
              rel="noreferrer"
            >
              Privacy policy
            </a>
          </div>
        </section>

        <section className="flex flex-col gap-2 text-[0.78125rem] leading-[1.6] text-fg-1">
          <h2 className={ui.sectionLabel}>Notices</h2>
          <p>{FAN_CONTENT_NOTICE}</p>
          <p>{WIZARDS_NOTICE}</p>
          <p>
            {SCRYFALL_NOTICE}{' '}
            <a className={ui.link} href={SCRYFALL_URL} target="_blank" rel="noreferrer">
              scryfall.com
            </a>
          </p>
          <p>
            {DECK_DATA_NOTICE}{' '}
            <a className={ui.link} href={SEVENTEEN_LANDS_URL} target="_blank" rel="noreferrer">
              17lands.com
            </a>{' '}
            <a className={ui.link} href={MTGJSON_URL} target="_blank" rel="noreferrer">
              mtgjson.com
            </a>
          </p>
          <p>
            {LEARNED_DATA_NOTICE}{' '}
            <a className={ui.link} href={EDHREC_URL} target="_blank" rel="noreferrer">
              edhrec.com
            </a>{' '}
            <a className={ui.link} href={SPELLBOOK_URL} target="_blank" rel="noreferrer">
              commanderspellbook.com
            </a>
          </p>
          <p>{LICENSE_LINE}</p>
        </section>
      </div>
    </div>
  );
}
