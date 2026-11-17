// The shipped builder, run from a git worktree at any commit (docs/review/runner.md,
// "The shipped worktree"): that commit's core, its config/ read by its own
// loadConfigDir, and its data/learned.json, on the current data pack. Shared by
// the shipped and shipped-web versions, so a run that builds both loads it once.
// The old core is imported from a runtime URL and typed by the small interface
// below, so tsc never reads the worktree (it does not exist in CI).

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  BuildError,
  normalizeColors,
  type Color,
  type DataPack,
  type Pool,
  type Settings,
} from '@bulk-brew/core';
import {
  VersionLoadError,
  type BuiltDeck,
  type PrepareContext,
  type ReviewRequest,
} from '../version.ts';

/** BuildRequest as head sends it at f88a87e (packages/core/src/types.ts). */
export interface ShippedBuildRequest {
  size: 100 | 60 | 40 | 20;
  colors: Color[];
  style?: string;
  requireStyle?: boolean;
  commander?: string;
  secondary?: string;
  settings: Settings;
  id?: string;
  createdAt?: string;
}

/** OptionsRequest as useDeckOptions sends it at f88a87e (packages/core/src/options.ts). */
export interface ShippedOptionsRequest {
  size: 100 | 60 | 40 | 20;
  colors: Color[];
  primary?: string;
  secondary?: string;
  commander?: string;
  settings: Settings;
}

export interface ShippedBuildResult {
  deck: {
    name: string;
    archetype: string;
    color: Color;
    colors?: Color[];
    commander?: string;
    cards: { cardId: string; qty: number; why?: string }[];
    basics: Partial<Record<Color, number>>;
  };
  explanation: object;
}

export interface ShippedOptionSearch {
  step(): { kind: string; key?: string } | undefined;
  state(): {
    options: readonly { key: string; rank: number; result: ShippedBuildResult }[];
    planned: number | undefined;
    built: number;
    primaryUnavailable: boolean;
    failure: string | undefined;
  };
}

/** The parts of the shipped core the two versions use. */
export interface ShippedCore {
  DATA_SCHEMA_VERSION: number;
  CardIndex: new (pack: DataPack) => { learned?: object };
  parseLearnedData(json: string): { data?: { version: string }; problems: string[] };
  BuildError: abstract new (...args: never[]) => Error;
  buildDeck(
    request: ShippedBuildRequest,
    pool: Pool,
    index: object,
    config: object,
  ): ShippedBuildResult;
  deckOptionSearch(
    request: ShippedOptionsRequest,
    pool: Pool,
    index: object,
    config: object,
  ): ShippedOptionSearch;
  validateConfig(config: object): string[];
  configVersion(config: object): string;
}

export interface Shipped {
  core: ShippedCore;
  config: object;
  settings: Settings;
  index: object;
  commit: string;
  /** "Commit <id>, config <version>, learned data <version>.", for every deck's notes. */
  notes: string;
}

const loaded = new Map<string, Shipped>();

export function worktreeDir(root: string): string {
  return path.resolve(root, process.env.REVIEW_WORKTREE_SHIPPED ?? '../bulk-brew-shipped');
}

function git(dir: string, args: string[]): string {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();
}

/** Value objects only, so a write by the old core throws instead of changing later builds. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

/**
 * Point `@bulk-brew/core` imports from files in the worktree at its own core,
 * so its pipeline loader runs without an npm install there. Imports from the
 * repo resolve as before.
 */
function routeCoreImports(dir: string, coreUrl: string): void {
  const base = pathToFileURL(dir + path.sep).href;
  registerHooks({
    resolve(specifier, context, next) {
      if (specifier === '@bulk-brew/core' && context.parentURL?.startsWith(base))
        return { url: coreUrl, shortCircuit: true };
      return next(specifier, context);
    },
  });
}

