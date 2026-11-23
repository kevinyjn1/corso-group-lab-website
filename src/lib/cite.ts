/** How a paper is named beside a figure taken from it, and where its link goes. */
import type { Publication } from './content';

const lastName = (name: string) => name.split(' ').at(-1)!;

/** "Xu et al., ECCV 2012", as a paper would cite it. */
export function shortCite(pub: Publication): string {
  const names = pub.data.authors.map(lastName);
  const who =
    names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names[0]} et al.`;
  return `${who}, ${pub.data.venueShort ?? pub.data.venue} ${pub.data.year}`;
}

/** The open copy of a paper where there is one, otherwise its publisher's page. */
export const paperUrl = (pub: Publication): string | undefined =>
  pub.data.links?.arxiv ?? pub.data.links?.doi ?? pub.data.links?.pdf;

/** The publication with this id, or a build error that says which id is wrong and where. */
export function paperOf(publications: readonly Publication[], id: string, where: string) {
  const pub = publications.find((entry) => entry.id === id);
  if (!pub) throw new Error(`${where}: no publication with the id "${id}"`);
  return pub;
}
