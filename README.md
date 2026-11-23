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
The per-year chart and the selected papers on the research page update from this one file. The
home page names the venues where the group publishes most; the build stops if a venue it names
has fewer than five papers on the list.

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
  components/         Header, footer, publication row, figures, clips, charts
  pages/              One file per page
  scripts/            Browser code: clips, publication filter, motion
  styles/global.css   Design tokens and shared styles
tests/                End-to-end tests
```

## News

The home page has a section, "What's new at Corso Group", that shows the four newest items, and
`/news/` lists all of them under the year they happened in. Both are built from
`src/data/news.yaml`. To add news, add an entry to that file and push: the site sorts it into
place.

```yaml
- id: a-short-name
  date: '2026-11-20' # or '2026-11' when the day is not known
  kind: milestone # milestone, papers, press, project, teaching, people, award, talk, release
  title: 'What happened, in a few plain words'
  summary: 'One or two sentences. Optional.'
  link: 'https://example.org/the-article' # or a page of this site: '/vigil/#site-visit'
  linkLabel: 'The article in The Detroit News'
```

- For a paper on the publication list, write `paper: <its id in publications.yaml>` in place of
  `link`, and the address is taken from that list.
- A title has no full stop, and a link's words say what it opens. An address copied from
  LinkedIn or a newsletter usually ends in tracking codes (`?utm_...`, `rcm=...`): cut them off.
- Say what happened and leave the adjectives out: "named Toyota Professor", not "thrilled to
  announce".
- Dates show as month and year, so every item reads the same whether or not its day is known.

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
- **Two real results** carry the first two claims: a real example from the AAAI 2023 paper on
  hazy oracles (its Figure 4, cut into three panels), and a clip of the group's own video of
  the CVPR 2026 results on mistake attribution, with that paper's Figure 1 under it
  (`src/components/Thesis.astro`). The third claim is the VIGIL band.
- **The arc** from the kitchen to the clinic runs beside the group's own footage of MILLY catching
  a skipped step.
- **Private working material** is kept out of this repository by `.gitignore`: slide decks and
  an Obsidian vault of project notes (`vault/`).

## VIGIL

VIGIL has a band on the home page and the Research page, an entry in the navigation, and its own
page at `/vigil/`.

- **The facts** are in `src/lib/vigil.ts`: the award, how it works, who it is for, what it
  guides, the timeline, and the team. The project's line ("Specialist-level care, anywhere it's
  needed."), the "not a replacement, a teammate" section, and the sentence on the first eighteen
  months follow the team's own one-page overview of July 2026; numbers from it are written as
  sentences, never as a row of figures. The page states these facts plainly: it has no footnote
  numbers and no list of sources. It keeps three ordinary links in its text (the award, the
  article a quotation is from, and the post a picture is from), listed as `LINKS` in that file.
  When something changes, change it there, with its date.
- **Videos and press** are ordinary entries in `src/data/media.yaml` marked `project: vigil`, so
  they appear on the Media page and on the VIGIL page.
- **Related papers** are the publication ids listed under `papers` in `src/lib/vigil.ts`.
- **Footage** of each part of the system is shown beside the text that describes it, in "How it
  works" and in the band on the home page. The clips are in `src/assets/clips/`, silent, 9 to 12
  seconds each and about 1 MB or less. Four of the five VIGIL clips are cut from the two videos
  of the November 2025 demonstrations that Prof. Corso published on YouTube; the page shows both
  videos in full under the clips (the two `vigil-demo-...` entries in `src/data/media.yaml`). They are
  placed with `src/components/Clip.astro`, which plays a clip only while it is on screen, lets it
  be paused, and keeps it still for visitors who ask for reduced motion. To add one, cut it with
  `ffmpeg -ss <start> -to <end> -i <source> -an -vf scale=1280:-2,fps=24 -c:v libx264 -crf 27
