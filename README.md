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
| `media.yaml`        | Talks, podcasts, press, and essays                           |
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

### Adding media

Add an entry to `src/data/media.yaml` with a `kind` (`video`, `podcast`, `press`, or `essay`), the
`outlet`, a `url`, and a one sentence `summary`. For a YouTube video, also give its `youtubeId`
and save a thumbnail named after that id in `src/assets/media/`; it then plays in place on the
Media page. Give an item a `featured` number to show it at the top of the Media page and on the
home page.

To feature a course as being taught now, set `current: true` on it in `courses.yaml`.

## Structure

```
src/
  content.config.ts   Content schemas
  data/               Content (YAML)
  lib/                Site config and content helpers
  layouts/Base.astro  Page shell: head, fonts, theme, header, footer
  components/         Header, footer, publication row, hero scene, charts
  pages/              One file per page
  scripts/            Browser code: hero scene, publication filter, motion
    scene/            The cast of the home page scene, and how it is drawn as dots
  styles/global.css   Design tokens and shared styles
tests/                End-to-end tests, plus tests of the scene's timing
```

## The thesis: physically grounded upskilling

The home page is built around the group's thesis, in the words of Prof. Corso's 2026 talk
"Physically-Grounded Agentic Upskilling": AI that guides a person through a physical task and
makes them better at it.

- **The words** are in `src/lib/thesis.ts`: the definition, what each word means, the talk's
  three claims, and the arc from the kitchen to the clinic. The talk's slides are not public, so
  the site quotes only its title, its three claims, and its closing idea, and links every result
  to its published paper.
- **The first screen** is the title of the talk on one line, the definition, two buttons, and a
  photograph of VIGIL guiding a heart exam. Everything on it is visible without scrolling on a
  laptop. The headline is sized from the width of the page so that it always fits one line from
  a tablet up; a test holds it to 68 pixels or less.
- **Two live figures** carry the first two claims (`oracle` and `human` in
  `src/scripts/figures.ts`): the hazy oracle, with the group's own three-mugs example, and
  mistake attribution, with the paper's chain whip example. The third claim is the VIGIL band.
- **The arc** from the kitchen to the clinic runs beside the group's own footage of MILLY catching
  a skipped step.
- **Private working material** is kept out of this repository by `.gitignore`: slide decks and
  an Obsidian vault of project notes (`vault/`).

## VIGIL, the flagship project

VIGIL has a band on the home page and the Research page, an entry in the navigation, and its own
page at `/vigil/`.

- **The facts** are in `src/lib/vigil.ts`: the award, the four numbers, how it works, what it
  guides, the timeline, and the team. Every fact names its sources, and the page prints them as
  numbered references with the list at the foot. When something changes, change it there, with
  its date and its source.
- **Videos and press** are ordinary entries in `src/data/media.yaml` marked `project: vigil`, so
  they appear on the Media page and on the VIGIL page.
- **Related papers** are the publication ids listed under `papers` in `src/lib/vigil.ts`.
- **Footage** of each part of the system is shown beside the text that describes it, in "How it
  works" and in the band on the home page. The clips are in `src/assets/clips/`, cut from the
  team's own demonstration videos, silent, 9 to 12 seconds each and about 1 MB or less. They are
  placed with `src/components/Clip.astro`, which plays a clip only while it is on screen, lets it
  be paused, and keeps it still for visitors who ask for reduced motion. To add one, cut it with
  `ffmpeg -ss <start> -to <end> -i <source> -an -vf scale=1280:-2,fps=24 -c:v libx264 -crf 27
-preset slow -pix_fmt yuv420p -movflags +faststart <name>.mp4`, save one frame of it as the
  poster in `src/assets/clips/posters/`, and describe what it shows in the `alt` text.
- **The figures** (`vigil` and `leg` in `src/scripts/figures.ts`) are illustrations of a guided
  heart ultrasound and a guided scan of the leg for blood clots, drawn from the team's public
  descriptions and its demo day posters. They show a whole exam in a few seconds, which no single
  clip does. They are labeled as illustrations, and the spoken lines in them are examples.
- **Demo day posters** are in `src/lib/vigil-posters.ts`: what each team showed, in this site's
  words, with a link to the paper where one has been published. Some of that work is not yet
  published, so have each team confirm its entry before the site is made public.
