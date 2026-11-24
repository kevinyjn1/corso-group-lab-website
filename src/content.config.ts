import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Where the content is read from. Each entry (a paper, a person, a talk) is one small YAML file,
 * named by its id, in a folder per kind.
 *
 * The live content is kept in its own repository, which the editing tool writes to; the publishing
 * workflow checks it and passes its place in CONTENT_DIR. Without that, the site is built from
 * `sample-content/`, a frozen copy that the tests are written against.
 */
const contentRoot = resolve(process.env.CONTENT_DIR ?? 'sample-content');

/** One YAML file per entry, in the folder of that name. A file's name is the entry's id. */
const entries = (folder: string) =>
  glob({ base: pathToFileURL(`${resolve(contentRoot, folder)}/`), pattern: '*.yaml' });

/** The six research areas. Publications and resources are tagged with these keys. */
export const TOPICS = ['video', 'language', 'robotics', 'human', 'health', 'learning'] as const;
export const topic = z.enum(TOPICS);

/**
 * A link a visitor can follow: http or https only. A plain URL check would also accept
 * `javascript:` and `data:` addresses, which run code when clicked, so those are refused here
 * whoever edits the content and with whatever tool.
 */
const url = z.httpUrl();

/**
 * A date as text, such as "2026-08" or "2026-08-26". Written without quotes in a YAML file, a
 * full date is read as a date and a bare year as a number, so both are turned back into text
 * before the form is checked. An editing tool may write either.
 */
const dateText = (form: RegExp) =>
  z.preprocess((value) => {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return typeof value === 'number' ? String(value) : value;
  }, z.string().regex(form));

const publications = defineCollection({
  loader: entries('publications'),
  schema: z.strictObject({
    title: z.string(),
    /** Author names in "F. M. Last" form, in publication order. */
    authors: z.array(z.string()).min(1),
    year: z.number().int().min(1990).max(2100),
    /** Optional "YYYY-MM" used to order papers within a year, newest first. */
    date: dateText(/^\d{4}-\d{2}$/).optional(),
    type: z.enum(['conference', 'journal', 'preprint', 'report', 'chapter', 'thesis']),
    /** Full venue name, without year or page numbers. */
    venue: z.string(),
    /** Common abbreviation, shown as a badge (for example "CVPR"). */
    venueShort: z.string().optional(),
    /** Distinctions such as "Oral" or "Best Paper Award". */
    note: z.string().optional(),
    topics: z.array(topic).min(1),
    featured: z.boolean().default(false),
    links: z
      .object({
        pdf: url,
        arxiv: url,
        doi: url,
        link: url,
        code: url,
        data: url,
        project: url,
        poster: url,
        slides: url,
        video: url,
      })
      .partial()
      .strict()
      .default({}),
  }),
});

const people = defineCollection({
  loader: entries('people'),
  schema: z.strictObject({
    name: z.string(),
    role: z.enum(['pi', 'phd', 'ms', 'undergrad', 'postdoc', 'staff', 'collaborator']),
    status: z.enum(['current', 'alumni']),
    institution: z.enum(['michigan', 'buffalo']).default('michigan'),
    /** Degree program, for example "ROB", "ECE" or "CSE". */
    program: z.string().optional(),
    /** Graduation year, or expected graduation year for current students. */
    year: z.number().int().optional(),
    focus: z.string().optional(),
    /** Where a collaborator is based, for example "Porsche". */
    affiliation: z.string().optional(),
    thesis: z.string().optional(),
    firstPosition: z.string().optional(),
    currentPosition: z.string().optional(),
    note: z.string().optional(),
    url: url.optional(),
  }),
});

const areas = defineCollection({
  loader: entries('areas'),
  schema: z.strictObject({
    order: z.number().int(),
    title: z.string(),
    /** Compact name for filters and in-page navigation. */
    short: z.string(),
    /** One sentence for cards and navigation. */
    summary: z.string(),
    /** Longer description shown on the research page, one string per paragraph. */
    body: z.array(z.string()).min(1),
    /** Short phrases describing what the group works on in this area. */
    threads: z.array(z.string()).min(1),
    /**
     * Ids of the releases to list under this area on the research page, in order: the ones its
     * text is written around. Without it, the area lists its five newest releases.
     */
    releases: z.array(z.string()).optional(),
  }),
});

const resources = defineCollection({
  loader: entries('resources'),
  schema: z.strictObject({
    name: z.string(),
    kind: z.enum(['dataset', 'software']),
    year: z.number().int(),
    summary: z.string(),
    topics: z.array(topic).min(1),
    featured: z.boolean().default(false),
    awards: z.array(z.string()).default([]),
    links: z
      .array(z.strictObject({ label: z.string(), href: url }))
      .min(1)
      .max(3),
  }),
});

const courses = defineCollection({
  loader: entries('courses'),
  schema: z.strictObject({
    order: z.number().int(),
    code: z.string(),
    title: z.string(),
    institution: z.enum(['michigan', 'buffalo']),
    /** Terms taught, newest first, for example "Fall 2023". */
    terms: z.array(z.string()).min(1),
    summary: z.string().optional(),
    url: url.optional(),
    /**
     * When the page at `url` is that of one offering among several, the term it belongs to. That
     * term is then the link, and the title is not, so no link promises more than it opens.
     */
    urlTerm: z.string().optional(),
    /** True for a course being taught this term: it is featured at the top of the page. */
    current: z.boolean().default(false),
    /** Who the course is taught with, for example "Yayuan Li". */
    with: z.string().optional(),
    /** Extra links for a current course, such as readings or related writing. */
    links: z.array(z.strictObject({ label: z.string(), href: url })).default([]),
  }),
});

const media = defineCollection({
  loader: entries('media'),
  schema: z.strictObject({
    title: z.string(),
    kind: z.enum(['video', 'podcast', 'press', 'essay']),
    /** The channel, show, or publication. */
    outlet: z.string(),
    /** "YYYY", "YYYY-MM", or "YYYY-MM-DD", when the source states a date. */
    date: dateText(/^\d{4}(-\d{2}){0,2}$/).optional(),
    url,
    /** For YouTube videos: the 11 character id, which also names the thumbnail image. */
    youtubeId: z
      .string()
      .regex(/^[\w-]{11}$/)
      .optional(),
    /** What the item is about, in a sentence. Left out when it would only repeat the title. */
    summary: z.string().optional(),
    /** Featured items lead the Media page and the home page, lowest number first. */
    featured: z.number().int().positive().optional(),
    /** The project an item is about. Its own page lists these items. */
    project: z.enum(['vigil']).optional(),
  }),
});

export const collections = { publications, people, areas, resources, courses, media };
