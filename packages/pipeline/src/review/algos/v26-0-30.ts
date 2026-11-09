// The builder before the learned work (26.0.30), run from a git worktree with
// its own core and config/. The old core is imported from a runtime URL and
// typed by the small interface below, so tsc never reads the worktree (it does
// not exist in CI).

import { existsSync, readFileSync } from 'node:fs';
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
  type BuilderVersion,
  type BuiltDeck,
  type PrepareContext,
  type ReviewRequest,
} from '../version.ts';

const COMMIT = '97757faa61eaa876021d9544b0ef131ead3d7cf6';

/** BuildRequest at 26.0.30 (packages/core/src/types.ts). */
interface OldBuildRequest {
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

interface OldBuildResult {
  deck: {
    name: string;
    archetype: string;
    color: Color;
    colors?: Color[];
    commander?: string;
    cards: { cardId: string; qty: number; why?: string }[];
    basics: Partial<Record<Color, number>>;
  };
  explanation: unknown;
}

/** The parts of the 26.0.30 core this adapter uses. */
interface OldCore {
  DATA_SCHEMA_VERSION: number;
  CONFIG_FILES: Record<string, string>;
  CardIndex: new (pack: DataPack) => object;
  BuildError: abstract new (...args: never[]) => Error;
  buildDeck(request: OldBuildRequest, pool: Pool, index: object, config: object): OldBuildResult;
  validateConfig(config: object): string[];
  configVersion(config: object): string;
}

interface Loaded {
  core: OldCore;
  config: object;
  settings: Settings;
  index: object;
}

let loaded: Loaded | undefined;

export function worktreeDir(root: string): string {
  return path.resolve(root, process.env.REVIEW_WORKTREE_26_0_30 ?? '../bulk-brew-26.0.30');
}

async function load(ctx: PrepareContext): Promise<Loaded> {
  const dir = worktreeDir(ctx.root);
  const entry = path.join(dir, 'packages', 'core', 'src', 'index.ts');
  if (!existsSync(entry)) {
    throw new VersionLoadError(
      `the 26.0.30 worktree is missing at ${dir}. Create it from the repo root with:\n` +
        `  git worktree add --detach ../bulk-brew-26.0.30 ${COMMIT}\n` +
        'or point REVIEW_WORKTREE_26_0_30 at an existing checkout of that commit.',
    );
  }
  const core = (await import(pathToFileURL(entry).href)) as OldCore;
  const pack = ctx.index.pack;
  if (pack.schema !== core.DATA_SCHEMA_VERSION) {
    throw new VersionLoadError(
      `the data pack is schema ${pack.schema}, but the 26.0.30 core reads schema ${core.DATA_SCHEMA_VERSION}; ` +
        'the old builder cannot run on this pack.',
    );
  }
  // Read the old config/ the way its check-config.ts loadConfigDir does (no learned files then).
  const configDir = path.join(dir, 'config');
  const bundle: Record<string, unknown> = {};
  for (const [key, file] of Object.entries(core.CONFIG_FILES)) {
    bundle[key] = JSON.parse(readFileSync(path.join(configDir, file), 'utf8'));
  }
  const problems = core.validateConfig(bundle);
  if (problems.length)
    throw new VersionLoadError(`26.0.30 config problems: ${problems.join('; ')}`);
  const settings = JSON.parse(
    readFileSync(path.join(configDir, 'settings.defaults.json'), 'utf8'),
  ) as Settings;
  // The pack is plain data; the old index reads the same parsed object.
  return { core, config: bundle, settings, index: new core.CardIndex(pack) };
}

function toOldRequest(request: ReviewRequest, settings: Settings): OldBuildRequest {
  const out: OldBuildRequest = {
    size: request.size,
    colors: request.colors,
    settings,
    id: 'review',
    createdAt: 'review',
  };
  if (request.style) {
    out.style = request.style;
    out.requireStyle = true;
  }
  if (request.secondary) out.secondary = request.secondary;
  if (request.commander) out.commander = request.commander;
  return out;
}

function toBuiltDeck(result: OldBuildResult): BuiltDeck {
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

const v26_0_30: BuilderVersion = {
  id: 'v26.0.30',
  label: 'Builder at 26.0.30 (before the learned work)',
  notes: `26.0.30 core and config/ from a worktree at ${COMMIT.slice(0, 7)}, current data pack. Ignores the seed.`,
  async prepare(ctx) {
    loaded ??= await load(ctx);
    return `Config ${loaded.core.configVersion(loaded.config)}.`;
  },
  build(ctx) {
    if (!loaded) throw new Error('v26.0.30: prepare() must run before build()');
    const { core, config, settings, index } = loaded;
    try {
      return toBuiltDeck(
        core.buildDeck(toOldRequest(ctx.request, settings), ctx.pool, index, config),
      );
    } catch (err) {
      // The old core has its own BuildError class; the runner knows only the current one.
      if (err instanceof core.BuildError) throw new BuildError(err.message);
      throw err;
    }
  },
};

export default v26_0_30;
