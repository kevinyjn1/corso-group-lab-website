/**
 * The Ground Truth leaderboard: the ten best rounds, with three-character initials.
 *
 * Scores are shared between all visitors when the site is built with the address of a Google
 * Sheet to keep them in (see google-sheet/leaderboard.gs and the README). Without one, or when
 * it cannot be reached, each device keeps its own board, so the game never depends on the
 * network.
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

/** What the sheet sends back: the board, or a reason it refused. */
function readBoard(answer: unknown): Entry[] {
  if (!Array.isArray(answer)) throw new Error('The leaderboard did not answer with a board.');
  return ranked(answer as Entry[]);
}

/**
 * A board shared by all visitors, kept in a Google Sheet. `endpoint` is the address of the web
 * app deployed from the script attached to the sheet. A GET reads the board and a POST adds a
 * score; both answer with the board as it then stands.
 */
export function sharedBoard(endpoint: string, request: typeof fetch = fetch): Board {
  return {
    shared: true,
    async top() {
      const response = await request(endpoint);
      if (!response.ok) throw new Error(`Leaderboard read failed: ${response.status}`);
      return readBoard(await response.json());
    },
    async submit(name, run) {
      const response = await request(endpoint, {
        method: 'POST',
        // Sent as plain text, which a browser may send to another site without asking first.
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ name, score: run.score, wave: run.wave }),
      });
      if (!response.ok) throw new Error(`Leaderboard post failed: ${response.status}`);
      return readBoard(await response.json());
    },
  };
}

/**
 * The shared board when one is configured and answering, and this device's board otherwise.
 * If the shared board fails once, the rest of the visit uses the device's own.
 */
export function createBoard(
  endpoint: string | undefined,
  store: Store | null,
  request: typeof fetch = fetch,
): Board {
  const local = localBoard(store);
  if (!endpoint) return local;
  const remote = sharedBoard(endpoint, request);
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
