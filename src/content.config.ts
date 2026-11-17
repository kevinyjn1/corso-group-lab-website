import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';

/** The six research areas. Publications and resources are tagged with these keys. */
export const TOPICS = ['video', 'language', 'robotics', 'human', 'health', 'learning'] as const;
export const topic = z.enum(TOPICS);

const url = z.url();

const publications = defineCollection({
  loader: file('src/data/publications.yaml'),
  schema: z.object({
    title: z.string(),
    /** Author names in "F. M. Last" form, in publication order. */
    authors: z.array(z.string()).min(1),
    year: z.number().int().min(1990).max(2100),
    /** Optional "YYYY-MM" used to order papers within a year, newest first. */
    date: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
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
  loader: file('src/data/people.yaml'),
  schema: z.object({
    name: z.string(),
    role: z.enum(['pi', 'phd', 'ms', 'undergrad', 'researcher', 'staff', 'collaborator']),
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
  loader: file('src/data/areas.yaml'),
  schema: z.object({
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
  }),
});

const resources = defineCollection({
  loader: file('src/data/resources.yaml'),
  schema: z.object({
    name: z.string(),
    kind: z.enum(['dataset', 'software']),
    year: z.number().int(),
    summary: z.string(),
    topics: z.array(topic).min(1),
    featured: z.boolean().default(false),
    awards: z.array(z.string()).default([]),
    links: z
      .array(z.object({ label: z.string(), href: url }))
      .min(1)
      .max(3),
  }),
});

const courses = defineCollection({
  loader: file('src/data/courses.yaml'),
  schema: z.object({
    order: z.number().int(),
    code: z.string(),
    title: z.string(),
    institution: z.enum(['michigan', 'buffalo']),
    /** Terms taught, newest first, for example "Fall 2023". */
    terms: z.array(z.string()).min(1),
    summary: z.string().optional(),
    url: url.optional(),
    /** True for a course being taught this term: it is featured at the top of the page. */
    current: z.boolean().default(false),
    /** Who the course is taught with, for example "Yayuan Li". */
    with: z.string().optional(),
    /** Extra links for a current course, such as readings or related writing. */
    links: z.array(z.object({ label: z.string(), href: url })).default([]),
  }),
});

const media = defineCollection({
  loader: file('src/data/media.yaml'),
  schema: z.object({
    title: z.string(),
    kind: z.enum(['video', 'podcast', 'press', 'essay']),
    /** The channel, show, or publication. */
    outlet: z.string(),
    /** "YYYY", "YYYY-MM", or "YYYY-MM-DD", when the source states a date. */
    date: z
      .string()
      .regex(/^\d{4}(-\d{2}){0,2}$/)
      .optional(),
    url,
    /** For YouTube videos: the 11 character id, which also names the thumbnail image. */
    youtubeId: z
      .string()
      .regex(/^[\w-]{11}$/)
      .optional(),
    summary: z.string(),
    /** Featured items lead the Media page and the home page, lowest number first. */
    featured: z.number().int().positive().optional(),
    /** The project an item is about. Its own page lists these items. */
    project: z.enum(['vigil']).optional(),
  }),
});

export const collections = { publications, people, areas, resources, courses, media };
