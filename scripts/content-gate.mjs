/**
 * The content gate: the check every change to the site's content passes before it is published.
 *
 * The content (one small YAML file per paper, person, talk, and so on) is kept in its own
 * repository and edited by people who are not programmers, through an outside editing tool.
 * Nothing in that repository is trusted. This script, which lives with the site's code, reads the
 * incoming content, takes only what it recognizes, and writes a clean copy for the build to use.
 * It never runs anything it reads.
 *
 * What it lets through:
 * - files in the folders named below, and nothing else (a README, the editing tool's own
 *   settings, or anything unexpected is left behind);
 * - plain files only: no links to other places on the disk, no folders inside an entry folder;
 * - names made of lower-case letters, digits, and hyphens, ending in `.yaml`;
 * - YAML that is one entry (a set of named fields), of a sane size, with no tricks that expand
 *   into something huge.
 *
 * Whether each field holds the right kind of value is checked next, by the site's own content
 * rules (src/content.config.ts) when it builds.
 *
 * Usage: node scripts/content-gate.mjs <incoming folder> <folder to write the clean copy to>
 */
import { lstat, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';

/** A folder of entries that editors may add to and remove from. */
const LIST = 'list';
/** A folder whose set of entries is fixed by the site's design; editors change their text. */
const FIXED = 'fixed';

/** Every folder of the content, and whether its entries may come and go. */
export const FOLDERS = {
  publications: LIST,
  people: LIST,
  media: LIST,
  resources: LIST,
  courses: LIST,
  areas: FIXED,
};

const ENTRY_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*\.yaml$/;
/** An entry is a few lines of text; the longest today is under 2 KB. */
const MAX_ENTRY_BYTES = 64 * 1024;
/** Far above any list the group will have, and far below what would slow a build to a crawl. */
const MAX_ENTRIES_PER_FOLDER = 5000;

/** The frozen copy of the content that ships with the code. It says which fixed entries exist. */
const SAMPLE = fileURLToPath(new URL('../sample-content/', import.meta.url));

/**
 * @param {string} incoming Folder holding the content as it arrived.
 * @param {string} out Folder to write the clean copy to. It is emptied first.
 * @param {{ sample?: string }} [options]
 * @returns {Promise<{ problems: string[], counts: Record<string, number> }>}
 */
export async function gate(incoming, out, { sample = SAMPLE } = {}) {
  const problems = [];
  /** @type {Record<string, number>} */
  const counts = {};
  /** @type {{ path: string, text: string }[]} */
  const clean = [];

  for (const [folder, kind] of Object.entries(FOLDERS)) {
    const from = join(incoming, folder);
    const info = await lstat(from).catch(() => null);
    if (!info) {
      problems.push(`${folder}/: this folder is missing.`);
      continue;
    }
    if (!info.isDirectory()) {
      problems.push(`${folder}: this must be a folder.`);
      continue;
    }

    const names = (await readdir(from)).sort();
    if (names.length > MAX_ENTRIES_PER_FOLDER) {
      problems.push(`${folder}/: ${names.length} files is more than the site accepts.`);
      continue;
    }

    const kept = [];
    for (const name of names) {
      const path = `${folder}/${name}`;
      const stat = await lstat(join(from, name));
      if (stat.isSymbolicLink()) {
        problems.push(`${path}: this is a link to another place, not a file. Remove it.`);
      } else if (stat.isDirectory()) {
        problems.push(`${path}/: a folder cannot sit inside ${folder}/. Each entry is one file.`);
      } else if (!stat.isFile()) {
        problems.push(`${path}: this is not an ordinary file.`);
      } else if (!ENTRY_NAME.test(name)) {
        problems.push(
          `${path}: a file name may use only lower-case letters, digits, and hyphens, and must end in .yaml (for example "${suggest(name)}").`,
        );
      } else if (stat.size > MAX_ENTRY_BYTES) {
        problems.push(
          `${path}: at ${Math.ceil(stat.size / 1024)} KB this is too large for one entry.`,
        );
      } else {
        const text = await readText(join(from, name));
        const problem = text === null ? 'this is not plain text.' : entryProblem(text);
        if (problem) problems.push(`${path}: ${problem}`);
        else {
          kept.push(name);
          clean.push({ path, text: /** @type {string} */ (text) });
        }
      }
    }

    if (kind === FIXED) {
      const expected = (await readdir(join(sample, folder))).filter((n) => ENTRY_NAME.test(n));
      for (const name of expected) {
        if (!names.includes(name)) {
          problems.push(
            `${folder}/${name}: this entry is part of the site's design and cannot be removed.`,
          );
        }
      }
      for (const name of names) {
        if (ENTRY_NAME.test(name) && !expected.includes(name)) {
          problems.push(
            `${folder}/${name}: entries cannot be added to ${folder}/; the site's design has a fixed set (${expected.map((n) => n.replace('.yaml', '')).join(', ')}).`,
          );
        }
      }
    }
    counts[folder] = kept.length;
  }

  if (problems.length === 0) {
    await rm(out, { recursive: true, force: true });
    for (const { path, text } of clean) {
      await mkdir(join(out, path, '..'), { recursive: true });
      await writeFile(join(out, path), text);
    }
  }
  return { problems, counts };
}

/** The file's text, or null when it is not valid UTF-8 or holds characters no text file has. */
async function readText(path) {
  const bytes = await readFile(path);
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    // Control characters other than tab, line feed, and carriage return have no place in text.
    // eslint-disable-next-line no-control-regex
    return /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text) ? null : text;
  } catch {
    return null;
  }
}

