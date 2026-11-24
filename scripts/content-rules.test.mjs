/**
 * Tests of the content rules (src/content.config.ts) as an editor meets them: entries written
 * the way an editing form writes them are accepted, and entries with a wrong value are refused
 * with a message that names the file and the field.
 *
 * Each case syncs the site's content from a spoiled copy of the sample content, as a build does.
 * Run with `npm run test:content`.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SAMPLE = join(ROOT, 'sample-content');

/** Sync the content in `dir` and return whether it was accepted, with what was printed. */
function sync(dir) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [join(ROOT, 'node_modules/astro/bin/astro.mjs'), 'sync'],
      { cwd: ROOT, env: { ...process.env, CONTENT_DIR: dir, FORCE_COLOR: '0', NO_COLOR: '1' } },
      (error, stdout, stderr) => resolve({ accepted: !error, output: `${stdout}\n${stderr}` }),
    );
  });
}

/** A copy of the sample content with the given files written over it. */
async function contentWith(t, files) {
  const dir = await mkdtemp(join(tmpdir(), 'content-rules-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await cp(SAMPLE, dir, { recursive: true });
  for (const [path, text] of Object.entries(files)) await writeFile(join(dir, path), text);
  return dir;
}

// Leave the project synced with its own sample content, as it was found.
after(() => sync(SAMPLE));

test('entries written the way a form writes them are accepted', async (t) => {
  const dir = await contentWith(t, {
    // Empty boxes arrive as "" or as nothing; an unquoted date is read as a date.
    'publications/form-paper.yaml': [
      'title: "  A paper saved from a form  "',
      'authors: ["J. J. Corso", "", "A. Student"]',
      'year: 2027',
      "date: ''",
      'type: conference',
      'venue: A Conference',
      "venueShort: ''",
      'note: null',
      'topics: [video]',
      'featured: null',
      'links:',
      "  pdf: ''",
      '  arxiv: https://arxiv.org/abs/2701.00001',
      '  doi: null',
      '',
    ].join('\n'),
    'publications/no-links.yaml':
      'title: A paper with no links yet\nauthors: [J. J. Corso]\nyear: 2027\ntype: preprint\nvenue: arXiv\ntopics: [learning]\nlinks: null\n',
    'people/form-person.yaml':
      "name: Form Person\nrole: phd\nstatus: current\ninstitution: ''\nprogram: ''\nyear: null\nurl: ''\nnote: null\n",
    'media/form-talk.yaml':
      "title: A talk\nkind: video\noutlet: A Channel\ndate: 2027-03-09\nurl: https://example.org/talk\nyoutubeId: ''\nsummary: ''\nfeatured: null\nproject: ''\n",
    'media/year-only.yaml':
      'title: An article\nkind: press\noutlet: A Paper\ndate: 2027\nurl: http://example.org/article\n',
    'courses/form-course.yaml':
      "order: 99\ncode: ROB 000\ntitle: A course\ninstitution: michigan\nterms: [Fall 2027, '']\nsummary: ''\nurl: ''\nlinks: null\n",
    'resources/form-release.yaml':
      "name: A dataset\nkind: dataset\nyear: 2027\nsummary: What it is.\ntopics: [robotics]\nawards: ['']\nlinks:\n  - label: Project\n    href: https://example.org/data\n",
  });
  const { accepted, output } = await sync(dir);
  assert.ok(accepted, output);
});

const paper = (extra) =>
  `title: A paper\nauthors: [J. J. Corso]\nyear: 2027\ntype: conference\nvenue: A Conference\ntopics: [video]\n${extra}`;

/** Each of these must stop the build and say which entry and which field is wrong. */
const refused = [
  {
    name: 'a link that would run code when clicked',
    file: 'publications/bad-link.yaml',
    text: paper('links:\n  arxiv: "javascript:alert(document.domain)"\n'),
    says: [/publications → bad-link/, /links\.arxiv/],
  },
  {
    name: 'a page of code passed off as a link',
    file: 'media/data-link.yaml',
    text: 'title: An item\nkind: press\noutlet: A Paper\nurl: "data:text/html,<script>alert(1)</script>"\n',
    says: [/media → data-link/, /url/],
  },
  {
    name: 'a field the site does not know',
    file: 'people/extra-field.yaml',
    text: 'name: Extra Field\nrole: phd\nstatus: current\nhtml: "<script>alert(1)</script>"\n',
    says: [/people → extra-field/, /Unrecognized key: "html"/],
  },
  {
    name: 'a choice that is not one of the choices',
    file: 'people/bad-role.yaml',
    text: 'name: Bad Role\nrole: professor\nstatus: current\n',
    says: [/people → bad-role/, /role/],
  },
  {
    name: 'a required field left empty',
    file: 'publications/no-title.yaml',
    text: paper('').replace('title: A paper', "title: '   '"),
    says: [/publications → no-title/, /title/],
  },
  {
    name: 'a research area that does not exist',
    file: 'publications/bad-topic.yaml',
    text: paper('').replace('topics: [video]', 'topics: [astrology]'),
    says: [/publications → bad-topic/, /topics/],
  },
  {
    name: 'text where a number belongs',
    file: 'publications/bad-year.yaml',
    text: paper('').replace('year: 2027', 'year: next year'),
    says: [/publications → bad-year/, /year/],
  },
  {
    name: 'a date in a form the site does not read',
    file: 'media/bad-date.yaml',
    text: 'title: An item\nkind: press\noutlet: A Paper\ndate: March 9, 2027\nurl: https://example.org/a\n',
    says: [/media → bad-date/, /date/],
  },
];

for (const { name, file, text, says } of refused) {
  test(`refused: ${name}`, async (t) => {
    const { accepted, output } = await sync(await contentWith(t, { [file]: text }));
    assert.ok(!accepted, `this entry should have stopped the build:\n${text}`);
    for (const pattern of says) assert.match(output, pattern);
  });
}
