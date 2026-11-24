/**
 * Tests of the content gate: what it lets through to the build and what it stops.
 * Run with `npm run test:gate`.
 */
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { FOLDERS, gate } from './content-gate.mjs';

const SAMPLE = fileURLToPath(new URL('../sample-content/', import.meta.url));

/** A copy of the sample content to spoil, and a place for the clean copy. */
async function workspace(t) {
  const root = await mkdtemp(join(tmpdir(), 'content-gate-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const incoming = join(root, 'incoming');
  await cp(SAMPLE, incoming, { recursive: true });
  return { root, incoming, out: join(root, 'clean') };
}

const paper = 'title: A paper\nauthors:\n  - J. J. Corso\nyear: 2026\n';

/** Run the gate and return its one problem, failing if there is not exactly one. */
async function onlyProblem(incoming, out) {
  const { problems } = await gate(incoming, out);
  assert.equal(problems.length, 1, problems.join('\n'));
  return problems[0];
}

test('the sample content passes, and the clean copy is the same content', async (t) => {
  const { incoming, out } = await workspace(t);
  const { problems, counts } = await gate(incoming, out);
  assert.deepEqual(problems, []);
  for (const folder of Object.keys(FOLDERS)) {
    const before = (await readdir(join(SAMPLE, folder))).sort();
    assert.deepEqual((await readdir(join(out, folder))).sort(), before);
    assert.equal(counts[folder], before.length);
    for (const name of before.slice(0, 5)) {
      assert.equal(
        await readFile(join(out, folder, name), 'utf8'),
        await readFile(join(SAMPLE, folder, name), 'utf8'),
      );
    }
  }
});

test('anything outside the known folders is left behind, not copied and not run', async (t) => {
  const { incoming, out } = await workspace(t);
  await writeFile(join(incoming, 'README.md'), '# notes');
  await writeFile(join(incoming, '.pages.yml'), 'content: []');
  await writeFile(join(incoming, 'package.json'), '{"scripts":{"postinstall":"echo owned"}}');
  await mkdir(join(incoming, '.github', 'workflows'), { recursive: true });
  await writeFile(join(incoming, '.github', 'workflows', 'evil.yml'), 'on: push');
  await mkdir(join(incoming, 'scripts'));
  await writeFile(join(incoming, 'scripts', 'content-gate.mjs'), 'process.exit(0)');
  const { problems } = await gate(incoming, out);
  assert.deepEqual(problems, []);
  assert.deepEqual((await readdir(out)).sort(), Object.keys(FOLDERS).sort());
});

test('a link to another place on the disk is refused', async (t) => {
  const { root, incoming, out } = await workspace(t);
  await writeFile(join(root, 'secret.yaml'), 'title: not content\n');
  await symlink(join(root, 'secret.yaml'), join(incoming, 'publications', 'linked.yaml'));
  assert.match(await onlyProblem(incoming, out), /publications\/linked\.yaml: this is a link/);
});

test('a folder that is itself a link is refused', async (t) => {
  const { root, incoming, out } = await workspace(t);
  await rm(join(incoming, 'people'), { recursive: true });
  await mkdir(join(root, 'elsewhere'));
  await symlink(join(root, 'elsewhere'), join(incoming, 'people'));
  assert.match(await onlyProblem(incoming, out), /^people: this must be a folder/);
});

test('a folder inside an entry folder is refused', async (t) => {
  const { incoming, out } = await workspace(t);
  await mkdir(join(incoming, 'media', 'nested'));
  await writeFile(join(incoming, 'media', 'nested', 'item.yaml'), paper);
  assert.match(await onlyProblem(incoming, out), /media\/nested\/: a folder cannot sit inside/);
});

test('file names are lower-case letters, digits, and hyphens, ending in .yaml', async (t) => {
  const { incoming, out } = await workspace(t);
  const bad = [
    'Jane Doe.yaml',
    'page.html',
    'run.js',
    'photo.svg',
    '.hidden.yaml',
    'a_b.yaml',
    'paper.yml',
  ];
  for (const name of bad) await writeFile(join(incoming, 'publications', name), paper);
  const { problems } = await gate(incoming, out);
  assert.equal(problems.length, bad.length, problems.join('\n'));
  for (const problem of problems) assert.match(problem, /a file name may use only/);
  // The message offers the name the editor probably meant.
  assert.ok(problems.some((problem) => problem.includes('"jane-doe.yaml"')));
});

test('an entry must be valid YAML holding named fields', async (t) => {
  const { incoming, out } = await workspace(t);
  const dir = join(incoming, 'publications');
  await writeFile(join(dir, 'broken.yaml'), 'title: "unclosed\nyear: 2026\n');
  await writeFile(join(dir, 'a-list.yaml'), '- one\n- two\n');
  await writeFile(join(dir, 'just-text.yaml'), 'hello\n');
  await writeFile(join(dir, 'empty.yaml'), '');
  await writeFile(join(dir, 'twice.yaml'), 'title: one\ntitle: two\n');
  const { problems } = await gate(incoming, out);
  assert.equal(problems.length, 5, problems.join('\n'));
  assert.ok(problems.some((p) => /broken\.yaml: this is not valid YAML \(line \d+\)/.test(p)));
  assert.ok(problems.some((p) => /a-list\.yaml: an entry must be a set of named fields/.test(p)));
  assert.ok(problems.some((p) => /twice\.yaml: this is not valid YAML/.test(p)));
});

test('a file that expands into something huge is refused', async (t) => {
  const { incoming, out } = await workspace(t);
  const bomb = ['a: &a ["x","x","x","x","x","x","x","x","x"]'];
  for (const [next, last] of [
    ['b', 'a'],
    ['c', 'b'],
    ['d', 'c'],
    ['e', 'd'],
    ['f', 'e'],
    ['g', 'f'],
  ]) {
    bomb.push(`${next}: &${next} [${Array(9).fill(`*${last}`).join(',')}]`);
  }
  await writeFile(join(incoming, 'people', 'bomb.yaml'), `${bomb.join('\n')}\n`);
  assert.match(await onlyProblem(incoming, out), /people\/bomb\.yaml: this file cannot be read/);
});

test('a file with a custom tag is refused, and nothing in it runs', async (t) => {
  const { incoming, out } = await workspace(t);
  await writeFile(
    join(incoming, 'people', 'tagged.yaml'),
    'name: !!js/function "function () { process.exit(7) }"\nrole: phd\nstatus: current\n',
  );
  assert.match(
    await onlyProblem(incoming, out),
    /people\/tagged\.yaml: this file uses a YAML feature the site does not accept/,
  );
});

test('an oversized entry and binary data are refused', async (t) => {
  const { incoming, out } = await workspace(t);
  await writeFile(join(incoming, 'media', 'huge.yaml'), `title: ${'x'.repeat(70 * 1024)}\n`);
  await writeFile(
    join(incoming, 'media', 'binary.yaml'),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]),
  );
  const { problems } = await gate(incoming, out);
  assert.equal(problems.length, 2, problems.join('\n'));
  assert.ok(problems.some((p) => /huge\.yaml: at \d+ KB this is too large/.test(p)));
  assert.ok(problems.some((p) => /binary\.yaml: this is not plain text/.test(p)));
});

