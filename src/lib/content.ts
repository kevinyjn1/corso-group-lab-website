import { getCollection, type CollectionEntry } from 'astro:content';

export type Publication = CollectionEntry<'publications'>;
export type Person = CollectionEntry<'people'>;
export type Area = CollectionEntry<'areas'>;
export type Resource = CollectionEntry<'resources'>;
export type Course = CollectionEntry<'courses'>;
export type Topic = Area['id'];

/** Newest first: by year, then by month when known, then alphabetically by title. */
export function byRecency(a: Publication, b: Publication): number {
  return (
    b.data.year - a.data.year ||
    (b.data.date ?? '').localeCompare(a.data.date ?? '') ||
    a.data.title.localeCompare(b.data.title)
  );
}

export async function getPublications(): Promise<Publication[]> {
  return (await getCollection('publications')).sort(byRecency);
}

export async function getAreas(): Promise<Area[]> {
  return (await getCollection('areas')).sort((a, b) => a.data.order - b.data.order);
}

export async function getResources(): Promise<Resource[]> {
  return (await getCollection('resources')).sort(
    (a, b) => b.data.year - a.data.year || a.data.name.localeCompare(b.data.name),
  );
}

export async function getCourses(): Promise<Course[]> {
  return (await getCollection('courses')).sort((a, b) => a.data.order - b.data.order);
}

export async function getPeople(): Promise<Person[]> {
  return (await getCollection('people')).sort(
    (a, b) => (b.data.year ?? 0) - (a.data.year ?? 0) || a.data.name.localeCompare(b.data.name),
  );
}

/** Peer-reviewed work: conference papers, journal articles, and book chapters. */
export function isPeerReviewed(pub: Publication): boolean {
  return ['conference', 'journal', 'chapter'].includes(pub.data.type);
}

export const TYPE_LABELS: Record<Publication['data']['type'], string> = {
  conference: 'Conference',
  journal: 'Journal',
  preprint: 'Preprint',
  report: 'Report',
  chapter: 'Book chapter',
  thesis: 'Thesis',
};

export const LINK_LABELS: Record<string, string> = {
  pdf: 'PDF',
  arxiv: 'arXiv',
  doi: 'DOI',
  link: 'Link',
  code: 'Code',
  data: 'Data',
  project: 'Project',
  poster: 'Poster',
  slides: 'Slides',
  video: 'Video',
};

/** Round down to a friendly "200+" style figure. */
export function approx(count: number, step = 10): string {
  return `${Math.floor(count / step) * step}+`;
}