- **Photos** of the system in use are in `src/assets/vigil/`. The two from the group's mock clinic
  are full-resolution photographs from Prof. Corso's talk. The three of the November 2025
  demonstration are cut from a collage he posted, about 1,000 pixels wide: replace them with the
  original files when you have them.
- **Before the site is made public**, confirm with the group that the people who appear in the
  photographs and clips agree to it, and who should be credited for the photographs.

## Design notes

- **Identity** - built from the group's own mark and its university: maize and Michigan blue in
  large flat fields, heavy condensed headlines (Archivo, using its width axis), square corners,
  and solid rules. The page is light by default with a dark theme behind the
  toggle; the tokens are at the top of `src/styles/global.css`.
- **Logo** (`src/components/Logo.astro`, `src/lib/logo.ts`) - a vector redraw of the gear-and-eye
  mark on the group's GitHub organization, measured from the original so it is sharp at any size.
  Its eye follows the pointer, it blinks, and the gear turns as the page scrolls.
- **Headings are calm.** The typeface is heavy, so the sizes are moderate: a page title is about
  60 pixels on a desktop, a section heading about 44, and nothing on the site is larger than 84.
  A test measures every piece of text on every page and fails if anything is. An earlier design
  set headlines as large as the screen allowed, and it read as shouting.
- **The headline** on the home page is the title of Prof. Corso's 2026 talk. The thesis section
  below it opens with his own summary of what an AI that guides people has to do: understand the
  task, understand the human, and fill the gap, with its source linked. The Research page takes
  its title from his Toyota Professorship lecture.
- **Real before drawn.** Where the group has its own photograph or footage of something, the site
  shows that, and a drawing only where there is none. Every animated figure illustrates a
  published result and names the paper it is drawn after (`after` in `src/lib/figures.ts`, shown
  by `src/components/FigureSource.astro`). A figure with no paper to name does not belong here.
- **Operating room scene** (`src/scripts/hero-scene.ts`, `src/scripts/scene/operation.ts`) - a
  bypass graft being sewn onto a coronary artery, drawn as a dot matrix and read four ways. Each
  reading is published work of the group, listed with its paper in `src/lib/readings.ts`: hand
  pose tracking, surgical video and language, the surface of the beating heart, and the path of
  each hand. It is an illustration, not footage, drawn on a canvas with no dependencies, and it
  pauses when off screen.
- **Type and texture.** Headlines are set at the heaviest weight and lead paragraphs at a light
  one, so the two contrast instead of competing. Readouts and figure labels use IBM Plex Mono.
  No color field is a flat fill: maize carries a halftone of blue dots that gathers toward one
  corner, blue carries the figures' dot grid with a little maize light, and the page itself has a
  faint grid, like a lab notebook. The tokens are at the top of `src/styles/global.css`.
- **What every visualization has to pass.** One message a visitor can get at first glance, said
  in plain words, with the most important thing the largest. The VIGIL figures are about someone
  being talked through an exam, so what the assistant says is set in large type under the figure,
  beside one headline reading and the steps of the exam. Labels avoid jargon ("camera", not
  "RGB-D"). Anything that moves for more than a few seconds can be paused.
- **Research figures** (`src/scripts/figures.ts`) - one live figure per research area, each drawn
  after a named paper of the group: a supervoxel hierarchy (ECCV 2012), dense captioning of a
  cooking video (CVPR 2018), a robot following directions (RobotSlang), an assistant catching a
  mistake (CVPR 2026), an echocardiogram with tracked landmarks (ISBI 2026), and coreset
  selection in an embedding space.
- **Spaces around links** are tidied by `src/middleware.ts` on every page. The formatter breaks
  long lines inside links, and in HTML those breaks are spaces: a space at the end of a link is
  underlined with it, and a space before a full stop shows as a gap. A test checks for both.
- **Motion** - page-load intros, scroll reveals, rules that draw themselves, count-up
  stats, a reading-progress bar, and cross-page transitions. All of it is switched off for visitors
  who ask their system for reduced motion, and the page is fully readable without JavaScript.
- **Fonts** - Archivo (variable, from `@fontsource-variable/archivo`) and IBM Plex Mono for
  readouts and figure labels, both self-hosted.

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
