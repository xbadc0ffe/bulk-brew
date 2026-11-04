import { expect, it } from 'vitest';
import { DATA_SCHEMA_VERSION } from '@bulk-brew/core';

it('shares the data schema version with the core', () => {
  expect(DATA_SCHEMA_VERSION).toBe(2);
});
