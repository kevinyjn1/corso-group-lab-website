import { expect, test } from '@playwright/test';
import { at } from './base-path';
import { pages } from './helpers';

/**
 * The site as designed, tested against the sample content (sample-content/): what each page
 * says and shows, how it is laid out, and the house rules of its wording. These run when the
 * code changes. The checks that every publish of new content must pass are in publish.spec.ts.
 */

for (const path of pages) {
  test(`${path} has one title that fits, and keeps the house style`, async ({ page }) => {
    await page.goto(at(path));
    await page.evaluate(() => document.fonts.ready);

    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page).toHaveTitle(/Corso Group/);

    // The title fits: no word of it runs past the edge of its own box.
    const spill = await page
      .locator('h1')
      .evaluate((title) => title.scrollWidth - title.clientWidth);
    expect(spill, 'title overflow').toBeLessThanOrEqual(1);

    // House style: plain dashes only.
    expect(await page.locator('body').innerText()).not.toContain('—');
  });
}

test.describe('publications', () => {
  test('search narrows the list and can be cleared', async ({ page }) => {
    await page.goto(at('/publications/'));
    const visible = page.locator('[data-pub]:visible');
    const total = await page.locator('[data-pub]').count();
    await expect(visible).toHaveCount(total);

    await page.getByRole('searchbox').fill('captioning');
    await expect(page.locator('[data-filter-status]')).toContainText(`of ${total} publications`);
    expect(await visible.count()).toBeLessThan(total);
    expect(await visible.count()).toBeGreaterThan(0);
    await expect(page).toHaveURL(/q=captioning/);

    await page.getByRole('searchbox').fill('no paper has this title zzz');
    await expect(visible).toHaveCount(0);
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(visible).toHaveCount(total);
  });

  test('a research area in the URL pre-filters the list', async ({ page }) => {
    await page.goto(at('/publications/?topic=health'));
    const health = page.locator('[data-filter-topic="health"]');
    await expect(health).toHaveAttribute('aria-pressed', 'true');
    const topics = await page
      .locator('[data-pub]:visible')
      .evaluateAll((items) => items.map((item) => (item as HTMLElement).dataset.topics ?? ''));
    expect(topics.length).toBeGreaterThan(0);
    expect(topics.every((value) => value.split(' ').includes('health'))).toBe(true);

    // Pressing the active area again returns to the full list.
    await health.click();
    await expect(page.locator('[data-filter-topic=""]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page).not.toHaveURL(/topic=/);
  });

  test('type filter and year chart work together', async ({ page }) => {
    await page.goto(at('/publications/'));
    await page.getByRole('combobox').selectOption('journal');
    const types = await page
      .locator('[data-pub]:visible')
      .evaluateAll((items) => items.map((item) => (item as HTMLElement).dataset.type));
    expect(new Set(types)).toEqual(new Set(['journal']));

    // Jumping to a year from the chart clears filters so the year is present.
    await page.locator('[data-year-link]').first().click();
    await expect(page.getByRole('combobox')).toHaveValue('');
    await expect(page).toHaveURL(/#year-\d{4}$/);
  });
});

test.describe('the operating room on the home page', () => {
  test('surgery and the heart are shown by four real figures, oldest first, each with its paper', async ({
    page,
  }) => {
    await page.goto(at('/'));
    const results = page.locator('#operating-room .result');
    await expect(results).toHaveCount(4);
    const years = (await results.locator('.result-year').allInnerTexts()).map(Number);
    expect(years).toEqual([...years].sort((a, b) => a - b));
    expect(years[0]).toBe(2004);

    const shapes = new Set<string>();
    for (const result of await results.all()) {
      await result.scrollIntoViewIfNeeded();
      const image = result.locator('img');
      await expect(image).toHaveAttribute('alt', /\S.{60,}/);
      await expect
        .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(200);
      // The whole figure is in view inside its sheet: nothing is cropped to make it fit.
      await expect(image).toHaveCSS('object-fit', 'contain');
      const sheet = (await result.locator('.result-sheet').boundingBox())!;
      shapes.add((sheet.width / sheet.height).toFixed(1));
      await expect(result.locator('.result-name')).not.toBeEmpty();
      await expect(result.locator('.result-what')).toHaveText(/\S.{60,}\.$/);
      // It names the figure and the paper it is from, and links to the paper.
      const source = result.locator('.result-source a');
      await expect(source).toHaveText(/^(From )?Figure \d+ of .+ (19|20)\d\d/);
      await expect(source).toHaveAttribute('href', /^https:\/\//);
    }
    // Every sheet is the same shape.
    expect([...shapes]).toHaveLength(1);
  });

  test('nothing on the home page stays hidden with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(at('/'));
    await expect(page.locator('#operating-room .result')).toHaveCount(4);
    const hidden = await page
      .locator('[data-reveal], [data-reveal="stagger"] > *')
      .evaluateAll(
        (items) => items.filter((item) => getComputedStyle(item).opacity !== '1').length,
      );
    expect(hidden).toBe(0);
  });
});

test('no page draws its figures: every picture of the work is a photograph, a clip, or a figure from a paper', async ({
  page,
}) => {
  for (const path of ['/', '/research/', '/vigil/']) {
    await page.goto(at(path));
    await expect(
      page.locator('canvas, [data-figure], [data-hero-scene], [data-console]'),
    ).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText(/illustration|not footage/i);
    // No figure is numbered by the site itself. A number belongs to the paper a figure is from.
    await expect(page.locator('main')).not.toContainText(/\bFig\. \d/);
  }
});

test('every page title fits on the narrowest phones', async ({ page, isMobile }) => {
  test.skip(isMobile, 'This test sets its own screen widths.');
  // 320 is the narrowest phone in use, and 390 the commonest: both are narrower than the Pixel
  // the other tests run on.
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of pages) {
      await page.goto(at(path));
      await page.evaluate(() => document.fonts.ready);
      const spill = await page.evaluate(() => {
        const title = document.querySelector('h1')!;
        return {
          title: title.scrollWidth - title.clientWidth,
          page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      expect(spill.title, `${path} title at ${width}px`).toBeLessThanOrEqual(1);
      expect(spill.page, `${path} page at ${width}px`).toBeLessThanOrEqual(0);
    }
  }
});

test('primary buttons stand out from the field they sit on, in both themes', async ({ page }) => {
  for (const theme of ['light', 'dark']) {
    await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
    await page.goto(at('/vigil/'));
    const colors = await page.locator('.page-head .btn--primary').evaluate((button) => ({
      button: getComputedStyle(button).backgroundColor,
      field: getComputedStyle(button.closest('.page-head')!).backgroundColor,
      ink: getComputedStyle(button).color,
    }));
    expect(colors.button, theme).not.toBe(colors.field);
    expect(colors.ink, theme).not.toBe(colors.button);
  }
});

test('color fields are textured, not flat fills', async ({ page }) => {
  await page.goto(at('/vigil/'));
  for (const selector of ['.page-head', '.band--blue', '.band--maize']) {
    const image = await page
      .locator(selector)
      .first()
      .evaluate((field) => getComputedStyle(field).backgroundImage);
    expect(image, selector).toContain('gradient');
  }
});

test('scrolling reveals content that starts hidden', async ({ page }) => {
  await page.goto(at('/'));
  const card = page.locator('.areas > li').first();
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveClass(/is-visible/);
  await expect(card).toHaveCSS('opacity', '1');
});

test('the page is light by default, and a chosen theme persists across pages', async ({ page }) => {
  // The light page is the design's default, whatever the system setting.
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(at('/'));
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Switch color theme' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.goto(at('/people/'));
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch color theme' }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
});

test('navigation reaches every page', async ({ page, isMobile }) => {
  await page.goto(at('/'));
  const targets = [
    ['Research', '/research/'],
    ['VIGIL', '/vigil/'],
    ['Publications', '/publications/'],
    ['People', '/people/'],
    ['Code & Data', '/resources/'],
    ['Teaching', '/teaching/'],
    ['Media', '/media/'],
    ['Join', '/join/'],
  ];
  for (const [label, path] of targets) {
    if (isMobile) {
      await page.getByRole('button', { name: 'Open menu' }).click();
      await page
        .getByRole('navigation', { name: 'Mobile' })
        .getByRole('link', { name: label })
        .click();
    } else {
      await page
        .getByRole('navigation', { name: 'Primary' })
        .getByRole('link', { name: label })
        .click();
    }
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.locator('h1')).toBeVisible();
  }
});

test('mobile menu closes with Escape', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'The menu button only exists on small screens.');
  await page.goto(at('/'));
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Mobile' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation', { name: 'Mobile' })).toBeHidden();
});

