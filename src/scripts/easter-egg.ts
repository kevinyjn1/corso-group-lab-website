/**
 * The hidden game, Ground Truth, and the moment of finding it.
 *
 * There are several ways in: the Konami code typed on any page, trying every view of the home
 * page scene, a small link in the footer, and the 404 page. The first time a visitor finds any
 * of them, a pop-up says "Easter egg unlocked". Finding it is remembered, so it is said once.
 */
import { href } from '../lib/site';

/** Set once the visitor has found the game. The home page scene reads it too. */
export const FOUND_KEY = 'ground-truth-unlocked';
/** Fired on the document by anything that reveals the game. */
export const FOUND_EVENT = 'easter-egg:found';

const CODE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
];
const SHOW_FOR = 9000;

const playPath = href('/play/');
const onGamePage = window.location.pathname === playPath;

function alreadyFound(): boolean {
  try {
    return localStorage.getItem(FOUND_KEY) !== null;
  } catch {
    return false;
  }
}

function remember() {
  try {
    localStorage.setItem(FOUND_KEY, '1');
  } catch {
    // Without storage the egg is simply found again next visit.
  }
}

function announce() {
  const toast = document.querySelector<HTMLElement>('[data-egg-toast]');
  if (!toast) return;
  toast.removeAttribute('data-leaving');
  toast.hidden = false;
  const dismiss = () => {
    toast.setAttribute('data-leaving', '');
    window.setTimeout(() => {
      toast.hidden = true;
    }, 350);
  };
  toast.querySelector('[data-egg-close]')?.addEventListener('click', dismiss, { once: true });
  window.setTimeout(dismiss, SHOW_FOR);
}

/** Record that the game has been found. Returns true, and says so, only the first time. */
function unlock(): boolean {
  if (alreadyFound()) return false;
  remember();
  // On the game's own page the heading says it; a pop-up would only cover the game.
  if (onGamePage) document.documentElement.dataset.eggFound = 'new';
  else announce();
  return true;
}

document.addEventListener(FOUND_EVENT, () => unlock());

// Arriving at the game by any route counts as finding it.
if (onGamePage) unlock();

let matched = 0;

document.addEventListener('keydown', (event) => {
  // Typing in a field is never the code.
  if ((event.target as Element | null)?.closest?.('input, textarea, select, [contenteditable]')) {
    return;
  }
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key === CODE[matched]) {
    matched++;
  } else if (key === CODE[0]) {
    // A third "up" in a row still leaves two of them matched.
    matched = matched === 2 ? 2 : 1;
  } else {
    matched = 0;
  }
  if (matched === CODE.length) {
    matched = 0;
    if (onGamePage) return;
    // A first-time finder gets a beat to enjoy the moment before being taken to the game.
    const first = unlock();
    window.setTimeout(() => window.location.assign(playPath), first ? 1600 : 0);
  }
});
