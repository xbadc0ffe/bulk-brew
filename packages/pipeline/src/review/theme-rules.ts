// The theme rules for the review tools. The format, matching, and counting
// live in the core (packages/core/src/theme-rules.ts) and the rules in
// config/theme-rules.json; this adds only reading a rules file from disk, so
// the review checks and the app read the same file.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compileThemeRules, type ThemeRules } from '@bulk-brew/core';
import { ROOT } from '../corpus.ts';

export {
  checkMinimums,
  checkThemeBulk,
  checkThemeRules,
  compileThemeRules,
  countTheme,
  EXAMPLE_THEME_RULES,
  matchCard,
  nearestThemeSize,
  ruleMatches,
  ruleText,
  THEME_SIZES,
  THEME_TALLY_KEYS,
  themeRulesFor,
  type CardTheme,
  type CompiledRule,
  type CompiledStyle,
  type ExcludeRule,
  type ThemeBulkConfig,
  type ThemeCardLine,
  type ThemeCount,
  type ThemeFloor,
  type ThemeLacks,
  type ThemeMatch,
  type ThemeMinimums,
  type ThemeMinimumsCheck,
  type ThemeRule,
  type ThemeRules,
  type ThemeRulesFile,
  type ThemeSize,
  type ThemeStyleRules,
  type ThemeTally,
} from '@bulk-brew/core';

export const DEFAULT_THEME_RULES_FILE = pathToFileURL(
  path.join(ROOT, 'config', 'theme-rules.json'),
);

/** The rules file, compiled, or null when it does not exist. */
export function loadThemeRules(file: string | URL = DEFAULT_THEME_RULES_FILE): ThemeRules | null {
  if (!existsSync(file)) return null;
  const name = typeof file === 'string' ? file : fileURLToPath(file);
  return compileThemeRules(JSON.parse(readFileSync(file, 'utf8')) as unknown, name);
}
