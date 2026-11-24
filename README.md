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

| Command            | What it does                                                    |
| ------------------ | --------------------------------------------------------------- |
| `npm run dev`      | Start the dev server with live reload                           |
| `npm run build`    | Build the static site into `dist/`                              |
| `npm run preview`  | Serve the built site locally                                    |
| `npm run check`    | Type-check the code and validate all content against its schema |
| `npm run format`   | Format everything with Prettier                                 |
| `npm test`         | Build the site and run the end-to-end tests (Playwright)        |
| `npm run verify`   | Formatting, type and content checks, build, and tests in one go |
| `npm run content`  | Fetch the live content into `content/`                          |
| `npm run dev:live` | Start the dev server on the live content                        |
| `npm run publish`  | Publish the site now (needs the GitHub CLI, signed in)          |

The first test run needs a browser: `npx playwright install chromium`.

## Content

The site's code is here. Its content (every paper, person, talk, release, course, and research
area) is in a second repository,
[corso-group-lab-website-content](https://github.com/kevinyjn1/corso-group-lab-website-content),
where people who are not programmers edit it through forms. **That repository's README is the
guide to editing and to managing the site.** This section is for whoever works on the code.

### Where the site reads content from

Each entry is one small YAML file named by its id, in a folder per kind:

| Folder          | One file per                       |
| --------------- | ---------------------------------- |
| `publications/` | paper                              |
| `people/`       | person, current or alumni          |
| `media/`        | talk, podcast, article, or essay   |
| `resources/`    | dataset or software release        |
| `courses/`      | course                             |
| `areas/`        | research area (a fixed set of six) |

The site builds from the folder named in `CONTENT_DIR`. Without it, it builds from
[`sample-content/`](sample-content/): a frozen copy of the content, kept here so that the code can
be built and tested on its own and so that the tests of the design have fixed words to test
against. To work with the live content instead, run `npm run content` once (it clones the content
repository into `content/`, which Git ignores here) and then `npm run dev:live`.

Text and other parts of the pages that are not lists are still in the code, mostly in
`src/lib/` (`site.ts`, `thesis.ts`, `vigil.ts`) and in the pages themselves.

### The rules an entry must meet

[`src/content.config.ts`](src/content.config.ts) says what each kind of entry holds. A build that
finds a wrong value stops and names the entry and the field. The rules read what a form writes (a
box left empty is "not given"), and refuse a value of the wrong kind, a field they do not know, and
any link that is not an `http` or `https` address.

When a rule changes, three things change together: the rule here, the form in the content
repository's `.pages.yml`, and the sample content. The CI job "Verify (live content)" builds the
live content with the new code and fails if they no longer fit, and the code is not released
until it passes.

Pictures are still part of the code. A portrait is an image in `src/assets/people/` named after
the person's file (`yayuan-li.jpg` for `people/yayuan-li.yaml`); people without one are shown by
their initials. A YouTube video's thumbnail is an image in `src/assets/media/` named after its
`youtubeId`.

The home page names some of the venues the group publishes at; the build stops if a venue it
names has fewer than five papers on the list.

## Security

The site is static: no server, no logins, no forms, no cookies, no outside scripts. What can go
wrong is that its content or its code is changed by someone who should not, so that is what the
setup guards.

- **The editor reaches the content and nothing else.** The editing tool (Pages CMS, an outside
  service) is installed only on the content repository. It has no access to this one.
- **Content is untrusted until checked.** Before a publish,
  [`scripts/content-gate.mjs`](scripts/content-gate.mjs) copies from the content repository only
  what it recognizes (the six folders, plain `.yaml` files with simple names, one entry each, of a
  sane size, with no links to other places and no YAML tricks) and never runs anything it reads.
  Then the rules above check every field, and
  [`tests/publish.spec.ts`](tests/publish.spec.ts) tests every page of the build.
- **Only the site's own code runs in a visitor's browser.** Every page carries a content
  security policy (`security.csp` in [`astro.config.mjs`](astro.config.mjs)): scripts and style
  sheets must be the site's own, each inline one by its hash; the only outside frame is the video
  player; forms and plugins are refused. So text or a link slipped into the content cannot run
  code.
- **Publishing happens in one place.** The content repository's workflow builds with the code at
  this repository's `release` branch, which CI moves only to a commit that has passed every
  check, and it publishes only from that repository's `main` branch.
- **No keys or passwords are stored** in either repository.

`npm run test:content` runs the tests of the gate and of the rules: what each lets through and
what each stops.

## Structure

```
src/
  content.config.ts   The rules every entry of the content must meet
  lib/                Site config and content helpers
  layouts/Base.astro  Page shell: head, fonts, theme, header, footer
  components/         Header, footer, publication row, figures, clips, charts
  pages/              One file per page
  scripts/            Browser code: clips, publication filter, motion
  styles/global.css   Design tokens and shared styles
sample-content/       A frozen copy of the content, for building and testing the code
scripts/              The content gate, and the tests of the gate and of the rules
tests/
  publish.spec.ts     The checks every publish must pass, whatever the content says
  site.spec.ts        The tests of the design, written against the sample content
```

## The home page, and the thesis

The home page is a brief introduction to the group, about five screens long on a laptop:

1. the group's aim, in the title of Prof. Corso's 2026 talk "Physically-Grounded Agentic
   Upskilling", with what each word means and a photograph of the system at work;
2. who is in the group;
3. its six research areas, each a card with part of a real figure;
4. VIGIL, its project in the field;
5. its four newest papers; and how to join.

It carried much more until November 2026: the whole argument with its results, the history, the
four surgical results, a media section, and a list of releases. The feedback was that the home
page read like the Research page and was overwhelming. So the argument now opens the Research
page, where its depth belongs, and Media and Code & data are reached from the menu. A test holds
the home page to this order and to a short length. When something new seems to belong on the
home page, it most likely belongs on its own page with a link.

The thesis itself, AI that guides a person through a physical task and makes them better at it,
is laid out on the Research page:

- **The words** are in `src/lib/thesis.ts`: the definition, what each word means, the talk's
  three claims, and the arc from the kitchen to the clinic. The talk's slides are not public, so
  the site quotes only its title, its three claims, and its closing idea, and links every result
  to its published paper.
- **The first screen of the home page** is the title of the talk on one line, the definition,
  two buttons, and a photograph of VIGIL guiding a heart exam. Everything on it is visible without scrolling on a
  laptop. The headline is sized from the width of the page so that it always fits one line from
  a tablet up; a test holds it to 68 pixels or less.
- **Two real results** carry the first two claims: a real example from the AAAI 2023 paper on
  hazy oracles (its Figure 4, cut into three panels), and a clip of the group's own video of
  the CVPR 2026 results on mistake attribution (`src/components/Thesis.astro`). The two claims
  share one grid, so the same part of each (words, title, picture, caption, text, papers) sits
  on the same line and the two pictures are one height. The third claim is the VIGIL band.
- **The arc** from the kitchen to the clinic is three columns: two of dated steps and one with
  the group's own footage of MILLY catching a skipped step. The last step, the rural clinic,
  closes them as one line. On a small laptop there are two columns, with the last step under
  the clip.
- **No holes.** On every page, blocks that sit side by side end together: the owner asked in
  November 2026 for white space that has a purpose. Tests measure each pair of columns at five
  laptop widths. The means, in the order to reach for them:
  - give two neighbors the same parts on one grid, so the parts line up (the two claims of the
    thesis; each part of "How it works" on the VIGIL page, with its two pictures at one size);
  - let the shorter side take up the height that is left: a photograph that grows (the hero), a
    list whose rows share it out (`MediaLead.astro`, the links under the portrait on the People
    page), a box or a set of rules that runs to the foot of its neighbor (the quotation and the
    three reasons on the VIGIL page);
  - show beside a picture only as much of a list as the picture is tall, and run the rest under
    both (`MediaLead.astro`);
  - run a block with no neighbor of its size across the page (the honors on the People page, the
    four services on the VIGIL page, each group of members);
  - put any grid of cards on `.fill-rows` (`src/styles/global.css`): three to a row, and when
    the count leaves one or two over, the last rows hold two wider cards each, so no cell stays
    empty.
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
- **Videos and press** are ordinary entries in the content's `media/` folder marked `project: vigil`, so
  they appear on the Media page and on the VIGIL page.
- **Related papers** are the publication ids listed under `papers` in `src/lib/vigil.ts`.
- **Footage** of the system is shown in "How it works" and in the band on the home page. In
  "How it works" each of the first three parts has its name and its text across the top and two
  pictures of one size under them; the fourth, running without a network, has nothing to film
  yet and is stated in words. The clips are in `src/assets/clips/`, silent, 9 to 12
  seconds each and about 1 MB or less. Four of the five VIGIL clips are cut from the two videos
  of the November 2025 demonstrations that Prof. Corso published on YouTube; the page shows both
  videos in full under the clips (the two `vigil-demo-...` entries in `media/`). They are
  placed with `src/components/Clip.astro`, which plays a clip only while it is on screen, lets it
  be paused, and keeps it still for visitors who ask for reduced motion. To add one, cut it with
  `ffmpeg -ss <start> -to <end> -i <source> -an -vf scale=1280:-2,fps=24 -c:v libx264 -crf 27
-preset slow -pix_fmt yuv420p -movflags +faststart <name>.mp4`, save one frame of it as the
  poster in `src/assets/clips/posters/`, and describe what it shows in the `alt` text.
- **Photographs of ARPA-H's 2026 site visit** (`src/assets/vigil/site-visit-*.jpg`) are the
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

## Publishing

The site is published by the content repository's
[Publish workflow](https://github.com/kevinyjn1/corso-group-lab-website-content/actions/workflows/publish.yml),
to GitHub Pages:

https://kevinyjn1.github.io/corso-group-lab-website-content/

It runs when the content changes, once a night, and when asked to. A change to the code reaches
the site like this:

1. Push to `main` here. CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs every
   check, at a domain root and under a sub-path, against the sample content and against the live
   content.
2. If all pass, CI moves the `release` branch to that commit. If any fail, `release` stays where
   it was and the site goes on being published with the last good code.
3. The site is rebuilt with the new code on the next publish. `npm run publish` starts one now.

That deployment is a preview. It is built with `SITE_NOINDEX=true`, which adds a
`<meta name="robots" content="noindex">` tag so search engines do not list it. Delete that setting
from the Publish workflow once the group wants the site to be found.

The address this repository's own GitHub Pages used to serve the site at now holds a page that
sends visitors on ([.github/old-address/](.github/old-address/)).

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