async function load(ctx: PrepareContext): Promise<Shipped> {
  const given = worktreeDir(ctx.root);
  const entry = path.join(given, 'packages', 'core', 'src', 'index.ts');
  if (!existsSync(entry)) {
    throw new VersionLoadError(
      `the shipped worktree is missing at ${given}. Create it from the repo root with:\n` +
        '  git worktree add --detach ../bulk-brew-shipped <commit>\n' +
        'or point REVIEW_WORKTREE_SHIPPED at an existing checkout of that commit.',
    );
  }
  // Node imports real paths, so the hook must compare against the real one.
  const dir = realpathSync(given);
  const commit = git(dir, ['rev-parse', 'HEAD']);
  if (git(dir, ['status', '--porcelain', '--untracked-files=no']))
    throw new VersionLoadError(
      `the shipped worktree at ${dir} has uncommitted changes, so its decks would not be commit ${commit.slice(0, 7)}'s`,
    );
  const coreUrl = pathToFileURL(path.join(dir, 'packages', 'core', 'src', 'index.ts')).href;
  routeCoreImports(dir, coreUrl);
  const core = (await import(coreUrl)) as ShippedCore;
  const pack = ctx.index.pack;
  if (pack.schema !== core.DATA_SCHEMA_VERSION) {
    throw new VersionLoadError(
      `the data pack is schema ${pack.schema}, but the shipped core reads schema ${core.DATA_SCHEMA_VERSION}; ` +
        'it cannot run on this pack.',
    );
  }
  // The commit's own loader decides which config files make the bundle, so a
  // file that commit adds (card-needs.json, say) comes along with no change here.
  const loaderFile = path.join(dir, 'packages', 'pipeline', 'src', 'check-config.ts');
  const loader = (await import(pathToFileURL(loaderFile).href)) as {
    loadConfigDir?: (dir: string) => object;
  };
  if (typeof loader.loadConfigDir !== 'function')
    throw new VersionLoadError(`${loaderFile} exports no loadConfigDir`);
  const configDir = path.join(dir, 'config');
  const config = loader.loadConfigDir(configDir) as { learned?: object };
  // That loader skips config/learned/ unless every file is there; the web always ships them.
  if (!config.learned)
    throw new VersionLoadError(
      `the shipped worktree's config/learned/ is incomplete at ${configDir}`,
    );
  const problems = core.validateConfig(config);
  if (problems.length)
    throw new VersionLoadError(`shipped config problems: ${problems.join('; ')}`);
  const settings = JSON.parse(
    readFileSync(path.join(configDir, 'settings.defaults.json'), 'utf8'),
  ) as Settings;
  // The card-level learned data is the worktree's own data/learned.json, read by
  // that core as its attachLearned does, so a later learn:build cannot move the baseline.
  const index = new core.CardIndex(pack);
  const learnedFile = path.join(dir, 'data', 'learned.json');
  if (!existsSync(learnedFile))
    throw new VersionLoadError(`the shipped worktree has no data/learned.json at ${learnedFile}`);
  const parsed = core.parseLearnedData(readFileSync(learnedFile, 'utf8'));
  if (!parsed.data)
    throw new VersionLoadError(
      `the shipped core cannot read ${learnedFile}: ${parsed.problems.join('; ')}`,
    );
  index.learned = parsed.data;
  return {
    core,
    config: deepFreeze(config),
    settings: deepFreeze(settings),
    index,
    commit,
    notes: `Commit ${commit}, config ${core.configVersion(config)}, learned data ${parsed.data.version}.`,
  };
}

/** The worktree's core, config, and learned data, loaded once per run. */
export async function loadShipped(ctx: PrepareContext): Promise<Shipped> {
  const key = worktreeDir(ctx.root);
  let s = loaded.get(key);
  if (!s) loaded.set(key, (s = await load(ctx)));
  return s;
}

/** The loaded worktree for a build; prepare() must have run. */
export function shippedFor(root: string, id: string): Shipped {
  const s = loaded.get(worktreeDir(root));
  if (!s) throw new Error(`${id}: prepare() must run before build()`);
  return s;
}

/** What head sends buildDeck at f88a87e: a requested style must be built or fail. */
export function toShippedBuildRequest(
  request: ReviewRequest,
  settings: Settings,
): ShippedBuildRequest {
  return {
    size: request.size,
    colors: request.colors,
    settings,
    ...(request.style ? { style: request.style, requireStyle: true } : {}),
    ...(request.secondary ? { secondary: request.secondary } : {}),
    ...(request.commander ? { commander: request.commander } : {}),
    id: 'review',
    createdAt: 'review',
  };
}

/** What useDeckOptions sends at f88a87e: a secondary only with a primary. */
export function toShippedOptionsRequest(
  request: ReviewRequest,
  settings: Settings,
): ShippedOptionsRequest {
  return {
    size: request.size,
    colors: request.colors,
    settings,
    ...(request.style ? { primary: request.style } : {}),
    ...(request.style && request.secondary ? { secondary: request.secondary } : {}),
    ...(request.commander ? { commander: request.commander } : {}),
  };
}

export function toBuiltShipped(result: ShippedBuildResult): BuiltDeck {
  const { deck } = result;
  return {
    name: deck.name,
    archetype: deck.archetype,
    colors: normalizeColors(deck.colors ?? [deck.color]),
    ...(deck.commander ? { commander: deck.commander } : {}),
    cards: deck.cards.map((c) => ({
      id: c.cardId,
      qty: c.qty,
      ...(c.why ? { why: c.why } : {}),
    })),
    basics: deck.basics,
    explanation: result.explanation,
  };
}

/** Run a build with the shipped core; its own BuildError becomes the one the runner knows. */
export function withShippedErrors<T>(s: Shipped, build: () => T): T {
  try {
    return build();
  } catch (err) {
    if (err instanceof s.core.BuildError) throw new BuildError(err.message);
    throw err;
  }
}
