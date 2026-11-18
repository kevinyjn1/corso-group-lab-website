// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

// SITE_URL and BASE_PATH let the same build be hosted at a domain root
// (https://example.edu/) or under a sub-path (https://web.eecs.umich.edu/~jjcorso/).
const site = process.env.SITE_URL ?? 'https://web.eecs.umich.edu';
const base = process.env.BASE_PATH ?? '/';

// https://astro.build/config
export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  // Keep HTML whitespace semantics so prose with inline links renders as written.
  compressHTML: true,
  fonts: [
    {
      provider: fontProviders.fontsource(),
      // Readouts and figure labels. Plex Mono is an instrument face: it suits a lab better than
      // the monospace every generated page reaches for.
      name: 'IBM Plex Mono',
      cssVariable: '--font-plex-mono',
      weights: [400, 500, 600],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['ui-monospace', 'monospace'],
    },
  ],
});
