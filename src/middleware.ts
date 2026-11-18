/**
 * Tidies the spaces around links in every page, in development and in the build.
 *
 * The formatter breaks long lines inside a link, and in HTML a line break is a space. A space at
 * the end of a link is underlined along with it, and a space before a full stop or a comma shows
 * as a gap. Both are artifacts of how the source is laid out, never something an author meant.
 */
import { defineMiddleware } from 'astro:middleware';

const INLINE = 'a|em';

export function tidy(html: string): string {
  return (
    html
      // A space just inside the start of a link or a highlighted word moves out in front of it.
      .replace(new RegExp(`(\\s?)(<(?:${INLINE})\\b[^>]*>)\\s+`, 'g'), (_all, before, tag) =>
        before ? `${before}${tag}` : ` ${tag}`,
      )
      // A space just inside the end moves out behind it, unless what follows needs none.
      .replace(
        new RegExp(`\\s+(</(?:${INLINE})>)(\\s|[.,;:!?)\\]]|</)?`, 'g'),
        (_all, tag, next) => (next === undefined ? `${tag} ` : `${tag}${next}`),
      )
      // No space between a link and the punctuation that closes its sentence.
      .replace(new RegExp(`(</(?:${INLINE})>)\\s+([.,;:!?])`, 'g'), '$1$2')
  );
}

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  if (!response.headers.get('content-type')?.includes('text/html')) return response;
  return new Response(tidy(await response.text()), {
    status: response.status,
    headers: response.headers,
  });
});
