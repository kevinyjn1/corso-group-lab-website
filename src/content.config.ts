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

/*
 * The content rules. Every entry is checked against them when the site builds, and a build that
 * finds a wrong value stops and names the file and the field.
 *
 * Entries are written by an editing form as well as by hand, so the rules read what a form
 * writes: a box left empty arrives as "" or as nothing at all, and both mean "not given". What
 * they do not forgive is a value of the wrong kind, a field they do not know, or a link that is
 * not a web address.
 */

/** What an empty box in a form arrives as. */
const blank = (value: unknown) => (value === '' || value === null ? undefined : value);

/** A field that may be left out. */
const maybe = <T extends z.ZodType>(schema: T) => z.preprocess(blank, schema.optional());

/** A field that takes a set value when it is left out. */
const orElse = <T extends z.ZodType>(schema: T, value: z.output<T> & z.input<T>) =>
  z.preprocess(blank, schema.default(value as never));

/** Text that has to be there: at least one character, with the spaces around it removed. */
const text = z.string().trim().min(1);

/** A list of phrases. Rows left empty are dropped; `atLeast` says how many must remain. */
const texts = (atLeast = 0) =>
  z.preprocess(
    (value) =>
      Array.isArray(value)
        ? value.filter((item) => blank(typeof item === 'string' ? item.trim() : item) !== undefined)
        : (blank(value) ?? []),
    z.array(text).min(atLeast),
  );

/**
 * A link a visitor can follow: http or https only. A plain URL check would also accept
 * `javascript:` and `data:` addresses, which run code when clicked, so those are refused here
 * whoever edits the content and with whatever tool.
 */
const url = z.httpUrl();

/** A link with the words it is shown as. */
const labeledLink = z.strictObject({ label: text, href: url });

/**
 * A date as text, such as "2026-08" or "2026-08-26". Written without quotes in a YAML file, a
 * full date is read as a date and a bare year as a number, so both are turned back into text
 * before the form is checked.
 */
const dateText = (form: RegExp) =>
  z.preprocess((value) => {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return typeof value === 'number' ? String(value) : blank(value);
  }, z.string().regex(form).optional());

const publications = defineCollection({
  loader: entries('publications'),
  schema: z.strictObject({
    title: text,
    /** Author names in "F. M. Last" form, in publication order. */
    authors: texts(1),
    year: z.number().int().min(1990).max(2100),
    /** Optional "YYYY-MM" used to order papers within a year, newest first. */
    date: dateText(/^\d{4}-\d{2}$/),
    type: z.enum(['conference', 'journal', 'preprint', 'report', 'chapter', 'thesis']),
    /** Full venue name, without year or page numbers. */
    venue: text,
    /** Common abbreviation, shown as a badge (for example "CVPR"). */
    venueShort: maybe(text),
    /** Distinctions such as "Oral" or "Best Paper Award". */
    note: maybe(text),
    topics: z.array(topic).min(1),
    featured: orElse(z.boolean(), false),
    /** Where the paper can be read or used. A kind of link left empty is simply not shown. */
    links: z
      .preprocess(
        (value) => blank(value) ?? {},
        z.strictObject({
          pdf: maybe(url),
          arxiv: maybe(url),
          doi: maybe(url),
          link: maybe(url),
          code: maybe(url),
          data: maybe(url),
          project: maybe(url),
          poster: maybe(url),
          slides: maybe(url),
          video: maybe(url),
        }),
      )
      .transform(
        (links) =>
          Object.fromEntries(
            Object.entries(links).filter(([, href]) => href !== undefined),
          ) as Partial<Record<keyof typeof links, string>>,
      ),
  }),
});

const people = defineCollection({
  loader: entries('people'),
  schema: z.strictObject({
    name: text,
    role: z.enum(['pi', 'phd', 'ms', 'undergrad', 'postdoc', 'staff', 'collaborator']),
    status: z.enum(['current', 'alumni']),
    institution: orElse(z.enum(['michigan', 'buffalo']), 'michigan'),
    /** Degree program, for example "ROB", "ECE" or "CSE". */
    program: maybe(text),
    /** Graduation year, or expected graduation year for current students. */
    year: maybe(z.number().int().min(1990).max(2100)),
    focus: maybe(text),
    /** Where a collaborator is based, for example "Porsche". */
    affiliation: maybe(text),
    thesis: maybe(text),
    firstPosition: maybe(text),
    currentPosition: maybe(text),
    note: maybe(text),
    url: maybe(url),
  }),
});

const areas = defineCollection({
  loader: entries('areas'),
  schema: z.strictObject({
    order: z.number().int(),
    title: text,
    /** Compact name for filters and in-page navigation. */
    short: text,
    /** One sentence for cards and navigation. */
    summary: text,
    /** Longer description shown on the research page, one string per paragraph. */
    body: texts(1),
    /** Short phrases describing what the group works on in this area. */
    threads: texts(1),
    /**
     * Ids of the releases to list under this area on the research page, in order: the ones its
     * text is written around. Without it, the area lists its five newest releases.
     */
    releases: maybe(texts(1)),
  }),
});

const resources = defineCollection({
  loader: entries('resources'),
  schema: z.strictObject({
    name: text,
    kind: z.enum(['dataset', 'software']),
    year: z.number().int().min(1990).max(2100),
    summary: text,
    topics: z.array(topic).min(1),
    featured: orElse(z.boolean(), false),
    awards: texts(),
    links: z.array(labeledLink).min(1).max(3),
  }),
});

const courses = defineCollection({
  loader: entries('courses'),
  schema: z.strictObject({
    order: z.number().int(),
    code: text,
    title: text,
    institution: z.enum(['michigan', 'buffalo']),
    /** Terms taught, newest first, for example "Fall 2023". */
    terms: texts(1),
    summary: maybe(text),
    url: maybe(url),
    /**
     * When the page at `url` is that of one offering among several, the term it belongs to. That
     * term is then the link, and the title is not, so no link promises more than it opens.
     */
    urlTerm: maybe(text),
    /** True for a course being taught this term: it is featured at the top of the page. */
    current: orElse(z.boolean(), false),
    /** Who the course is taught with, for example "Yayuan Li". */
    with: maybe(text),
    /** Extra links for a current course, such as readings or related writing. */
    links: z.preprocess((value) => blank(value) ?? [], z.array(labeledLink)),
  }),
});

const media = defineCollection({
  loader: entries('media'),
  schema: z.strictObject({
    title: text,
    kind: z.enum(['video', 'podcast', 'press', 'essay']),
    /** The channel, show, or publication. */
    outlet: text,
    /** "YYYY", "YYYY-MM", or "YYYY-MM-DD", when the source states a date. */
    date: dateText(/^\d{4}(-\d{2}){0,2}$/),
    url,
    /** For YouTube videos: the 11 character id, which also names the thumbnail image. */
    youtubeId: maybe(z.string().regex(/^[\w-]{11}$/)),
    /** What the item is about, in a sentence. Left out when it would only repeat the title. */
    summary: maybe(text),
    /** Featured items lead the Media page and the home page, lowest number first. */
    featured: maybe(z.number().int().positive()),
    /** The project an item is about. Its own page lists these items. */
    project: maybe(z.enum(['vigil'])),
  }),
});

export const collections = { publications, people, areas, resources, courses, media };
