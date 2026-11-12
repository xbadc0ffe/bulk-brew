// The builder at 26.0.35, before builder phase 1 (docs/builder-phase1.md), run
// from a git worktree with its own core and config/ (learned files included).
// The old core is imported from a runtime URL and typed by the small interface
// below, so tsc never reads the worktree (it does not exist in CI).

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

const COMMIT = 'e8b05fa7d7ce7369beeb20a4f6b3e3dc03d9fa7a';

/** BuildRequest at 26.0.35 (packages/core/src/types.ts). */
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

/** The parts of the 26.0.35 core this adapter uses. */
interface OldCore {
  DATA_SCHEMA_VERSION: number;
  CONFIG_FILES: Record<string, string>;
  LEARNED_FILES: Record<string, string>;
  CardIndex: new (pack: DataPack) => { learned?: object };
  parseLearnedData(json: string): { data?: { version: string }; problems: string[] };
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
  learned: string;
}

let loaded: Loaded | undefined;

export function worktreeDir(root: string): string {
  return path.resolve(root, process.env.REVIEW_WORKTREE_26_0_35 ?? '../bulk-brew-26.0.35');
}

async function load(ctx: PrepareContext): Promise<Loaded> {
  const dir = worktreeDir(ctx.root);
  const entry = path.join(dir, 'packages', 'core', 'src', 'index.ts');
  if (!existsSync(entry)) {
    throw new VersionLoadError(
      `the 26.0.35 worktree is missing at ${dir}. Create it from the repo root with:\n` +
        `  git worktree add --detach ../bulk-brew-26.0.35 ${COMMIT}\n` +
        'or point REVIEW_WORKTREE_26_0_35 at an existing checkout of that commit.',
    );
  }
  const core = (await import(pathToFileURL(entry).href)) as OldCore;
  const pack = ctx.index.pack;
  if (pack.schema !== core.DATA_SCHEMA_VERSION) {
    throw new VersionLoadError(
      `the data pack is schema ${pack.schema}, but the 26.0.35 core reads schema ${core.DATA_SCHEMA_VERSION}; ` +
        'the old builder cannot run on this pack.',
    );
  }
  // Read the old config/ the way its check-config.ts loadConfigDir does. That loader skips
  // config/learned/ unless every file is there; the commit has them all, so a missing one
  // is an error here rather than a quiet build without them.
  const configDir = path.join(dir, 'config');
  const bundle: Record<string, unknown> = {};
  for (const [key, file] of Object.entries(core.CONFIG_FILES)) {
    bundle[key] = JSON.parse(readFileSync(path.join(configDir, file), 'utf8'));
  }
  const learnedConfig: Record<string, unknown> = {};
  for (const [key, file] of Object.entries(core.LEARNED_FILES)) {
    const p = path.join(configDir, 'learned', file);
    if (!existsSync(p)) throw new VersionLoadError(`the 26.0.35 worktree has no ${p}`);
    learnedConfig[key] = JSON.parse(readFileSync(p, 'utf8'));
  }
  bundle.learned = learnedConfig;
  const problems = core.validateConfig(bundle);
  if (problems.length)
    throw new VersionLoadError(`26.0.35 config problems: ${problems.join('; ')}`);
  const settings = JSON.parse(
    readFileSync(path.join(configDir, 'settings.defaults.json'), 'utf8'),
  ) as Settings;
  // The pack is plain data; the old index reads the same parsed object. The card-level
  // learned data is the worktree's own data/learned.json, read by the old core the way
  // that commit's attachLearned does, so a later learn:build cannot move the baseline.
  const index = new core.CardIndex(pack);
  const learnedFile = path.join(dir, 'data', 'learned.json');
  if (!existsSync(learnedFile))
    throw new VersionLoadError(`the 26.0.35 worktree has no data/learned.json at ${learnedFile}`);
  const parsed = core.parseLearnedData(readFileSync(learnedFile, 'utf8'));
  if (!parsed.data)
    throw new VersionLoadError(
      `the 26.0.35 core cannot read ${learnedFile}: ${parsed.problems.join('; ')}`,
    );
  index.learned = parsed.data;
  return { core, config: bundle, settings, index, learned: parsed.data.version };
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

const v26_0_35: BuilderVersion = {
  id: 'v26.0.35',
  label: 'Builder at 26.0.35 (before phase 1)',
  notes: `26.0.35 core and config/ (with config/learned/) from a worktree at ${COMMIT.slice(0, 7)}, its data/learned.json, and the current data pack. Ignores the seed.`,
  async prepare(ctx) {
    loaded ??= await load(ctx);
    const { core, config, learned } = loaded;
    return `Config ${core.configVersion(config)}, learned data ${learned}.`;
  },
  build(ctx) {
    if (!loaded) throw new Error('v26.0.35: prepare() must run before build()');
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

export default v26_0_35;
