import { expect, test } from '@playwright/test';
import {
  BOARD_SIZE,
  type Entry,
  MAX_SCORE,
  cleanName,
  createBoard,
  isValidName,
  localBoard,
  qualifies,
  ranked,
  sharedBoard,
} from '../src/scripts/game/leaderboard';

const entry = (name: string, score: number, at = '2026-11-17T00:00:00Z', wave = 3): Entry => ({
  name,
  score,
  wave,
  at,
});

/** A stand-in for localStorage. */
function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

/** A stand-in for fetch that records what was asked and answers from a list of rows. */
function server(rows: object[], fail = false) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const request = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (fail) throw new Error('offline');
    if (init?.method === 'POST') {
      rows.push({ ...JSON.parse(init.body as string), created_at: '2026-11-17T01:00:00Z' });
      return new Response(null, { status: 201 });
    }
    return new Response(JSON.stringify(rows), { status: 200 });
  }) as typeof fetch;
  return { calls, request };
}

test('initials are up to three capital letters or digits', () => {
  expect(cleanName('abc')).toBe('ABC');
  expect(cleanName(' j-j c! ')).toBe('JJC');
  expect(cleanName('<b>xy</b>')).toBe('BXY');
  expect(cleanName('r2d2')).toBe('R2D');
  expect(cleanName('')).toBe('');
  expect(isValidName('JJC')).toBe(true);
  expect(isValidName('A')).toBe(true);
  expect(isValidName('')).toBe(false);
  expect(isValidName('abcd')).toBe(false);
  expect(isValidName('ASS')).toBe(false);
});

test('the board keeps the ten best scores, best first, earlier first on a tie', () => {
  const many = Array.from({ length: 14 }, (_, i) => entry('AAA', (i + 1) * 100));
  const top = ranked(many);
  expect(top).toHaveLength(BOARD_SIZE);
  expect(top[0].score).toBe(1400);
  expect(top[BOARD_SIZE - 1].score).toBe(500);

  const tie = ranked([
    entry('LATE', 0),
    entry('NEW', 900, '2026-11-18T00:00:00Z'),
    entry('OLD', 900),
  ]);
  expect(tie.map((e) => e.name)).toEqual(['OLD', 'NEW']);

  // Entries that could not have come from the game are left out.
  expect(ranked([entry('ASS', 500), entry('OK', MAX_SCORE + 1), entry('toolong', 50)])).toEqual([]);
});

test('a score qualifies when the board has room or it beats the last place', () => {
  const full = ranked(Array.from({ length: BOARD_SIZE }, (_, i) => entry('AAA', 1000 - i * 10)));
  expect(qualifies(0, [])).toBe(false);
  expect(qualifies(5, [])).toBe(true);
  expect(qualifies(910, full)).toBe(false);
  expect(qualifies(911, full)).toBe(true);
  expect(qualifies(MAX_SCORE + 1, [])).toBe(false);
});

test("a device's own board remembers scores and survives bad stored data", async () => {
  const store = memory();
  const board = localBoard(store);
  expect(board.shared).toBe(false);
  expect(await board.top()).toEqual([]);
  await board.submit('KN', { score: 300, wave: 2 });
  const after = await board.submit('JJC', { score: 900, wave: 5 });
  expect(after.map((e) => [e.name, e.score, e.wave])).toEqual([
    ['JJC', 900, 5],
    ['KN', 300, 2],
  ]);
  expect((await localBoard(store).top()).map((e) => e.name)).toEqual(['JJC', 'KN']);

  expect(await localBoard(memory({ 'ground-truth-board': 'not json' })).top()).toEqual([]);
  expect(await localBoard(memory({ 'ground-truth-board': '{"a":1}' })).top()).toEqual([]);
  expect(await localBoard(null).submit('AB', { score: 10, wave: 1 })).toHaveLength(1);
});

test('the shared board reads and posts through the database, with its public key', async () => {
  const { calls, request } = server([
    { name: 'JJC', score: 900, wave: 5, created_at: '2026-11-17T00:00:00Z' },
  ]);
  const board = sharedBoard('https://example.supabase.co/', 'public-key', request);
  expect(board.shared).toBe(true);
  expect(await board.top()).toEqual([entry('JJC', 900, '2026-11-17T00:00:00Z', 5)]);
  expect(calls[0].url).toBe(
    'https://example.supabase.co/rest/v1/scores?select=name,score,wave,created_at&order=score.desc,created_at.asc&limit=10',
  );
  expect(calls[0].init?.headers).toMatchObject({
    apikey: 'public-key',
    Authorization: 'Bearer public-key',
  });

  const after = await board.submit('KN', { score: 1200, wave: 6 });
  expect(calls[1].init?.method).toBe('POST');
  expect(JSON.parse(calls[1].init?.body as string)).toEqual({ name: 'KN', score: 1200, wave: 6 });
  expect(after.map((e) => e.name)).toEqual(['KN', 'JJC']);
});

test('without a database, or when it cannot be reached, the device keeps its own board', async () => {
  const unset = createBoard({}, memory());
  expect(unset.shared).toBe(false);

  const { calls, request } = server([], true);
  const store = memory();
  const board = createBoard(
    { url: 'https://example.supabase.co', key: 'public-key' },
    store,
    request,
  );
  expect(board.shared).toBe(true);
  expect(await board.top()).toEqual([]);
  expect(board.shared).toBe(false);
  // Once it has failed, the rest of the visit stays on the device without asking again.
  const after = await board.submit('KN', { score: 400, wave: 2 });
  expect(after.map((e) => e.name)).toEqual(['KN']);
  expect(calls).toHaveLength(1);
});
