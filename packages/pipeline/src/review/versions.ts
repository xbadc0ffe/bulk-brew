// Registry of builder versions for the review runner. To add one, write
// algos/<name>.ts with a default-exported BuilderVersion and add one line here.
// Versions load lazily, so a broken prototype never stops the others.

import type { BuilderVersion } from './version.ts';

const REGISTRY: Record<string, () => Promise<{ default: BuilderVersion }>> = {
  head: () => import('./algos/head.ts'),
  'head-web': () => import('./algos/head-web.ts'),
  'v26.0.30': () => import('./algos/v26-0-30.ts'),
  'v26.0.35': () => import('./algos/v26-0-35.ts'),
  random: () => import('./algos/random.ts'),
  'a-objective': () => import('./algos/a/a-objective.ts'),
  'a-search': () => import('./algos/a/a-search.ts'),
  'b-grow': () => import('./algos/b/grow.ts'),
  'b-oldrules': () => import('./algos/b/oldrules.ts'),
};

export function listVersions(): string[] {
  return Object.keys(REGISTRY);
}

export async function getVersion(id: string): Promise<BuilderVersion> {
  const load = Object.hasOwn(REGISTRY, id) ? REGISTRY[id] : undefined;
  if (!load) throw new Error(`unknown version "${id}"; known: ${listVersions().join(', ')}`);
  const version = (await load()).default;
  if (version.id !== id) throw new Error(`version "${id}" is registered as "${version.id}"`);
  return version;
}