test('portraits load, and people without a photo fall back to initials', async ({ page }) => {
  await page.goto(at('/people/'));
  const photo = page.getByRole('img', { name: 'Portrait of Jason J. Corso' });
  await expect(photo).toBeVisible();
  expect(
    await photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth),
  ).toBeGreaterThan(0);
  await expect(page.locator('.members .initials').first()).toBeVisible();
});

test('current members are grouped, and nobody is listed twice', async ({ page }) => {
  await page.goto(at('/people/'));
  const students = await page.locator('.members .member:not(.member--open) h3').allInnerTexts();
  expect(students.length).toBeGreaterThan(0);

  const groups = page.locator('.groups > div');
  expect(await groups.count()).toBeGreaterThan(0);
  const names = [...students];
  for (const group of await groups.all()) {
    await expect(group.getByRole('heading')).toBeVisible();
    const listed = await group.locator('li > span:first-child').allInnerTexts();
    expect(listed.length).toBeGreaterThan(0);
    names.push(...listed);
  }
  expect(new Set(names).size).toBe(names.length);

  // The home page names the same students.
  await page.goto(at('/'));
  await expect(page.locator('.roster > div').nth(1).locator('dd')).toHaveText(students);
});

test("the mark's eye follows the pointer and its gear turns with the page", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'There is no pointer to follow on a touch screen.');
  await page.goto(at('/'));
  const logo = page.locator('header [data-logo]');
  await expect(logo).toBeVisible();

  const look = () => logo.evaluate((el) => (el as SVGElement).style.getPropertyValue('--look-x'));
  await page.mouse.move(900, 500);
  await expect.poll(look).not.toBe('');
  expect(Number(await look())).toBeGreaterThan(0);
  await page.mouse.move(0, 30);
  await expect.poll(async () => Number(await look())).toBeLessThan(0);

  await page.mouse.wheel(0, 1300);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--cog-turn')))
    .toMatch(/^0\.[1-9]\d*turn$/);
});

test('every research area is set on one grid: its text in one column, its two real pictures in the other', async ({
  page,
  isMobile,
}) => {
  await page.goto(at('/research/'));
  const areas = page.locator('section.area');
  await expect(areas).toHaveCount(6);
  const leads = new Set<string>();
  for (const area of await areas.all()) {
    const id = (await area.getAttribute('id'))!;
    const lead = area.locator('.area-lead');
    await lead.scrollIntoViewIfNeeded();
    // The lead is one thing: a figure from a paper, or a clip of the group's footage.
    const figure = lead.locator('[data-paper-figure]');
    const clip = lead.locator('[data-clip]');
    expect((await figure.count()) + (await clip.count()), id).toBe(1);
    if (await clip.count()) {
      leads.add(`clip:${await clip.locator('source').getAttribute('src')}`);
      await expect(clip.locator('figcaption .clip-source')).toHaveText(/(19|20)\d\d$/);
      await expect(clip.locator('figcaption a.clip-source')).toHaveAttribute('href', /^https:\/\//);
    } else {
      leads.add(`figure:${await figure.getAttribute('data-paper-figure')}`);
    }
    // The second figure is from a different paper than the lead.
    const second = area.locator('.area-second [data-paper-figure]');
    await expect(second).toHaveCount(1);
    expect(leads.has(`figure:${await second.getAttribute('data-paper-figure')}`), id).toBe(false);

    // Both pictures are framed at the same width, one under the other, and each caption runs
    // the full width of its picture: none is squeezed into a narrow block beside it.
    const frames = await area
      .locator('.area-figures .sheet, .area-figures .clip-frame')
      .evaluateAll((els) =>
        els.map((el) => {
          const box = el.getBoundingClientRect();
          return { left: Math.round(box.left), width: Math.round(box.width), top: box.top };
        }),
      );
    expect(frames, id).toHaveLength(2);
    expect(Math.abs(frames[0].width - frames[1].width), id).toBeLessThanOrEqual(1);
    expect(Math.abs(frames[0].left - frames[1].left), id).toBeLessThanOrEqual(1);
    expect(frames[0].top, id).toBeLessThan(frames[1].top);
    const captions = await area
      .locator('.area-figures figcaption')
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().width)));
    for (const width of captions)
      expect(Math.abs(width - frames[0].width), id).toBeLessThanOrEqual(1);
    // No picture stands taller than the cap, so a pair stays near the height of the text.
    const tallest = await area
      .locator('.area-figures .sheet img, .area-figures video')
      .evaluateAll((els) => Math.max(...els.map((el) => el.getBoundingClientRect().height)));
    expect(tallest, id).toBeLessThanOrEqual(481);

    const text = (await area.locator('.area-body').boundingBox())!;
    const head = (await area.locator('.area-head').boundingBox())!;
    if (isMobile) {
      // One column: the name, the pictures, then the text.
      expect(head.y, id).toBeLessThan(frames[0].top + (await page.evaluate(() => window.scrollY)));
      expect(Math.abs(text.x - frames[0].left), id).toBeLessThanOrEqual(1);
    } else {
      // Two columns: name and text on the left, pictures on the right, starting level.
      expect(text.x + text.width, id).toBeLessThanOrEqual(frames[0].left);
      expect(Math.abs(head.x - text.x), id).toBeLessThanOrEqual(1);
      expect(text.width, id).toBeGreaterThanOrEqual(380);
    }
  }
  expect(leads.size).toBe(6);
});