test('the research areas are a fixed set: none added, none removed', async (t) => {
  const { incoming, out } = await workspace(t);
  await rm(join(incoming, 'areas', 'health.yaml'));
  await writeFile(join(incoming, 'areas', 'quantum.yaml'), 'title: Quantum\n');
  const { problems } = await gate(incoming, out);
  assert.equal(problems.length, 2, problems.join('\n'));
  assert.ok(problems.some((p) => /areas\/health\.yaml: .*cannot be removed/.test(p)));
  assert.ok(problems.some((p) => /areas\/quantum\.yaml: entries cannot be added/.test(p)));
});

test('a missing folder is reported, and nothing is written when anything is wrong', async (t) => {
  const { incoming, out } = await workspace(t);
  await mkdir(out, { recursive: true });
  await writeFile(join(out, 'earlier.txt'), 'the last good copy');
  await rm(join(incoming, 'courses'), { recursive: true });
  assert.match(await onlyProblem(incoming, out), /^courses\/: this folder is missing/);
  // The earlier clean copy is untouched.
  assert.deepEqual(await readdir(out), ['earlier.txt']);
});

test('entries can be added to and removed from a list', async (t) => {
  const { incoming, out } = await workspace(t);
  const [first] = await readdir(join(incoming, 'publications'));
  await rm(join(incoming, 'publications', first));
  await writeFile(join(incoming, 'publications', 'new-paper-2027.yaml'), paper);
  const { problems } = await gate(incoming, out);
  assert.deepEqual(problems, []);
  const kept = await readdir(join(out, 'publications'));
  assert.ok(kept.includes('new-paper-2027.yaml'));
  assert.ok(!kept.includes(first));
});
