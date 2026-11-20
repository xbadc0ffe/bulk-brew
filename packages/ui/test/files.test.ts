import { describe, expect, it } from 'vitest';
import { fileNameFromUrl, openedFileKind } from '../src/util/files.ts';

describe('openedFileKind', () => {
  it('sends JSON to Restore by name or by content', () => {
    expect(openedFileKind('bulk-brew-backup-2026-11-19.json', '{"schema":1}')).toBe('backup');
    expect(openedFileKind('BACKUP.JSON', '')).toBe('backup');
    expect(openedFileKind('backup', '\n  {"schema":1}')).toBe('backup');
  });

  it('sends card lists to Import', () => {
    expect(openedFileKind('deck.txt', '4 Lightning Bolt\n2 Llanowar Elves')).toBe('list');
    expect(openedFileKind('collection.csv', 'Name,Quantity\nForest,10')).toBe('list');
    expect(openedFileKind('json-deck.txt', '1 Jace')).toBe('list');
  });
});

describe('fileNameFromUrl', () => {
  it('decodes the last part of a file URL', () => {
    expect(
      fileNameFromUrl('file:///private/var/mobile/Containers/Documents/Inbox/My%20Deck.txt'),
    ).toBe('My Deck.txt');
    expect(fileNameFromUrl('file:///a/b/list.csv?x=1')).toBe('list.csv');
    expect(fileNameFromUrl('file:///a/100%.txt')).toBe('100%.txt');
  });
});
