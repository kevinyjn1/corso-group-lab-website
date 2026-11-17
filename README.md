# Corso Group website

Website for the Corso Group (COG) at the University of Michigan, led by Prof. Jason J. Corso.
It is a redesign of [web.eecs.umich.edu/~jjcorso](https://web.eecs.umich.edu/~jjcorso/).

Built with [Astro](https://astro.build). The output is plain static HTML, CSS, and a small amount
of JavaScript, so it can be hosted anywhere - including a university web directory.

## Quick start

Requires Node.js 22.23 or newer.

```bash
npm install
npm run dev
```

| Command           | What it does                                                    |
| ----------------- | --------------------------------------------------------------- |
| `npm run dev`     | Start the dev server with live reload                           |
| `npm run build`   | Build the static site into `dist/`                              |
| `npm run preview` | Serve the built site locally                                    |
| `npm run check`   | Type-check the code and validate all content against its schema |
| `npm run format`  | Format everything with Prettier                                 |
| `npm test`        | Build the site and run the end-to-end tests (Playwright)        |
| `npm run verify`  | Formatting, type and content checks, build, and tests in one go |

The first test run needs a browser: `npx playwright install chromium`.

## Editing content

All content lives in `src/data/` as YAML. Each file is validated when the site builds
(`src/content.config.ts` holds the schemas), so a typo or a missing field fails the build with a
message that names the entry, instead of silently producing a broken page.

| File                | What it holds                                                |
| ------------------- | ------------------------------------------------------------ |
| `publications.yaml` | Every paper, newest first                                    |
| `people.yaml`       | Current members and alumni                                   |
| `areas.yaml`        | The six research areas and their descriptions                |
| `resources.yaml`    | Datasets and software releases                               |
| `courses.yaml`      | Courses taught                                               |
| `src/lib/site.ts`   | Site name, navigation, links, the PI's bio, honors, sponsors |

### Adding a publication

Copy an entry in `src/data/publications.yaml` and edit it:

```yaml
- id: li2026mistake # unique; convention is firstauthor + year + first title word
  title: 'Mistake Attribution: Fine-Grained Mistake Understanding in Egocentric Videos'
  authors: ['Y. Li', 'A. Jain', 'F. Bellos', 'J. J. Corso']
  year: 2026
  date: '2026-06' # optional, orders papers within a year
  type: conference # conference | journal | preprint | report | chapter | thesis
  venue: 'IEEE/CVF Conference on Computer Vision and Pattern Recognition'
  venueShort: 'CVPR' # optional badge
  note: 'Oral' # optional distinction
  topics: [human, video, language] # first topic is the primary area
  featured: true # optional, surfaces it on the research page
  links: # all optional: pdf, arxiv, doi, link, code, data, project, poster, slides, video
    arxiv: 'https://arxiv.org/abs/2511.20525'
```

Topics are the ids in `areas.yaml`: `video`, `language`, `robotics`, `human`, `health`, `learning`.
Counts, the per-year chart, the venue ticker, and the selected papers on the research page all
update from this one file.

### Adding a person

Add an entry to `src/data/people.yaml` with `role` (`phd`, `ms`, `undergrad`, `researcher`,
`staff`, or `collaborator`) and `status` (`current` or `alumni`). Current Ph.D. students can carry
a `focus` and an expected graduation `year`, collaborators an `affiliation`, and alumni a
`thesis`, `firstPosition`, and `currentPosition`. When the member list changes, update
`roster.asOf` in `src/lib/site.ts`.

To add a portrait, drop an image named after the person's `id` into `src/assets/people/`, for
example `src/assets/people/yayuan-li.jpg`. It is resized and compressed at build time. People
without a photo are shown by their initials.

## Structure

```
src/
  content.config.ts   Content schemas
  data/               Content (YAML)
  lib/                Site config and content helpers
  layouts/Base.astro  Page shell: head, fonts, theme, header, footer
  components/         Header, footer, publication row, hero scene, charts, the game
  pages/              One file per page
  scripts/            Browser code: hero scene, publication filter, motion
    scene/            Dot-matrix figures and drawing shared by the hero and the game
    game/             Ground Truth: rules (pure functions) and the playable scene
  styles/global.css   Design tokens and shared styles
tests/                End-to-end tests, plus tests of the game rules
```

## The hidden game

`/play/` is Ground Truth, an easter egg that is deliberately left out of the navigation. The
visitor is the annotator: figures from the home page scene cross the frame, the visitor drags a
box around each one, and every box is graded on IoU against the true box. A box counts at 0.5
IoU or better, small and distant targets are worth more, and streaks multiply the score. A round
lasts 30 seconds and moves from clear footage to occlusion to low light.

There are four ways in:

- Try all four views of the home page scene (Detect, Segment, Pose, Depth) and a fifth tab,
  Play, appears and stays.
- Type the Konami code on any page: up, up, down, down, left, right, left, right, B, A.
- Follow the small "IoU >= 0.5?" link at the bottom of the footer.
- Land on the 404 page and choose to label some data instead.

Scoring, ranks, and the pace of a round are plain functions in
[src/scripts/game/rules.ts](src/scripts/game/rules.ts), so they can be tuned in one place.

## Design notes

- **Hero scene** (`src/scripts/hero-scene.ts`) - a procedural "video" drawn as a dot matrix and read
  four ways: detection and tracking, segmentation, pose, and depth, with a generated caption and an
  activity timeline. It is drawn on a canvas with no dependencies and pauses when off screen.
- **Motion** - page-load intro, scroll reveals, count-up stats, and cross-page transitions. All of
  it is switched off for visitors who ask their system for reduced motion, and the page is fully
  readable without JavaScript.
- **Themes** - dark and light, following the system setting, with a toggle that remembers the choice.
- **Fonts** - Instrument Serif, Geist, and Geist Mono, self-hosted at build time by Astro.

## Deploying

Every push to `main` that passes CI is published to GitHub Pages by the `deploy` job in
[.github/workflows/ci.yml](.github/workflows/ci.yml):

https://kevinyjn1.github.io/corso-group-lab-website/

That deployment is a preview. It is built with `SITE_NOINDEX=true`, which adds a
`<meta name="robots" content="noindex">` tag so search engines do not list it. Delete that setting
from the workflow once the group wants the site to be found.

To host the site somewhere else, `npm run build` writes it to `dist/`. Two environment variables
describe where it will live:

```bash
# At a domain root (the default)
SITE_URL=https://example.edu npm run build

# Under a sub-path, such as a personal web directory
SITE_URL=https://web.eecs.umich.edu BASE_PATH=/~jjcorso/ npm run build
```

Upload the contents of `dist/` to the host. CI runs the end-to-end tests against both layouts;
`npm run test:subpath` does the sub-path run locally.

## Where the content came from

The publication list, alumni, courses, and honors were compiled from the previous website and from
Prof. Corso's public curriculum vitae (April 2025). Papers from 2025 onward, their venues, and the
citation figures were checked against his Google Scholar profile and arXiv in November 2026. Alumni
positions are as stated in that CV, which is the newest public source for them. Current members
were taken from the group's own member list in November 2026. Before launch, the group should
review the research descriptions and anything dated.
