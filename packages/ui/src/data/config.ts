// The config bundle and default settings, imported from config/ at build
// time so both apps ship the same judgment data. The iOS app can later
// replace this with a pack downloaded over the air.

import {
  validateConfig,
  validateDisplayTags,
  type BulkBrewConfig,
  type DisplayTagsConfig,
  type Settings,
} from '@bulk-brew/core';
import deckTemplates from '../../../../config/deck-templates.json';
import curveProfiles from '../../../../config/curve-profiles.json';
import roles from '../../../../config/roles.json';
import archetypes from '../../../../config/archetypes.json';
import synergyRules from '../../../../config/synergy-rules.json';
import landRules from '../../../../config/land-rules.json';
import builderWeights from '../../../../config/builder-weights.json';
import settingsDefaults from '../../../../config/settings.defaults.json';
import displayTags from '../../../../config/display-tags.json';

export const CONFIG: BulkBrewConfig = {
  deckTemplates,
  curveProfiles,
  roles,
  archetypes,
  synergyRules,
  landRules,
  builderWeights,
} as unknown as BulkBrewConfig;

/** The short tags shown on cards and offered as filters. Never read by the builder. */
export const DISPLAY_TAGS = displayTags as unknown as DisplayTagsConfig;

/** Problems found in the shipped config; empty when it is valid. */
export const CONFIG_PROBLEMS: string[] = [
  ...validateConfig(CONFIG),
  ...validateDisplayTags(DISPLAY_TAGS, CONFIG),
];

if (CONFIG_PROBLEMS.length > 0) {
  console.error(`Bulk Brew config has ${CONFIG_PROBLEMS.length} problem(s):`, CONFIG_PROBLEMS);
}

export const DEFAULT_SETTINGS: Settings = settingsDefaults as unknown as Settings;