test('on a laptop, the text and the pictures of a research area end near each other', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'On a phone the area is one column.');
  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(at('/research/'));
    await page.evaluate(() => document.fonts.ready);
    // A picture's size comes from its proportions, so nothing has to load to measure the page.
    const gaps = await page.locator('section.area').evaluateAll((areas) =>
      areas.map((area) => {
        const textEnd = area.querySelector('.area-body')!.lastElementChild!.getBoundingClientRect();
        const figureEnd = Math.max(
          ...[...area.querySelectorAll('.area-figures figcaption')].map(
            (caption) => caption.getBoundingClientRect().bottom,
          ),
        );
        return { id: area.id, gap: Math.round(textEnd.bottom - figureEnd) };
      }),
    );
    for (const { id, gap } of gaps) {
      expect(Math.abs(gap), `${id} at ${width}: ${gap}px`).toBeLessThanOrEqual(200);
    }
  }
});

test('each research card on the home page shows part of a real figure, and says which', async ({
  page,
}) => {
  await page.goto(at('/'));
  const cards = page.locator('.areas .area');
  await expect(cards).toHaveCount(5);
  const sources = new Set<string>();
  const shapes = new Set<string>();
  for (const card of await cards.all()) {
    await card.scrollIntoViewIfNeeded();
    const image = card.locator('.area-figure img');
    await expect(image).toHaveAttribute('alt', /\S.{60,}/);
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(300);
    await expect(image).toHaveCSS('object-fit', 'contain');
    const frame = (await card.locator('.area-figure').boundingBox())!;
    shapes.add((frame.width / frame.height).toFixed(1));
    // The card is itself a link, so the source is plain text: the figure, who, where, and when.
    const source = card.locator('.area-source');
    await expect(source).toHaveText(/^From Figure \d+ of .+, .+ (19|20)\d\d$/);
    await expect(source.locator('a')).toHaveCount(0);
    sources.add(await source.innerText());
  }
  expect(sources.size).toBe(5);
  expect([...shapes]).toHaveLength(1);
});

/** A clip of the group's footage: silent, looping, described, and held still on request. */
async function expectClip(clip: import('@playwright/test').Locator, tag = 'Footage') {
  const video = clip.locator('video');
  await expect(video).toHaveAttribute('aria-label', /\S.{40,}/);
  await expect(video).toHaveAttribute('poster', /\S+/);
  await expect(video).toHaveJSProperty('muted', true);
  await expect(video).toHaveJSProperty('loop', true);
  await expect(video).toHaveAttribute('playsinline', '');
  await expect(video).toHaveAttribute('preload', 'none');
  await expect(video.locator('source')).toHaveAttribute('src', /\.mp4$/);
  await expect(clip.locator('.clip-tag')).toContainText(tag);
  await expect(clip.locator('figcaption')).not.toBeEmpty();
}

test('clips of the system play while on screen and can be held still', async ({ page }) => {
  await page.goto(at('/'));
  const clip = page.locator('section.vigil [data-clip]');
  await expectClip(clip);
  const video = clip.locator('video');
  const toggle = clip.locator('[data-clip-toggle]');
  // Nothing is fetched or played before the clip is on screen.
  await expect(clip).toHaveAttribute('data-playing', 'false');
  await expect(toggle).toHaveAccessibleName('Play the clip');

  // The clip itself is on the site.
  const src = await video.locator('source').evaluate((el: HTMLSourceElement) => el.src);
  const response = await page.request.get(src);
  expect(response.status()).toBe(200);
  const bytes = await response.body();
  // An MP4 file, whatever the server calls it, and small enough to load on a phone.
  expect(bytes.subarray(4, 8).toString('latin1')).toBe('ftyp');
  expect(bytes.byteLength).toBeLessThan(1_600_000);

  const canPlay = await video.evaluate(
    (el: HTMLVideoElement) => el.canPlayType('video/mp4; codecs="avc1.640028"') !== '',
  );
  test.skip(!canPlay, 'This browser build cannot decode H.264, so there is nothing to play.');

  await clip.scrollIntoViewIfNeeded();
  await expect(clip).toHaveAttribute('data-playing', 'true');
  await expect(toggle).toHaveAccessibleName('Pause the clip');
  await toggle.click();
  await expect(clip).toHaveAttribute('data-playing', 'false');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  // Held means held: scrolling away and back does not start it again.
  await page.locator('footer').scrollIntoViewIfNeeded();
  await clip.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await expect(clip).toHaveAttribute('data-playing', 'false');
  await toggle.click();
  await expect(clip).toHaveAttribute('data-playing', 'true');
});

test('clips stay still for visitors who ask for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(at('/vigil/'));
  const clip = page.locator('#how [data-clip]').first();
  await clip.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await expect(clip).toHaveAttribute('data-playing', 'false');
  await expect(clip.locator('[data-clip-toggle]')).toHaveAccessibleName('Play the clip');
});