/** What is wrong with an entry's YAML, in a sentence, or null when it is one sound entry. */
function entryProblem(text) {
  // No custom tags, and no anchors that repeat: neither has a use in an entry, and a file built
  // from repeats can expand into gigabytes.
  const doc = parseDocument(text, { maxAliasCount: 0, customTags: [], uniqueKeys: true });
  if (doc.errors.length > 0) {
    const { message, linePos } = doc.errors[0];
    const where = linePos ? ` (line ${linePos[0].line})` : '';
    return `this is not valid YAML${where}: ${message.split('\n')[0]}`;
  }
  // A tag the reader does not know (such as one that asks another program to build an object)
  // is only a warning to it, and the value is read as plain text. An entry has no use for one.
  if (doc.warnings.length > 0) {
    return `this file uses a YAML feature the site does not accept: ${doc.warnings[0].message.split('\n')[0]}`;
  }
  let data;
  try {
    data = doc.toJS({ maxAliasCount: 0 });
  } catch (error) {
    return `this file cannot be read: ${/** @type {Error} */ (error).message.split('\n')[0]}`;
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return 'an entry must be a set of named fields, such as "title: ...".';
  }
  return null;
}

/** A name the editor could have meant: lower case, with hyphens for everything else. */
function suggest(name) {
  const stem = name
    .replace(/\.[^.]*$/, '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${stem || 'entry'}.yaml`;
}

// Run from the command line.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [incoming, out] = process.argv.slice(2);
  if (!incoming || !out) {
    console.error('Usage: node scripts/content-gate.mjs <incoming folder> <clean copy folder>');
    process.exit(2);
  }
  const { problems, counts } = await gate(resolve(incoming), resolve(out));
  if (problems.length > 0) {
    console.error(
      `The content was not accepted. ${problems.length === 1 ? 'One thing needs' : `${problems.length} things need`} fixing:\n`,
    );
    for (const problem of problems) console.error(`- ${problem}`);
    console.error('\nNothing was published. The site stays as it was until this is fixed.');
    process.exit(1);
  }
  const summary = Object.entries(counts)
    .map(([folder, count]) => `${count} ${folder}`)
    .join(', ');
  console.log(`Content accepted: ${summary}.`);
}
