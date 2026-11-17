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

/**
 * A stand-in for the Google Sheet web app: it records what was asked, answers a read with the
 * board, and answers a post by adding the score and sending the board back.
 */
function sheet(rows: Entry[], behavior: 'working' | 'offline' | 'refusing' = 'working') {
  const calls: { url: string; init?: RequestInit }[] = [];
  const request = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (behavior === 'offline') throw new Error('offline');
    if (behavior === 'refusing')
      return new Response(JSON.stringify({ error: 'no' }), { status: 200 });
    if (init?.method === 'POST') {
      rows.push({ ...JSON.parse(init.body as string), at: '2026-11-17T01:00:00.000Z' });
    }
    return new Response(JSON.stringify(rows), { status: 200 });
  }) as typeof fetch;
  return { calls, request };
}

const ENDPOINT = 'https://script.google.com/macros/s/EXAMPLE/exec';

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

test('the shared board reads and posts through the sheet', async () => {
  const { calls, request } = sheet([entry('JJC', 900, '2026-11-17T00:00:00.000Z', 5)]);
  const board = sharedBoard(ENDPOINT, request);
  expect(board.shared).toBe(true);
  expect(await board.top()).toEqual([entry('JJC', 900, '2026-11-17T00:00:00.000Z', 5)]);
  expect(calls[0]).toEqual({ url: ENDPOINT, init: undefined });

  const after = await board.submit('KN', { score: 1200, wave: 6 });
  expect(calls[1].url).toBe(ENDPOINT);
  expect(calls[1].init?.method).toBe('POST');
  // Plain text is the one kind of post a browser sends to another site without asking first.
  expect(calls[1].init?.headers).toEqual({ 'Content-Type': 'text/plain;charset=utf-8' });
  expect(JSON.parse(calls[1].init?.body as string)).toEqual({ name: 'KN', score: 1200, wave: 6 });
  expect(after.map((e) => e.name)).toEqual(['KN', 'JJC']);
  // One round trip: the post itself brings back the new board.
  expect(calls).toHaveLength(2);
});

test('without a sheet, or when it cannot be used, the device keeps its own board', async () => {
  expect(createBoard(undefined, memory()).shared).toBe(false);
  expect(createBoard('', memory()).shared).toBe(false);

  for (const behavior of ['offline', 'refusing'] as const) {
    const { calls, request } = sheet([], behavior);
    const board = createBoard(ENDPOINT, memory(), request);
    expect(board.shared).toBe(true);
    expect(await board.top()).toEqual([]);
    expect(board.shared, behavior).toBe(false);
    // Once it has failed, the rest of the visit stays on the device without asking again.
    const after = await board.submit('KN', { score: 400, wave: 2 });
    expect(after.map((e) => e.name)).toEqual(['KN']);
    expect(calls).toHaveLength(1);
  }
});