test('VIGIL is introduced on the home page and leads to its own page', async ({ page }) => {
  await page.goto(at('/'));
  const band = page.locator('section.vigil');
  await expect(band.getByRole('heading', { name: 'VIGIL' })).toBeVisible();
  await expect(band).toContainText(
    'Vectors of Intelligent Guidance in Long-Reach Rural Healthcare',
  );
  // The band shows the team's own footage of the system, not a drawing of it.
  await expect(band.locator('canvas')).toHaveCount(0);
  await expectClip(band.locator('[data-clip]'));
  await expect(band.locator('[data-clip] figcaption a')).toHaveAttribute('href', /\/vigil\/#how$/);

  await band.getByRole('link', { name: /Inside VIGIL/ }).click();
  await expect(page).toHaveURL(/\/vigil\/$/);
  await expect(page.locator('h1')).toContainText('VIGIL');
  await expect(page.locator('h1')).toContainText('Long-Reach Rural Healthcare');

  // The project is named for what it is and who funds it. The site does not rank its own work.
  for (const path of ['/', '/research/', '/vigil/']) {
    await page.goto(at(path));
    await expect(page.locator('body')).not.toContainText(/flagship/i);
    expect(await page.locator('meta[name="description"]').getAttribute('content')).not.toMatch(
      /flagship/i,
    );
  }
});

test('the VIGIL page states its facts plainly: no footnote numbers, and every link goes somewhere exact', async ({
  page,
}) => {
  await page.goto(at('/vigil/'));
  // The page has no numbered references and no list of sources.
  await expect(page.locator('.cite, sup, #sources, [href^="#source-"]')).toHaveCount(0);

  // No outside link is a stand-in for the thing it names: a post is linked as the post itself.
  const outside = await page
    .locator('main a[href^="http"]')
    .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
  expect(outside.length).toBeGreaterThan(10);
  for (const url of outside) {
    expect(url, url).not.toMatch(/recent-activity|\/feed\/?$|[?&](utm_|rcm=|trk=)/);
    if (url.includes('linkedin.com')) expect(url, url).toMatch(/linkedin\.com\/posts\/[\w-]+\/$/);
  }

  // The few links kept in the text: the award, the quoted article, and the post with the picture.
  await expect(page.locator('.plate-note a')).toHaveAttribute('href', /arpa-h\.gov\/.+awards/);
  await expect(page.locator('.quote figcaption a')).toHaveAttribute(
    'href',
    /news\.engin\.umich\.edu/,
  );
  await expect(page.locator('.team-wall figcaption a')).toHaveAttribute(
    'href',
    /linkedin\.com\/posts\/jason-corso_the-team-the-team/,
  );

  // Every row of the timeline is a date, and what is still ahead is said after it.
  const whens = await page.locator('.timeline .when').allInnerTexts();
  expect(whens.length).toBeGreaterThanOrEqual(5);
  for (const when of whens) expect(when).toMatch(/^[A-Z][a-z]+ 20\d\d$/);
  await expect(page.locator('.ahead')).toContainText('Still ahead');
});

test('the VIGIL page says who it is for, and gives its numbers in sentences', async ({ page }) => {
  await page.goto(at('/vigil/'));
  // The team's own line leads the summary, under the name as ARPA-H lists it.
  await expect(page.locator('.page-head .lead strong')).toHaveText(
    "Specialist-level care, anywhere it's needed.",
  );
  await expect(page.locator('.page-head h1')).toContainText('Long-Reach Rural Healthcare');

  // Not a replacement: the person it works beside, described once, and who gains from it.
  const who = page.locator('#who');
  await expect(who.locator('h2')).toHaveText(/Not a replacement\.\s+A\s+teammate\s*\./);
  await expect(who.locator('.who-text')).toContainText('VIGIL is a human-AI team');
  await expect(who.locator('.benefits .service-name')).toHaveText([
    'Rural veterans and patients',
    'Healthcare workers',
    'The health system',
  ]);
  for (const gain of await who.locator('.benefit-gain').allInnerTexts()) {
    expect(gain, gain).toMatch(/^[A-Z].+\.$/);
  }
  const text = await page.locator('main').innerText();
  expect(text.match(/works beside is a generalist/g)).toHaveLength(1);

  // The first eighteen months are a sentence under the heading, not a row of big figures.
  const progress = page.locator('section.progress');
  await expect(progress.locator('.section-head p').last()).toContainText(
    'more than a million ultrasound frames',
  );
  await expect(progress.locator('dl, .figures')).toHaveCount(0);
});

test('the VIGIL page has the talk, the coverage, and the papers', async ({ page }) => {
  const requested: string[] = [];
  await page.route(/youtube/, (route) => {
    requested.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<title>player</title>' });
  });
  await page.goto(at('/vigil/'));
  const watch = page.locator('#watch');
  await watch.scrollIntoViewIfNeeded();
  // Three items beside the talk, and the older ones under both.
  await expect(watch.locator('.record-list > li')).toHaveCount(3);
  expect(await watch.locator('.rows > li').count()).toBeGreaterThanOrEqual(6);
  expect(requested).toEqual([]);
  await watch.getByRole('button', { name: /^Play video: VIGIL/ }).click();
  await expect(watch.locator('iframe')).toHaveAttribute('src', /\/embed\/G77AdX2qapg\?/);

  await expect(page.locator('.papers .rows > li')).toHaveCount(3);
  await expect(page.locator('.team .subteam')).toHaveCount(3);
});

test('the VIGIL page links the published demonstrations in full and shows the team', async ({
  page,
  request,
}) => {
  const requested: string[] = [];
  await page.route(/youtube/, (route) => {
    requested.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<title>player</title>' });
  });
  await page.goto(at('/vigil/'));

  // The two videos the clips are cut from, each with its own thumbnail and a link to the source.
  const demos = page.locator('#how .demos .video');
  await expect(demos).toHaveCount(2);
  for (const [i, id] of ['7-FjCJlS3gU', 'qL46iG-To-I'].entries()) {
    const demo = demos.nth(i);
    await demo.scrollIntoViewIfNeeded();
    await expect(demo.locator('[data-video]')).toHaveAttribute('data-video', id);
    await expect(demo.locator('.h3 a')).toHaveAttribute('href', new RegExp(`watch\\?v=${id}$`));
    await expect(demo.locator('.summary')).toHaveText(/\S.{60,}/);
    const thumb = demo.locator('img');
    await expect
      .poll(() => thumb.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
  }
  // The note under the clips says where they come from.
  const note = page.locator('#how .note--all').first();
  await expect(note).toContainText('cut from the two videos');
  // They are shown once: the list of coverage further down does not repeat them.
  await expect(
    page.locator('#watch a[href*="7-FjCJlS3gU"], #watch a[href*="qL46iG-To-I"]'),
  ).toHaveCount(0);
  expect(requested).toEqual([]);
  await demos
    .nth(1)
    .getByRole('button', { name: /^Play video/ })
    .click();
  await expect(demos.nth(1).locator('iframe')).toHaveAttribute('src', /\/embed\/qL46iG-To-I\?/);

  // The picture of the team: described, loaded, sharp enough to read, and it opens at full size.
  const wall = page.locator('.team-wall');
  await wall.scrollIntoViewIfNeeded();
  const picture = wall.locator('img');
  await expect(picture).toHaveAttribute('alt', /\S.{80,}/);
  await expect
    .poll(() => picture.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  // The file the browser chose has enough pixels for the size it is drawn at.
  const drawn = await picture.evaluate(async (img: HTMLImageElement) => {
    const file = new Image();
    file.src = img.currentSrc;
    await file.decode();
    const box = img.getBoundingClientRect();
    return {
      needed: box.width * window.devicePixelRatio,
      pixels: file.naturalWidth,
      ratio: file.naturalWidth / file.naturalHeight,
      box: box.width / box.height,
    };
  });
  expect(drawn.pixels).toBeGreaterThanOrEqual(Math.min(drawn.needed, 2000) * 0.95);
  expect(Math.abs(drawn.ratio - drawn.box)).toBeLessThan(0.02);
  await expect(wall.locator('figcaption')).toContainText('ten institutions');
  const full = await wall.locator('> a').getAttribute('href');
  const response = await request.get(new URL(full!, page.url()).href);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toMatch(/^image\//);
});

test('the VIGIL page shows the system at work: photos, footage, and the demo day', async ({
  page,
}) => {
  await page.goto(at('/vigil/'));

  // A photograph from the group's mock clinic and three of the demonstration, each described.
  const photos = page.locator('#in-the-room .photo img');
  await expect(photos).toHaveCount(4);
  for (const photo of await photos.all()) {
    await photo.scrollIntoViewIfNeeded();
    await expect(photo).toHaveAttribute('alt', /\S{4,}/);
    await expect
      .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
  }

  // The parts of the system that can be filmed are shown in the team's own footage or
  // photographs, two pictures each. The last, running with no network, is stated in words.
  const parts = page.locator('#how .part');
  await expect(parts).toHaveCount(4);
  for (const [i, part] of (await parts.all()).entries()) {
    await expect(part.locator('.h3')).not.toBeEmpty();
    await expect(part.locator('.step-body')).not.toBeEmpty();
    await expect(part.locator('[data-clip], .photo')).toHaveCount(i < 3 ? 2 : 0);
  }
  const clips = page.locator('#how [data-clip]');
  await expect(clips).toHaveCount(5);
  for (const clip of await clips.all()) await expectClip(clip);
  const still = page.locator('#how .part .photo img');
  await still.scrollIntoViewIfNeeded();
  await expect
    .poll(() => still.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);

  // The two exams are shown start to finish by the team's own videos, and nothing is drawn.
  await expect(page.locator('#how .demos .video')).toHaveCount(2);
  await expect(page.locator('#how canvas')).toHaveCount(0);
  await expect(page.locator('#how')).not.toContainText(/illustration/i);

  // What each team showed, and the research shown alongside.
  const posters = page.locator('#demo-day .poster');
  expect(await posters.count()).toBeGreaterThanOrEqual(8);
  for (const poster of await posters.all()) {
    await expect(poster.locator('.poster-team')).not.toBeEmpty();
    await expect(poster.locator('.poster-what')).not.toBeEmpty();
    await expect(poster.locator('.poster-people')).not.toBeEmpty();
  }
  const related = page.locator('#demo-day .related > li');
  expect(await related.count()).toBeGreaterThanOrEqual(5);
  for (const link of await related.locator('h4 a').all()) {
    await expect(link).toHaveAttribute('href', /^https:\/\/arxiv\.org\/abs\//);
  }
});

test('the VIGIL page shows the annual site visit in six photographs of one shape', async ({
  page,
  isMobile,
}) => {
  await page.goto(at('/vigil/'));
  const visit = page.locator('#site-visit');
  await expect(visit.locator('.section-head')).toContainText('site visit');
  const photos = visit.locator('.visit-photos .photo');
  await expect(photos).toHaveCount(6);
  const shapes = new Set<string>();
  for (const photo of await photos.all()) {
    await photo.scrollIntoViewIfNeeded();
    const image = photo.locator('img');
    await expect(image).toHaveAttribute('alt', /\S.{60,}/);
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(300);
    const box = (await image.boundingBox())!;
    shapes.add(`${Math.round(box.width)}x${Math.round(box.height)}`);
    // Each caption opens with what the photograph is of, then says what it shows.
    await expect(photo.locator('figcaption strong')).toHaveText(/\.\s*$/);
    await expect(photo.locator('figcaption')).toHaveText(/\S.{50,}[."]\s*$/);
  }
  // Every photograph is the same size, so the grid has no ragged rows.
  expect([...shapes]).toHaveLength(1);
  await expect(visit.locator('.photo-credit')).toHaveText(
    'Photos: Gabi Iriarte, Michigan Engineering.',
  );

  // In the block of photographs above it, the two columns end on one line.
  if (!isMobile) {
    const ends = await page.locator('#in-the-room .photos > .photo').evaluateAll((figures) =>
      figures.map((figure) => ({
        left: Math.round(figure.getBoundingClientRect().left),
        bottom: Math.round(figure.getBoundingClientRect().bottom),
      })),
    );
    const columns = new Map<number, number>();
    for (const { left, bottom } of ends)
      columns.set(left, Math.max(columns.get(left) ?? 0, bottom));
    const bottoms = [...columns.values()];
    expect(bottoms).toHaveLength(2);
    expect(Math.abs(bottoms[0] - bottoms[1])).toBeLessThanOrEqual(2);
  }
});

test('the home page leads with the thesis, then its proof, then the operating room', async ({
  page,
}) => {
  await page.goto(at('/'));
  // The headline is the group's thesis, in the words of the talk's title.
  const headline = page.locator('h1');
  await expect(headline).toHaveText(/^\s*Physically-grounded agentic\s+upskilling\s*\.\s*$/);
  // It is defined in a sentence and each word is explained, with no small print under them.
  await expect(page.locator('.hero .lead')).toContainText(
    'guides a person through a physical task',
  );
  await expect(page.locator('.hero .words div')).toHaveCount(3);
  await expect(page.locator('.hero-more > *')).toHaveCount(1);

  const order = await page.evaluate(() => {
    const top = (selector: string) =>
      document.querySelector(selector)!.getBoundingClientRect().top + window.scrollY;
    return {
      thesis: top('#thesis'),
      vigil: top('section.vigil'),
      scene: top('#operating-room'),
      areas: top('.areas'),
    };
  });
  expect(order.thesis).toBeLessThan(order.vigil);
  expect(order.vigil).toBeLessThan(order.scene);
  expect(order.scene).toBeLessThan(order.areas);

  // The first picture a visitor sees is a photograph of the system at work.
  const photo = page.locator('.hero-photo img');
  await expect(photo).toHaveAttribute('alt', /VIGIL/);
  await expect
    .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  await expect(page.locator('.hero-photo figcaption')).toContainText('VIGIL');
  await expect(page.locator('.hero-photo a')).toHaveAttribute('href', /\/vigil\/$/);
  // The third claim is numbered and worded like the two above it, and is written once.
  await expect(page.locator('section.vigil .kicker')).toHaveText(
    /^\s*03\s+It is being proven in healthcare delivery\s*$/,
  );
  await expect(page.getByText('And it is being proven')).toHaveCount(0);

  // Human-AI collaboration is the thesis itself, so the grid below shows the other five areas.
  await expect(page.locator('.areas > li')).toHaveCount(5);
  await expect(page.locator('.areas .area[data-topic="human"]')).toHaveCount(0);
});

test('the first screen is calm: one moderate line of headline, with the photograph in view', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'This test sets its own screen sizes.');
  for (const [width, height] of [
    [1280, 720],
    [1440, 900],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(at('/'));
    await page.evaluate(() => document.fonts.ready);
    const title = await page.locator('h1').evaluate((h1) => {
      const style = getComputedStyle(h1);
      const range = document.createRange();
      range.selectNodeContents(h1);
      return {
        size: parseFloat(style.fontSize),
        lines:
          range.getClientRects().length > 0
            ? Math.round(h1.clientHeight / parseFloat(style.lineHeight))
            : 0,
        width: range.getBoundingClientRect().width,
        room: h1.clientWidth,
      };
    });
    // A third of what it once was: no more than 68 pixels, on one line that fits its column.
    expect(title.size, `${width}`).toBeLessThanOrEqual(68);
    expect(title.lines, `${width}`).toBe(1);
    expect(title.width, `${width}`).toBeLessThanOrEqual(title.room + 1);
    // The definition, the buttons, and the photograph are all visible without scrolling.
    for (const selector of ['.hero .lead', '.hero .cta', '.hero-photo img']) {
      const bottom = await page
        .locator(selector)
        .evaluate((el) => el.getBoundingClientRect().bottom);
      expect(bottom, `${selector} at ${width}x${height}`).toBeLessThanOrEqual(height);
    }
  }

  // Nothing on any page is set at poster size: no text is larger than 84 pixels.
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const path of pages) {
    await page.goto(at(path));
    const largest = await page.evaluate(() => {
      const sizes = [...document.querySelectorAll('body *')]
        .filter((el) =>
          [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent!.trim()),
        )
        .map((el) => ({
          size: parseFloat(getComputedStyle(el).fontSize),
          text: el.textContent!.trim().slice(0, 30),
        }));
      return sizes.sort((a, b) => b.size - a.size)[0];
    });
    expect(largest.size, `${path}: "${largest.text}"`).toBeLessThanOrEqual(84);
  }
});

test('the home page is not a dashboard: no rows of big numbers, no ticker, no ornament that poses as data', async ({
  page,
}) => {
  await page.goto(at('/'));
  // The rows of statistics, the scrolling strip of venues, and the numbers that counted up are gone.
  await expect(page.locator('.stats, .numbers, .vigil-facts, .ticker, [data-count]')).toHaveCount(
    0,
  );
  // Where the group publishes is said once, in a sentence, beside its latest papers.
  await expect(page.getByText(/^The group's papers appear at CVPR, ICCV, and ECCV/)).toHaveCount(1);
  // No running totals on the links to more.
  for (const text of await page.locator('main a.more, main .area-count').allInnerTexts()) {
    expect(text, text).not.toMatch(/\d/);
  }
  // A video's summary says what it is about, not how long it runs.
  await expect(page.locator('main')).not.toContainText(/\b\d+ minutes\b/);
  // The footer has no coordinates.
  await expect(page.locator('footer')).not.toContainText(/°|\d\.\d{3}/);
  // The VIGIL band and the operating room share one blue field, with no edge between them.
  const join = await page.evaluate(() => {
    const band = document.querySelector('section.vigil')!.getBoundingClientRect();
    const stage = document.querySelector('.stage')!.getBoundingClientRect();
    return {
      gap: Math.round(stage.top - band.bottom),
      light: getComputedStyle(document.querySelector('.stage')!).backgroundImage,
    };
  });
  expect(join.gap).toBe(0);
  expect(join.light).not.toContain('255, 203, 5');
});

test('the thesis makes its claims with real results and the papers behind them', async ({
  page,
}) => {
  await page.goto(at('/'));
  const thesis = page.locator('#thesis');
  await expect(thesis.getByRole('heading', { level: 2 })).toContainText('Understand the task.');
  const claims = thesis.locator('.claim');
  await expect(claims).toHaveCount(2);
  await expect(claims.nth(0)).toContainText('mandates human-AI teams');
  await expect(claims.nth(1)).toContainText('must monitor for mistakes');
  for (const paper of await thesis.locator('.claim-papers a').all()) {
    await expect(paper).toHaveAttribute('href', /^https:\/\/(arxiv\.org|doi\.org)\//);
  }
  expect(await thesis.locator('.claim-papers a').count()).toBeGreaterThanOrEqual(4);

  // Both claims are shown with the group's real results, not with drawings of them.
  await expect(thesis.locator('.claims canvas')).toHaveCount(0);

  // The hazy oracle: a real photograph from the paper, with the model's own boxes and numbers.
  const result = claims.nth(0).locator('[data-result]');
  const panels = result.locator('.result-panel img');
  await expect(panels).toHaveCount(3);
  for (const panel of await panels.all()) {
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toHaveAttribute('alt', /\d\d%/);
    await expect
      .poll(() => panel.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
  }
  await expect(result).toContainText('"third vase from left"');
  await expect(result).toContainText('"left vase from cylinder"');
  // The numbers in the caption are the ones printed on the pictures.
  await expect(result.locator('figcaption')).toContainText(/84%.*87%.*99%/s);
  await expect(result.locator('figcaption a')).toHaveText(
    'Figure 4 of Lemmer and Corso, AAAI 2023',
  );
  await expect(result.locator('figcaption a')).toHaveAttribute(
    'href',
    /arxiv\.org\/abs\/2110\.10206/,
  );

  // Mistake attribution: a clip of the model's output on real video.
  const footage = claims.nth(1).locator('.claim-figure [data-clip]');
  await expectClip(footage, 'Model output');
  await expect(footage.locator('figcaption')).toContainText('real first-person video');
  await expect(footage.locator('figcaption a')).toHaveAttribute(
    'href',
    /yayuanli\.github\.io\/MATT/,
  );
  // Its label and its pause button sit in the clip's own margin, clear of each other.
  const corners = await footage.evaluate((el) => {
    const tag = el.querySelector('.clip-tag')!.getBoundingClientRect();
    const toggle = el.querySelector('[data-clip-toggle]')!.getBoundingClientRect();
    const frame = el.querySelector('.clip-frame')!.getBoundingClientRect();
    return {
      apart: toggle.left - tag.right,
      toggleTop: toggle.top - frame.top,
      frame: frame.height,
    };
  });
  expect(corners.apart).toBeGreaterThan(8);
  expect(corners.toggleTop).toBeLessThan(corners.frame * 0.2);
  // Each claim has one picture, so neither runs on below the other.
  await expect(thesis.locator('.claim-figure > figure')).toHaveCount(2);
  await expect(thesis.locator('[data-paper-figure]')).toHaveCount(0);

  // The arc ends at the clinic, shows MILLY at work, and the third claim leads on to VIGIL.
  // Every step is dated with a year, and a step that reports a result links its paper.
  await expect(thesis.locator('.arc > li')).toHaveCount(4);
  for (const when of await thesis.locator('.arc-when').allInnerTexts()) {
    expect(when).toMatch(/^(19|20)\d\d$/);
  }
  await expect(thesis.locator('.arc-paper a')).toHaveAttribute(
    'href',
    /arxiv\.org\/abs\/2507\.18374/,
  );
  await expectClip(thesis.locator('.arc-wrap [data-clip]'));
  await expect(thesis.locator('.arc-wrap [data-clip] figcaption')).toContainText('MILLY');
  // No row repeats in its sentence the year that labels it.
  for (const row of await thesis.locator('.arc > li').all()) {
    const year = (await row.locator('.arc-when').innerText()).trim();
    expect(await row.locator('.arc-body').innerText(), year).not.toContain(year);
  }
});

test('on a laptop, blocks that sit side by side on the home page end together', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'On a phone every block is one column.');
  // Nothing moves into place while the page is measured.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [1000, 1100, 1280, 1372, 1440]) {
    await page.setViewportSize({ width, height: 872 });
    await page.goto(at('/'));
    await page.evaluate(() => document.fonts.ready);
    const ends = await page.evaluate(() => {
      const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
      const all = (selector: string) =>
        [...document.querySelectorAll(selector)].map((el) => el.getBoundingClientRect());
      const spread = (values: number[]) => Math.round(Math.max(...values) - Math.min(...values));
      const claims = [...document.querySelectorAll('#thesis .claim')];
      return {
        // The opening: the three words end where the photograph's caption ends.
        hero: spread([box('.hero-more').bottom, box('.hero-photo').bottom]),
        // The two claims: the same part of each on the same line, and pictures of one height.
        claimTops: spread(all('#thesis .claim-figure').map((r) => r.top)),
        claimPictures: spread(
          all('#thesis .result-grid, #thesis .claim-figure .clip-frame').map((r) => r.height),
        ),
        claimTexts: spread(all('#thesis .claim-body').map((r) => r.top)),
        claimEnds: spread(claims.map((claim) => claim.getBoundingClientRect().bottom)),
        // How the group got here: the last line on the left against the last on the right.
        // Three columns, or on a small laptop two, with the last step under the clip.
        arc: spread(
          (matchMedia('(max-width: 78rem)').matches
            ? ['.arc-wrap > .arc:nth-child(2)', '.arc--last']
            : ['.arc-wrap > .arc:first-child', '.arc-wrap > .arc:nth-child(2)', '.arc-wrap > .clip']
          ).map((selector) => box(selector).bottom),
        ),
        vigil: spread(all('.vigil-grid > *').map((r) => r.bottom)),
        record: spread([box('.record > .video').bottom, box('.record-list').bottom]),
        people: spread([box('.people > .lead').bottom, box('.people-side').bottom]),
      };
    });
    const at1 = (name: keyof typeof ends) => `${name} at ${width}: ${ends[name]}px`;
    expect(ends.hero, at1('hero')).toBeLessThanOrEqual(2);
    for (const name of ['claimTops', 'claimPictures', 'claimTexts', 'claimEnds'] as const) {
      expect(ends[name], at1(name)).toBeLessThanOrEqual(2);
    }
    for (const name of ['arc', 'vigil', 'record', 'people'] as const) {
      expect(ends[name], at1(name)).toBeLessThanOrEqual(100);
    }
  }
});

test('on a laptop, blocks that sit side by side on the other pages end together', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'On a phone every block is one column.');
  // Nothing moves into place while the page is measured.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [1000, 1100, 1280, 1372, 1440]) {
    await page.setViewportSize({ width, height: 872 });

    await page.goto(at('/vigil/'));
    await page.evaluate(() => document.fonts.ready);
    const vigil = await page.evaluate(() => {
      const q = (selector: string) => document.querySelector(selector)!;
      const box = (selector: string) => q(selector).getBoundingClientRect();
      const all = (selector: string) =>
        [...document.querySelectorAll(selector)].map((el) => el.getBoundingClientRect());
      const spread = (values: number[]) => Math.round(Math.max(...values) - Math.min(...values));
      const parts = [...document.querySelectorAll('#how .part')];
      return {
        // How it works: the two pictures of a part are one size, and its words end near each other.
        pictures: Math.max(
          ...parts.map((part) => {
            const frames = [...part.querySelectorAll(':scope > figure')].map((figure) =>
              figure.querySelector('.clip-frame, img')!.getBoundingClientRect(),
            );
            return frames.length
              ? spread(frames.map((r) => r.height)) + spread(frames.map((r) => r.top))
              : 0;
          }),
        ),
        partWords: Math.max(
          ...parts.map((part) =>
            Math.abs(
              part.querySelector('.step-body')!.getBoundingClientRect().bottom -
                part.querySelector('.part-head')!.getBoundingClientRect().bottom,
            ),
          ),
        ),
        // Why it matters: the box of the quotation ends with the text beside it.
        why: spread([
          q('.why .prose').lastElementChild!.getBoundingClientRect().bottom,
          box('.why .quote').bottom,
        ]),
        // Who it is for: two columns of text, then three cells of one height.
        who: spread(all('.who-text > p').map((r) => r.bottom)),
        benefits: spread(all('.benefits > li').map((r) => r.bottom)),
        // The interface: the rules of the three reasons end with the text beside them.
        room: spread([box('.room-grid .credit').bottom, box('.reasons').bottom]),
        scope: spread(all('.scope > div:not(.scope-now)').map((r) => r.bottom)),
        record: spread([box('.record > .video').bottom, box('.record-list').bottom]),
        team: spread([
          box('.team .subteam:first-child').bottom,
          box('.team .subteam:last-child').bottom,
        ]),
        head: spread(all('.head-foot > *').map((r) => r.bottom)),
      };
    });
    const says = (page: string, name: string, value: number) =>
      `${page} ${name} at ${width}: ${value}px`;
    expect(vigil.pictures, says('VIGIL', 'pictures', vigil.pictures)).toBeLessThanOrEqual(2);
    // A one-line title stands beside a paragraph, so this pair may differ by the paragraph.
    expect(vigil.partWords, says('VIGIL', 'partWords', vigil.partWords)).toBeLessThanOrEqual(160);
    for (const name of [
      'why',
      'who',
      'benefits',
      'room',
      'scope',
      'record',
      'team',
      'head',
    ] as const) {
      expect(vigil[name], says('VIGIL', name, vigil[name])).toBeLessThanOrEqual(100);
    }

    await page.goto(at('/people/'));
    await page.evaluate(() => document.fonts.ready);
    // The portrait with its links, and the text beside them.
    const pi = await page.evaluate(() =>
      Math.round(
        Math.abs(
          document.querySelector('.pi-card')!.getBoundingClientRect().bottom -
            document.querySelector('.pi > div:nth-child(2)')!.getBoundingClientRect().bottom,
        ),
      ),
    );
    expect(pi, says('People', 'pi', pi)).toBeLessThanOrEqual(2);

    await page.goto(at('/media/'));
    await page.evaluate(() => document.fonts.ready);
    const featured = await page.evaluate(() =>
      Math.round(
        Math.abs(
          document.querySelector('.record > .video')!.getBoundingClientRect().bottom -
            document.querySelector('.record-list')!.getBoundingClientRect().bottom,
        ),
      ),
    );
    expect(featured, says('Media', 'featured', featured)).toBeLessThanOrEqual(100);

    await page.goto(at('/teaching/'));
    await page.evaluate(() => document.fonts.ready);
    // The latest course: its links stand at the foot of the text beside them.
    const course = await page.evaluate(() =>
      Math.round(
        Math.abs(
          document.querySelector('.now-text')!.getBoundingClientRect().bottom -
            document.querySelector('.now-links')!.getBoundingClientRect().bottom,
        ),
      ),
    );
    expect(course, says('Teaching', 'course', course)).toBeLessThanOrEqual(2);
  }
});

test('a grid of cards never ends on a row with an empty cell', async ({ page, isMobile }) => {
  // The demo day posters, the Ph.D. students, and the datasets and software: whatever the count,
  // the last card reaches the right edge of its grid.
  const grids = [
    ['/vigil/', '.posters'],
    ['/people/', '.members'],
    ['/resources/', '#dataset .grid'],
    ['/resources/', '#software .grid'],
  ] as const;
  for (const width of isMobile ? [0] : [700, 1000, 1280, 1372]) {
    if (width) await page.setViewportSize({ width, height: 872 });
    for (const [path, selector] of grids) {
      await page.goto(at(path));
      const grid = page.locator(selector);
      await expect(grid).toHaveClass(/fill-rows/);
      const gap = await grid.evaluate((el) =>
        Math.round(
          el.getBoundingClientRect().right - el.lastElementChild!.getBoundingClientRect().right,
        ),
      );
      expect(gap, `${path} ${selector} at ${width || 'phone'}: ${gap}px`).toBeLessThanOrEqual(1);
    }
  }
});

test('figures from the papers are shown as published, each with its paper', async ({ page }) => {
  // On the Research page, one or two in each area: an area that opens on a clip has one, the
  // others two.
  for (const [path, count] of [['/research/', 10]] as const) {
    await page.goto(at(path));
    const figures = page.locator('[data-paper-figure]');
    await expect(figures).toHaveCount(count);
    const papers = new Set<string>();
    for (const figure of await figures.all()) {
      papers.add((await figure.getAttribute('data-paper-figure'))!);
      const image = figure.locator('img');
      await image.scrollIntoViewIfNeeded();
      await expect(image).toHaveAttribute('alt', /\S.{60,}/);
      await expect
        .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0);
      // The caption names the figure, the authors, the venue, and the year, and links the paper.
      const source = figure.locator('figcaption a.source');
      await expect(source).toHaveText(/^(Part of )?(Figure|Table) \d+ of .+, .+ (19|20)\d\d$/);
      await expect(source).toHaveAttribute('href', /^https:\/\//);
      await expect(figure.locator('.tag')).toHaveText('From the paper');
      // The figure opens at full size, for reading its small print.
      const full = await figure.locator('a.sheet').getAttribute('href');
      const response = await page.request.get(new URL(full!, page.url()).href);
      expect(response.status(), full!).toBe(200);
    }
    expect(papers.size).toBe(count);
  }
});

test('links carry no stray spaces, and no gap opens before the punctuation after them', async ({
  page,
}) => {
  for (const path of pages) {
    await page.goto(at(path));
    const flaws = await page.evaluate(() => {
      const found: string[] = [];
      for (const el of document.querySelectorAll('a, em')) {
        const text = el.textContent ?? '';
        if (!text.trim()) continue;
        // An underline or a highlight must not run on under a space: the element's own text,
        // where it begins or ends with text, has no space at that edge.
        const first = el.firstChild;
        const last = el.lastChild;
        const leads = first?.nodeType === 3 && /^\s/.test(first.textContent ?? '');
        const trails = last?.nodeType === 3 && /\s$/.test(last.textContent ?? '');
        if (leads || trails) found.push(`space inside: "${text.trim().slice(0, 40)}"`);
        const after = el.nextSibling;
        if (after?.nodeType === 3 && /^\s+[.,;:!?]/.test(after.textContent ?? '')) {
          found.push(`gap before punctuation after: "${text.trim().slice(0, 40)}"`);
        }
      }
      return found;
    });
    expect(flaws, path).toEqual([]);
  }
});

test('the header fits at every width where the full navigation shows', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Small screens use the menu button instead.');
  for (const width of [1057, 1120, 1232, 1233, 1440]) {
    await page.setViewportSize({ width, height: 700 });
    await page.goto(at('/'));
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
    const spill = await page.locator('.site-header .bar').evaluate((bar) => {
      const last = bar.querySelector('.actions')!.getBoundingClientRect();
      const nav = bar.querySelector('.nav')!.getBoundingClientRect();
      const brand = bar.querySelector('.brand')!.getBoundingClientRect();
      return {
        overflow: bar.scrollWidth - bar.clientWidth,
        pastEdge: last.right - bar.getBoundingClientRect().right,
        overlap: Math.max(brand.right - nav.left, nav.right - last.left),
      };
    });
    expect(spill.overflow, `${width}px`).toBeLessThanOrEqual(0);
    expect(spill.pastEdge, `${width}px`).toBeLessThanOrEqual(0.5);
    expect(spill.overlap, `${width}px`).toBeLessThanOrEqual(0);
  }
});

test('a video plays in place only after the visitor asks for it', async ({ page }) => {
  // The player itself is not needed to check that it is requested.
  const requested: string[] = [];
  await page.route(/youtube/, (route) => {
    requested.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<title>player</title>' });
  });
  await page.goto(at('/media/'));
  const video = page.locator('[data-video]').first();
  await expect(video.locator('img')).toBeVisible();
  expect(requested).toEqual([]);

  await video.getByRole('button', { name: /^Play video/ }).click();
  const player = video.locator('iframe');
  await expect(player).toHaveAttribute(
    'src',
    /^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{11}\?/,
  );
  await expect(player).toHaveAttribute('title', /\S/);
  await expect.poll(() => requested.length).toBeGreaterThan(0);
});

test('the latest course leads the teaching page, and a link to one term sits on that term', async ({
  page,
}) => {
  await page.goto(at('/teaching/'));
  const now = page.locator('.now-card');
  // Named so that it stays true after the term ends.
  await expect(now).toContainText(/Latest course · (Fall|Winter|Spring|Summer) 20\d\d/);
  // A course taught in several terms links the one term whose page it has, not its title.
  const row = page.locator('.course', { hasText: 'Foundations of Computer Vision' });
  await expect(row.locator('.course-title a')).toHaveCount(0);
  await expect(row.getByRole('link', { name: /Fall 2016/ })).toHaveAttribute('href', /504F16/);
  await expect(now.getByRole('heading')).toBeVisible();
  await expect(now.getByRole('link', { name: /Course materials/ })).toHaveAttribute(
    'href',
    /^https:/,
  );
});

test('the media page keeps one form: no running totals, plain titles, summaries that say what an item is about', async ({
  page,
}) => {
  await page.goto(at('/media/'));
  // No count of items anywhere in the page's furniture: the list keeps growing.
  await expect(page.locator('.lead')).not.toContainText(/\d+ items/);
  for (const text of await page.locator('nav.jump a').allInnerTexts()) {
    expect(text.trim()).not.toMatch(/\d/);
  }
  await expect(page.locator('main .section-head .label', { hasText: /\d+ items?/ })).toHaveCount(0);

  const titles = await page.locator('main h3 a').allInnerTexts();
  expect(titles.length).toBeGreaterThan(30);
  for (const title of titles) {
    // A title is the item's own name, not the browser tab's: no site name after a bar.
    expect(title, title).not.toMatch(/ \| |Techstrong\.tv|[‘’“”]/);
  }
  for (const outlet of await page
    .locator('main .outlet, main .where > span:first-child')
    .allInnerTexts()) {
    expect(outlet, outlet).not.toMatch(/[()]/);
  }
  for (const summary of await page.locator('main .summary').allInnerTexts()) {
    // A summary starts with its subject, not with a label for the kind of thing it is.
    expect(summary, summary).not.toMatch(
      /^(Medium essay|Essay on|Podcast|Episode|Interview on|Long interview|Radio-style|News story|University news|Newsweek story|Local feature|Video of|Demo page|Voxel51 blog post|Industry column|His )/,
    );
    expect(summary, summary).toMatch(/[.?!"]$/);
  }
});

test('the publications list is set in one form', async ({ page }) => {
  await page.goto(at('/publications/'));
  const titles = await page.locator('[data-pub] .title').allInnerTexts();
  expect(titles.length).toBeGreaterThan(200);
  for (const title of titles) expect(title, title).not.toMatch(/[$\\{}]|\s{2,}|\.$/);
  // Every link button says where it goes.
  await expect(page.locator('[data-pub] .links a', { hasText: /^link$/i })).toHaveCount(0);
  // A consortium paper names three authors and counts the rest; the search still finds them all.
  const brats = page.locator('[id="menze2015multimodal"]');
  await expect(brats.locator('.authors')).toHaveText(
    /^\s*B\. H\. Menze, A\. Jakab, S\. Bauer, and \d+ others, including J\. J\. Corso\s*$/,
  );
  await expect(brats).toHaveAttribute('data-search', /kalpathy-cramer/);
  // A preprint does not say "arXiv" a third time under its authors.
  await expect(
    page.locator('[data-pub][data-type="preprint"] .where', { hasText: /arXiv preprint/ }),
  ).toHaveCount(0);
});

test('a bar of the publications chart shows its count just above itself', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'hovering needs a pointer');
  await page.goto(at('/publications/'));
  const bars = page.locator('.timeline .bar');
  // The shortest bar is the telling one: its count belongs near it, not at the top of the chart.
  const heights = await bars.evaluateAll((els) =>
    els.map((el) => el.querySelector('.stack')!.getBoundingClientRect().height),
  );
  const shortest = heights.indexOf(Math.min(...heights));
  const bar = bars.nth(shortest);
  await bar.scrollIntoViewIfNeeded();
  await bar.hover();
  const gap = await bar.evaluate(async (el) => {
    await new Promise((done) => setTimeout(done, 400));
    const tip = el.querySelector('.tip')!.getBoundingClientRect();
    const stack = el.querySelector('.stack')!.getBoundingClientRect();
    return stack.top - tip.bottom;
  });
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThan(24);
});
