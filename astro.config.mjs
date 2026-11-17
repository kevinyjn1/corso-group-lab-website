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
      name: 'Geist Mono',
      cssVariable: '--font-geist-mono',
      weights: ['100 900'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['ui-monospace', 'monospace'],
    },
  ],
});
