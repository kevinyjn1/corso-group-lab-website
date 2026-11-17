/**
 * The Ground Truth leaderboard: the ten best rounds, with three-character initials.
 *
 * Scores are shared between all visitors when the site is built with a database to keep them in
 * (see supabase/leaderboard.sql and the README). Without one, or when it cannot be reached, each
 * device keeps its own board, so the game never depends on the network.
 */

export interface Entry {
  name: string;
  score: number;
  wave: number;
  /** When the score was posted, as an ISO date. */
  at: string;
}

export type Run = Pick<Entry, 'score' | 'wave'>;

export const BOARD_SIZE = 10;
/** Scores beyond this are not believable and are never posted. */
export const MAX_SCORE = 200_000;

/** Initials that are not shown or stored, as on any arcade cabinet. */
const BLOCKED = new Set(
  'ASS FUK FUC FCK FUX SEX CUM FAG NIG NGR KKK TIT DIK DIC COK KOK PUS JEW NAZ HOR SUK JIZ CNT KYS'.split(
    ' ',
  ),
);

/** What a visitor typed, as initials: up to three capital letters or digits. */
export const cleanName = (raw: string) =>
  raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 3);

export const isValidName = (name: string) => /^[A-Z0-9]{1,3}$/.test(name) && !BLOCKED.has(name);

/** The board in order: best score first, and the earlier of two equal scores ahead. */
export function ranked(entries: readonly Entry[]): Entry[] {
  return entries
    .filter((entry) => isValidName(entry.name) && entry.score > 0 && entry.score <= MAX_SCORE)
    .sort((a, b) => b.score - a.score || a.at.localeCompare(b.at))
    .slice(0, BOARD_SIZE);
}

/** True when a score would appear on the board. */
export function qualifies(score: number, entries: readonly Entry[]): boolean {
  if (score <= 0 || score > MAX_SCORE) return false;
  return entries.length < BOARD_SIZE || score > entries[entries.length - 1].score;
}

export interface Board {
  /** True while scores are shared between all visitors. */
  shared: boolean;
  top(): Promise<Entry[]>;
  /** Post a score and return the board as it now stands. */
  submit(name: string, run: Run): Promise<Entry[]>;
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const LOCAL_KEY = 'ground-truth-board';

/** A board kept on this device only. */
export function localBoard(store: Store | null): Board {
  const read = (): Entry[] => {
    try {
      const saved: unknown = JSON.parse(store?.getItem(LOCAL_KEY) ?? '[]');
      return Array.isArray(saved) ? ranked(saved as Entry[]) : [];
    } catch {
      return [];
    }
  };
  return {
    shared: false,
    top: async () => read(),
    async submit(name, run) {
      const entries = ranked([...read(), { name, ...run, at: new Date().toISOString() }]);
      try {
        store?.setItem(LOCAL_KEY, JSON.stringify(entries));
      } catch {
        // Private browsing: the board lasts for this visit only.
      }
      return entries;
    },
  };
}

/** A board shared by all visitors, kept in a Supabase table and reached over its REST API. */
export function sharedBoard(url: string, key: string, request: typeof fetch = fetch): Board {
  const table = `${url.replace(/\/+$/, '')}/rest/v1/scores`;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const top = async (): Promise<Entry[]> => {
    const query = `select=name,score,wave,created_at&order=score.desc,created_at.asc&limit=${BOARD_SIZE}`;
    const response = await request(`${table}?${query}`, { headers });
    if (!response.ok) throw new Error(`Leaderboard read failed: ${response.status}`);
    const rows = (await response.json()) as {
      name: string;
      score: number;
      wave: number;
      created_at: string;
    }[];
    return ranked(rows.map(({ created_at, ...row }) => ({ ...row, at: created_at })));
  };
  return {
    shared: true,
    top,
    async submit(name, run) {
      const response = await request(table, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ name, score: run.score, wave: run.wave }),
      });
      if (!response.ok) throw new Error(`Leaderboard post failed: ${response.status}`);
      return top();
    },
  };
}

/**
 * The shared board when one is configured and answering, and this device's board otherwise.
 * If the shared board fails once, the rest of the visit uses the device's own.
 */
export function createBoard(
  config: { url?: string; key?: string },
  store: Store | null,
  request: typeof fetch = fetch,
): Board {
  const local = localBoard(store);
  if (!config.url || !config.key) return local;
  const remote = sharedBoard(config.url, config.key, request);
  const board: Board = {
    shared: true,
    async top() {
      if (!board.shared) return local.top();
      try {
        return await remote.top();
      } catch {
        board.shared = false;
        return local.top();
      }
    },
    async submit(name, run) {
      if (!board.shared) return local.submit(name, run);
      try {
        return await remote.submit(name, run);
      } catch {
        board.shared = false;
        return local.submit(name, run);
      }
    },
  };
  return board;
}
