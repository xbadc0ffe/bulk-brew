// The config bundle and default settings, imported from config/ at build
// time so both apps ship the same judgment data. The iOS app can later
// replace this with a pack downloaded over the air.

import { validateConfig, type BulkBrewConfig, type Settings } from '@bulk-brew/core';
import deckTemplates from '../../../../config/deck-templates.json';
import curveProfiles from '../../../../config/curve-profiles.json';
import roles from '../../../../config/roles.json';
import archetypes from '../../../../config/archetypes.json';
import synergyRules from '../../../../config/synergy-rules.json';
import landRules from '../../../../config/land-rules.json';
import builderWeights from '../../../../config/builder-weights.json';
import settingsDefaults from '../../../../config/settings.defaults.json';

export const CONFIG: BulkBrewConfig = {
  deckTemplates,
  curveProfiles,
  roles,
  archetypes,
  synergyRules,
  landRules,
  builderWeights,
} as unknown as BulkBrewConfig;

/** Problems found in the shipped config; empty when it is valid. */
export const CONFIG_PROBLEMS: string[] = validateConfig(CONFIG);

if (CONFIG_PROBLEMS.length > 0) {
  console.error(`Bulk Brew config has ${CONFIG_PROBLEMS.length} problem(s):`, CONFIG_PROBLEMS);
}

export const DEFAULT_SETTINGS: Settings = settingsDefaults as unknown as Settings;
