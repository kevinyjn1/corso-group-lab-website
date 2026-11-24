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
  // A content security policy, written into every page. Scripts and style sheets run only if
  // they are the site's own (Astro lists a hash for each one it builds), so text or a link
  // slipped into the content cannot run code in a visitor's browser. The site is static and has
  // no server to send this as a header, so it travels in the page.
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        // Pictures are the site's own, plus the small images its style sheets carry inline.
        "img-src 'self' data:",
        "media-src 'self'",
        "connect-src 'self'",
        // The only outside frame is the video player, opened when a visitor presses play.
        'frame-src https://www.youtube-nocookie.com',
        "object-src 'none'",
        "base-uri 'self'",
        // The site has no forms.
        "form-action 'none'",
      ],
      styleDirective: {
        resources: [
          { resource: "'self'", kind: 'element' },
          // Sizes computed for one element (a picture's proportions, a bar's height) are set
          // on the element itself.
          { resource: "'unsafe-inline'", kind: 'attribute' },
        ],
      },
    },
  },
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