-preset slow -pix_fmt yuv420p -movflags +faststart <name>.mp4`, save one frame of it as the
  poster in `src/assets/clips/posters/`, and describe what it shows in the `alt` text.
- **Photographs of the May 2026 site visit** (`src/assets/vigil/site-visit-*.jpg`) are the
  College of Engineering's, by Gabi Iriarte, from its public post about the visit. They are
  shown three across at one size, and the credit is under them.
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
- **Nothing that poses as data.** The home page has no rows of big statistics, no scrolling strip
  of venues, no numbers that count up, no frame counter on a figure, no coordinates in the
  footer. A fact worth stating is stated once, in a sentence, where it belongs. A video's summary
  says what it is about, not how long it runs.
- **Details.** Four rules, each with a test behind it. Do not say twice what the page already
  shows right there. A pattern has no exceptions: every row of a timeline is a date, every title
  of a list is in one case. A link opens the thing its words name: a post is linked as the post,
  never as a profile, and a link to one term of a course sits on that term. And no running
  totals: a count of things that keep growing ("48 items in all") is left out unless the number
  is the point.
- **The headline** on the home page is the title of Prof. Corso's 2026 talk. The thesis section
  below it opens with his own summary of what an AI that guides people has to do: understand the
  task, understand the human, and fill the gap, with its source linked. The Research page takes
  its title from his Toyota Professorship lecture.
- **Real, never drawn.** The site shows the group's work with photographs, clips of its own
  footage, and figures cut from its papers. It has no drawn or animated illustrations: the owner
  had the dot-matrix animations removed in November 2026 because they were hard to understand
  and did not look professional. A test checks that no page draws on a canvas.
- **Figures from the papers** are in `src/lib/paper-figures.ts`: the image, the figure's number
  in its paper, a description for people who cannot see it, and a caption that says only what
  the paper says. `src/components/PaperFigure.astro` shows one on a white sheet, names the
  figure and the paper, links to the paper, and opens the figure at full size. To add one, cut it
  from the paper's PDF at print resolution (`pdftoppm -r 400 -f <page> -l <page> -x <x> -y <y>
-W <w> -H <h> -png`), leave its caption out, and save it in `src/assets/papers/` under the
  paper's id.
- **Research areas** (`src/lib/area-visuals.ts`). Each of the six areas has two pictures: a
  lead, which is a figure from a paper or a clip, and a second figure. Five of them have a card
  on the home page that shows part of one figure. On the Research page every area is set on the
  same grid: its name and text in the left column, its two pictures in the right one, both the
  full width of that column, each with its caption under it. No picture stands taller than
  30rem, so a pair stays near the height of the text. Tests hold the grid: equal picture
  widths, captions as wide as their pictures, and columns that end within 200 pixels of each
  other on a laptop.
- **In the operating room** (`src/lib/operating-room.ts`) - two decades of work on surgery and
  the heart, as four papers show it: a beating heart tracked in stereo video (2004), the tools of
  a surgical robot (2017), a surgeon's hands (2023), and a heart ultrasound (2026). Pictures of
  open surgery are left out on purpose.
- **Type and texture.** Headlines are set at the heaviest weight and lead paragraphs at a light
  one, so the two contrast instead of competing. Small labels use IBM Plex Mono.
  No color field is a flat fill: maize carries a halftone of blue dots that gathers toward one
  corner, blue carries a faint dot grid with a little maize light, and the page itself has a
  faint grid, like a lab notebook. The tokens are at the top of `src/styles/global.css`.
- **What every picture has to pass.** One message a visitor can get at first glance, said in
  plain words in its caption. Labels avoid jargon ("camera", not "RGB-D"). A clip that moves for
  more than a few seconds can be paused.
- **Spaces around links** are tidied by `src/middleware.ts` on every page. The formatter breaks
  long lines inside links, and in HTML those breaks are spaces: a space at the end of a link is
  underlined with it, and a space before a full stop shows as a gap. A test checks for both.
- **Motion** - page-load intros, scroll reveals, rules that draw themselves, a
  reading-progress bar, and cross-page transitions. All of it is switched off for visitors
  who ask their system for reduced motion, and the page is fully readable without JavaScript.
- **Fonts** - Archivo (variable, from `@fontsource-variable/archivo`) and IBM Plex Mono for
  small labels, both self-hosted.

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
