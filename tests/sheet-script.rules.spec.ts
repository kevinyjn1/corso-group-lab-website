import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { expect, test } from '@playwright/test';

/**
 * The leaderboard's Google Apps Script cannot run outside Google, so these tests run the same
 * file against a stand-in spreadsheet: just enough of Google's services to hold rows.
 */
const source = readFileSync(
  fileURLToPath(new URL('../google-sheet/leaderboard.gs', import.meta.url)),
  'utf8',
);

type Row = unknown[];
interface Answer {
  text: string;
}

function deploy(existing: Row[] | null = null) {
  let rows: Row[] | null = existing;
  const tab = {
    getLastRow: () => rows!.length,
    appendRow: (row: Row) => void rows!.push(row),
    setFrozenRows: () => {},
    getRange: (row: number, column: number, count: number, width: number) => ({
      getValues: () =>
        rows!.slice(row - 1, row - 1 + count).map((r) => r.slice(column - 1, column - 1 + width)),
    }),
  };
  const context = vm.createContext({
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: () => (rows ? tab : null),
        insertSheet: () => {
          rows = [];
          return tab;
        },
      }),
    },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text: string) => ({ text, setMimeType: () => ({ text }) }),
    },
  });
  vm.runInContext(source, context);
  const call = (code: string) => JSON.parse((vm.runInContext(code, context) as Answer).text);
  return {
    read: () => call('doGet()'),
    post: (body: string) => call(`doPost({ postData: { contents: ${JSON.stringify(body)} } })`),
    rows: () => rows,
  };
}

const score = (name: string, points: number, wave = 3) =>
  JSON.stringify({ name, score: points, wave });

test('the first score creates the tab, and the board comes back best first', () => {
  const sheet = deploy();
  expect(sheet.read()).toEqual([]);
  sheet.post(score('KN', 300));
  const board = sheet.post(score('JJC', 900, 5));
  expect(board.map((e: { name: string; score: number }) => [e.name, e.score])).toEqual([
    ['JJC', 900],
    ['KN', 300],
  ]);
  expect(board[0].wave).toBe(5);
  expect(board[0].at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  // A header row, then one row per score.
  expect(sheet.rows()![0]).toEqual(['When', 'Initials', 'Score', 'Wave']);
  expect(sheet.rows()).toHaveLength(3);
  expect(sheet.read()).toEqual(board);
});

test('only the ten best scores are sent back', () => {
  const sheet = deploy();
  for (let i = 1; i <= 13; i++) sheet.post(score('AAA', i * 100));
  const board = sheet.read();
  expect(board).toHaveLength(10);
  expect(board[0].score).toBe(1300);
  expect(board[9].score).toBe(400);
});

test('anything that is not a score from the game is refused and never stored', () => {
  const sheet = deploy();
  const refused = [
    score('abc', 100),
    score('ABCD', 100),
    score('', 100),
    score('ASS', 100),
    score('=1+1', 100),
    score('AB', 0),
    score('AB', -5),
    score('AB', 200001),
    score('AB', 12.5),
    score('AB', 100, 0),
    JSON.stringify({ name: 'AB', score: '100; drop', wave: 1 }),
    JSON.stringify({ name: 'AB' }),
    'not json',
  ];
  for (const body of refused) expect(sheet.post(body), body).toHaveProperty('error');
  expect(sheet.read()).toEqual([]);
  // The tab may have been created, but no score rows were written.
  expect((sheet.rows() ?? []).length).toBeLessThanOrEqual(1);
});

test('rows edited by hand into something else are skipped, not shown', () => {
  const sheet = deploy([
    ['When', 'Initials', 'Score', 'Wave'],
    [new Date('2026-11-17T00:00:00Z'), 'JJC', 900, 5],
    [new Date('2026-11-17T00:00:00Z'), 'a very long name', 5000, 5],
    ['not a date', 'KN', 800, 4],
    [new Date('2026-11-17T00:00:00Z'), 'YL', 'lots', 4],
    ['', '', '', ''],
  ]);
  expect(sheet.read()).toEqual([
    { at: '2026-11-17T00:00:00.000Z', name: 'JJC', score: 900, wave: 5 },
  ]);
});
