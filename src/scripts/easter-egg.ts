/** The Konami code, typed anywhere on the site, opens the hidden game. */
import { href } from '../lib/site';

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
    window.location.assign(href('/play/'));
  }
});
