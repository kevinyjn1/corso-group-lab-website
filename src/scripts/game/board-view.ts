/** The leaderboard panel beside the game: the top ten, and a place to post a score. */
import { type Board, type Entry, type Run, cleanName, isValidName, qualifies } from './leaderboard';

const NAME_KEY = 'ground-truth-initials';

export interface BoardView {
  /** Offer the round that just ended to the board. */
  offer(run: Run): void;
}

export function mountBoard(root: HTMLElement, board: Board): BoardView {
  const part = <T extends HTMLElement = HTMLElement>(name: string) =>
    root.querySelector<T>(`[data-board-${name}]`);
  const list = part<HTMLOListElement>('list');
  const form = part<HTMLFormElement>('form');
  const input = part<HTMLInputElement>('initials');
  const post = part<HTMLButtonElement>('post');
  const status = part('status');
  const scope = part('scope');
  const empty = part('empty');

  let entries: Entry[] = [];
  let pending: Run | null = null;
  /** The entry this visitor just posted, so it can be picked out in the list. */
  let mine: Entry | null = null;

  const remembered = () => {
    try {
      return cleanName(localStorage.getItem(NAME_KEY) ?? '');
    } catch {
      return '';
    }
  };
  const say = (text: string) => {
    if (status) status.textContent = text;
  };

  function render() {
    if (!list) return;
    // Names come from other visitors, so rows are built as text, never as markup.
    list.replaceChildren(
      ...entries.map((entry, i) => {
        const row = document.createElement('li');
        const isMine =
          mine !== null &&
          entry.name === mine.name &&
          entry.score === mine.score &&
          entry.at === mine.at;
        if (isMine) row.dataset.mine = '';
        for (const [name, text] of [
          ['place', String(i + 1).padStart(2, '0')],
          ['name', entry.name],
          ['wave', `wave ${entry.wave}`],
          ['score', entry.score.toLocaleString('en-US')],
        ]) {
          const cell = document.createElement('span');
          cell.className = name;
          cell.textContent = text;
          row.append(cell);
        }
        return row;
      }),
    );
    empty?.toggleAttribute('hidden', entries.length > 0);
    if (scope) scope.textContent = board.shared ? 'All visitors' : 'This device';
    root.dataset.shared = String(board.shared);
    root.dataset.count = String(entries.length);
    if (post) post.disabled = !pending;
  }

  async function refresh() {
    entries = await board.top();
    render();
  }

  async function submit() {
    if (!pending || !input) return;
    const name = cleanName(input.value);
    input.value = name;
    if (!isValidName(name)) {
      say('Enter one to three letters or digits.');
      input.focus();
      return;
    }
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {
      // Private browsing: the initials are asked for again next time.
    }
    const run = pending;
    pending = null;
    entries = await board.submit(name, run);
    mine = entries.find((entry) => entry.name === name && entry.score === run.score) ?? null;
    const place = mine ? entries.indexOf(mine) + 1 : 0;
    say(
      place > 0
        ? `Posted as ${name}: number ${place} on the board.`
        : `Posted as ${name}, but it did not reach the top ${entries.length}.`,
    );
    render();
  }

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    void submit();
  });
  input?.addEventListener('input', () => {
    input.value = cleanName(input.value);
  });
  if (input) input.value = remembered();
  void refresh();

  return {
    offer(run) {
      mine = null;
      if (run.score <= 0) {
        pending = null;
        say('');
      } else if (!qualifies(run.score, entries)) {
        pending = null;
        say(`${run.score.toLocaleString('en-US')} points did not reach the top ${entries.length}.`);
      } else {
        pending = run;
        // A returning player has already given initials: post straight away.
        if (input && isValidName(cleanName(input.value))) {
          void submit();
          return;
        }
        say(
          `${run.score.toLocaleString('en-US')} points makes the board. Add your initials to post it.`,
        );
      }
      render();
    },
  };
}
