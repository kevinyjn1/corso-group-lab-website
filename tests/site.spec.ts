import { expect, test, type Page } from '@playwright/test';
import { at } from './base-path';

const pages = [
  '/',
  '/research/',
  '/vigil/',
  '/publications/',
  '/people/',
  '/resources/',
  '/teaching/',
  '/join/',
  '/media/',
];

/** Collect console errors, uncaught exceptions, and failed requests for a page. */
function watchForProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`exception: ${error.message}`));
  page.on('requestfailed', (request) => problems.push(`request failed: ${request.url()}`));
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`${response.status()}: ${response.url()}`);
  });
  return problems;
}

for (const path of pages) {
  test(`${path} renders cleanly`, async ({ page }) => {
    const problems = watchForProblems(page);
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

    // Nothing may push the page wider than the screen.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);

    // House style: plain dashes only.
    expect(await page.locator('body').innerText()).not.toContain('—');
    expect(problems).toEqual([]);
  });
}

test('every internal link resolves', async ({ page, request, baseURL }) => {
  const links = new Set<string>();
  for (const path of pages) {
    await page.goto(at(path));
    const hrefs = await page
      .locator('a[href]')
      .evaluateAll((anchors) => anchors.map((a) => (a as HTMLAnchorElement).href));
    for (const href of hrefs) {
      const url = new URL(href);
      if (url.origin === new URL(baseURL!).origin) links.add(url.pathname);
    }
  }
  expect(links.size).toBeGreaterThanOrEqual(pages.length);
  for (const link of links) {
    const response = await request.get(link);
    expect(response.status(), link).toBe(200);
  }
});

test('in-page anchors point at real elements', async ({ page }) => {
  for (const path of ['/research/', '/publications/']) {
    await page.goto(at(path));
    const missing = await page
      .locator('a[href^="#"]')
      .evaluateAll((anchors) =>
        anchors
          .map((a) => a.getAttribute('href')!)
          .filter((href) => href.length > 1 && !document.getElementById(href.slice(1))),
      );
    expect(missing, path).toEqual([]);
  }
});

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

test.describe('home page scene', () => {
  test('draws, captions, and switches between its four readings', async ({ page }) => {
    await page.goto(at('/'));
    const scene = page.locator('[data-hero-scene]');
    // The scene only runs while it is on screen.
    await scene.scrollIntoViewIfNeeded();
    await expect(scene.locator('[data-caption]')).not.toBeEmpty({ timeout: 10_000 });

    // The canvas has been painted: it is not a single flat color.
    const colors = await scene.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
      const context = canvas.getContext('2d')!;
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      const seen = new Set<number>();
      for (let i = 0; i < data.length; i += 4 * 97) {
        seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
      }
      return seen.size;
    });
    expect(colors).toBeGreaterThan(3);
    // Two hands of 21 keypoints each are being followed.
    await expect(scene).toHaveAttribute('data-keypoints', '42');

    const readings = page.locator('[data-reading]');
    await expect(readings).toHaveCount(4);
    for (const mode of ['language', 'surface', 'motion', 'hands']) {
      await scene.locator(`[data-mode="${mode}"]`).click();
      await expect(scene.locator(`[data-mode="${mode}"]`)).toHaveAttribute('aria-pressed', 'true');
      await expect(scene.locator('[aria-pressed="true"]')).toHaveCount(1);
      await expect(scene).toHaveAttribute('data-view', mode);
      // The list under the scene follows along, and names the paper behind the reading.
      await expect(page.locator('[data-reading][data-active]')).toHaveCount(1);
      await expect(page.locator(`[data-reading="${mode}"]`)).toHaveAttribute('data-active', '');
    }
    for (const paper of await page.locator('[data-reading] a').all()) {
      await expect(paper).toHaveAttribute('href', /^https:\/\/(arxiv\.org|doi\.org)\//);
    }

    // A reading can also be chosen from the list.
    await page.locator('[data-show="surface"]').click();
    await expect(scene).toHaveAttribute('data-view', 'surface');
  });

  test('can be paused and started again', async ({ page }) => {
    await page.goto(at('/'));
    const scene = page.locator('[data-hero-scene]');
    await scene.scrollIntoViewIfNeeded();
    await expect(scene.locator('[data-caption]')).not.toBeEmpty({ timeout: 10_000 });
    const frame = scene.locator('[data-frame]');

    await scene.getByRole('button', { name: 'Pause the scene' }).click();
    await expect(scene).toHaveAttribute('data-held', '');
    const stopped = await frame.innerText();
    await page.waitForTimeout(1200);
    await expect(frame).toHaveText(stopped);

    await scene.getByRole('button', { name: 'Play the scene' }).click();
    await expect(scene).not.toHaveAttribute('data-held', '');
    await expect.poll(() => frame.innerText(), { timeout: 5_000 }).not.toBe(stopped);
  });

  test('the operation moves forward, one stitch at a time', async ({ page }) => {
    await page.goto(at('/'));
    const scene = page.locator('[data-hero-scene]');
    await scene.scrollIntoViewIfNeeded();
    const stitch = async () => Number(await scene.getAttribute('data-stitch'));
    const before = await stitch();
    await expect.poll(stitch, { timeout: 12_000 }).not.toBe(before);
  });

  test('is static and fully readable with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(at('/'));
    await expect(page.locator('[data-hero-scene] [data-caption]')).not.toBeEmpty();
    const hidden = await page
      .locator('[data-reveal], [data-reveal="stagger"] > *')
      .evaluateAll(
        (items) => items.filter((item) => getComputedStyle(item).opacity !== '1').length,
      );
    expect(hidden).toBe(0);
  });
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

test('every research figure draws its own picture', async ({ page }) => {
  await page.goto(at('/research/'));
  // One figure for each of the six areas. The flagship project above them is shown in footage.
  const figures = page.locator('[data-figure]');
  await expect(figures).toHaveCount(6);
  const names = new Set<string>();
  for (const figure of await figures.all()) {
    await figure.scrollIntoViewIfNeeded();
    await expect(figure).toHaveAttribute('data-painted', '');
    const name = (await figure.getAttribute('data-figure'))!;
    names.add(name);
    // A figure starts from the beginning of its story, so give it a moment. Then more than the
    // resting dot grid has been drawn: several distinct colors are on the canvas.
    const colors = () =>
      figure.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
        const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
        const seen = new Set<number>();
        for (let i = 0; i < data.length; i += 4 * 53) {
          if (data[i + 3] > 200) seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
        }
        return seen.size;
      });
    await expect.poll(colors, { message: name, timeout: 8_000 }).toBeGreaterThan(1);
    await expect(figure.locator('figcaption')).not.toBeEmpty();
  }
  expect(names.size).toBe(6);
});

test('every research figure names the paper it is drawn after', async ({ page }) => {
  await page.goto(at('/research/'));
  const sources = page.locator('.area .figure-source');
  await expect(sources).toHaveCount(6);
  for (const source of await sources.all()) {
    await expect(source).toContainText('Figure after');
    const link = source.locator('a').first();
    await expect(link).toHaveAttribute('href', /^https:\/\//);
    // A citation: who, where, and when.
    await expect(link).toHaveText(/\S+.*, .+ (19|20)\d\d$/);
    await expect(link).toHaveAttribute('title', /\S{8,}/);
  }

  // On the home page the figures sit in cards that are links, so the source is plain text there.
  await page.goto(at('/'));
  await expect(page.locator('.areas .figure-source')).toHaveCount(5);
  await expect(page.locator('.areas .figure-source a')).toHaveCount(0);
});

/** A clip of the group's footage: silent, looping, described, and held still on request. */
async function expectClip(clip: import('@playwright/test').Locator) {
  const video = clip.locator('video');
  await expect(video).toHaveAttribute('aria-label', /\S.{40,}/);
  await expect(video).toHaveAttribute('poster', /\S+/);
  await expect(video).toHaveJSProperty('muted', true);
  await expect(video).toHaveJSProperty('loop', true);
  await expect(video).toHaveAttribute('playsinline', '');
  await expect(video).toHaveAttribute('preload', 'none');
  await expect(video.locator('source')).toHaveAttribute('src', /\.mp4$/);
  await expect(clip.locator('.clip-tag')).toContainText('Footage');
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

test('the flagship project is introduced on the home page and leads to its own page', async ({
  page,
}) => {
  await page.goto(at('/'));
  const band = page.locator('section.vigil');
  await expect(band.getByRole('heading', { name: 'VIGIL' })).toBeVisible();
  await expect(band).toContainText(
    'Vectors of Intelligent Guidance in Long-Reach Rural Healthcare',
  );
  // The band shows the team's own footage of the system, not a drawing of it.
  await expect(band.locator('[data-figure]')).toHaveCount(0);
  await expectClip(band.locator('[data-clip]'));
  await expect(band.locator('[data-clip] figcaption a')).toHaveAttribute('href', /\/vigil\/#how$/);

  await band.getByRole('link', { name: /Inside VIGIL/ }).click();
  await expect(page).toHaveURL(/\/vigil\/$/);
  await expect(page.locator('h1')).toContainText('VIGIL');
  await expect(page.locator('h1')).toContainText('Long-Reach Rural Healthcare');
});

test('every claim on the VIGIL page points at a source that is listed', async ({ page }) => {
  await page.goto(at('/vigil/'));
  const listed = await page
    .locator('#sources li')
    .evaluateAll((items) => items.map((item) => item.id));
  expect(listed.length).toBeGreaterThanOrEqual(6);
  for (const link of await page.locator('#sources li a').all()) {
    await expect(link).toHaveAttribute('href', /^https:\/\//);
  }

  const cited = await page
    .locator('.cite a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')!.slice(1)));
  expect(cited.length).toBeGreaterThan(15);
  for (const id of cited) expect(listed, id).toContain(id);
  // And every listed source is used.
  for (const id of listed) expect(cited, id).toContain(id);

  // A citation takes the reader to its source.
  await page.locator('.cite a').first().click();
  await expect(page.locator('#sources li:target')).toBeVisible();
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
  expect(await watch.locator('.record-list > li').count()).toBeGreaterThanOrEqual(6);
  expect(requested).toEqual([]);
  await watch.getByRole('button', { name: /^Play video: VIGIL/ }).click();
  await expect(watch.locator('iframe')).toHaveAttribute('src', /\/embed\/G77AdX2qapg\?/);

  await expect(page.locator('.papers .rows > li')).toHaveCount(3);
  await expect(page.locator('.team .subteam')).toHaveCount(3);
});

test('the VIGIL page shows the system at work: photos, both exams, and the demo day', async ({
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

  // Each part of the system is shown in the team's own footage or photographs.
  const parts = page.locator('#how .part');
  await expect(parts).toHaveCount(4);
  for (const part of await parts.all()) {
    await expect(part.locator('.h3')).not.toBeEmpty();
    expect(await part.locator('[data-clip], .photo').count()).toBeGreaterThanOrEqual(1);
  }
  const clips = page.locator('#how [data-clip]');
  await expect(clips).toHaveCount(5);
  for (const clip of await clips.all()) await expectClip(clip);
  const still = page.locator('#how .part .photo img');
  await still.scrollIntoViewIfNeeded();
  await expect
    .poll(() => still.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);

  // The heart exam and the leg exam are both drawn.
  for (const name of ['vigil', 'leg']) {
    const figure = page.locator(`#how [data-figure="${name}"]`);
    await figure.scrollIntoViewIfNeeded();
    await expect(figure).toHaveAttribute('data-painted', '');
  }

  // Each exam has one headline reading in real type, and steps that can be chosen.
  const heart = page.locator('#how [data-figure="vigil"]');
  const panel = page.locator('#how [data-figure="vigil"] + [data-console]');
  await heart.scrollIntoViewIfNeeded();
  await expect(panel.locator('[data-readout-value]')).toHaveText(/^\d{1,3}%$/);
  await expect(panel.locator('[data-readout-label]')).toContainText('View quality');
  const steps = panel.locator('[data-step]');
  await expect(steps).toHaveCount(5);
  await steps.nth(3).click();
  await expect(steps.nth(3)).toHaveAttribute('data-on', '');
  await expect(steps.nth(2)).toHaveAttribute('data-done', '');
  await expect(panel).toHaveAttribute('data-on', '3');
  // Capturing happens with the probe on target, so the reading is high by then.
  await expect(panel.locator('[data-readout-label]')).toContainText('on target');
  // What the assistant says is shown in words, and it matches the moment.
  await expect(panel.locator('[data-says]')).toHaveText('On target. Hold still.');
  await steps.nth(0).click();
  await expect(panel).toHaveAttribute('data-on', '0');
  await expect(panel.locator('[data-readout-label]')).toContainText('no contact');
  await expect(panel.locator('[data-says]')).toHaveText('Line the patient up with the light.');

  // The animation can be held still to read it, and started again.
  const pause = panel.getByRole('button', { name: 'Pause the animation' });
  await pause.click();
  const held = panel.getByRole('button', { name: 'Play the animation' });
  await expect(held).toHaveAttribute('aria-pressed', 'true');
  const frozen = await panel.locator('[data-readout-value]').innerText();
  await page.waitForTimeout(1500);
  await expect(panel.locator('[data-readout-value]')).toHaveText(frozen);
  await expect(panel).toHaveAttribute('data-on', '0');
  // A step can still be chosen while it is held.
  await steps.nth(4).click();
  await expect(panel.locator('[data-says]')).toContainText('report is ready');
  await held.click();
  await expect(panel.getByRole('button', { name: 'Pause the animation' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );

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

test('the home page leads with the thesis, then its proof, then the operating room', async ({
  page,
}) => {
  await page.goto(at('/'));
  // The headline is the group's thesis, in the words of the talk's title.
  const headline = page.locator('h1');
  await expect(headline).toHaveText(/^\s*Physically-grounded agentic\s+upskilling\s*\.\s*$/);
  // It is defined in a sentence, each word is explained, and the talk it comes from is named.
  await expect(page.locator('.hero .lead')).toContainText(
    'guides a person through a physical task',
  );
  await expect(page.locator('.hero .words div')).toHaveCount(3);
  await expect(page.locator('.hero-source')).toContainText(
    'Physically-Grounded Agentic Upskilling',
  );
  await expect(page.locator('.hero-source a')).toHaveAttribute(
    'href',
    /^https:\/\/www\.youtube\.com\/watch\?v=/,
  );

  const order = await page.evaluate(() => {
    const top = (selector: string) =>
      document.querySelector(selector)!.getBoundingClientRect().top + window.scrollY;
    return {
      thesis: top('#thesis'),
      vigil: top('section.vigil'),
      scene: top('[data-hero-scene]'),
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
  await expect(page.locator('section.vigil .kicker')).toContainText('In healthcare delivery');

  // Human-AI collaboration is the thesis itself, so the grid below shows the other five areas.
  await expect(page.locator('.areas > li')).toHaveCount(5);
  await expect(page.locator('.areas [data-figure="human"]')).toHaveCount(0);
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

test('the thesis makes its claims with live figures and the papers behind them', async ({
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

  // The hazy oracle: an ambiguous request, a robot that asks again, and then acts.
  const oracle = thesis.locator('[data-figure="oracle"] + [data-console]');
  await oracle.scrollIntoViewIfNeeded();
  const step = (panel: typeof oracle, name: string) =>
    panel.getByRole('button', { name: new RegExp(`${name}$`) });
  await step(oracle, 'Ask again').click();
  await expect(oracle.locator('[data-says-who]')).toHaveText('Robot');
  await expect(oracle.locator('[data-says]')).toContainText('Can you rephrase?');
  await expect(oracle.locator('[data-readout-value]')).toHaveText('33%');
  await step(oracle, 'Fetch').click();
  await expect(oracle.locator('[data-says]')).toHaveText('Fetching the orange mug.');
  await expect(oracle.locator('[data-readout-value]')).toHaveText('96%');
  await expect(oracle.locator('[data-readout-label]')).toContainText('act');

  // Mistake attribution: what, when, and where.
  const mistake = thesis.locator('[data-figure="human"] + [data-console]');
  await mistake.scrollIntoViewIfNeeded();
  await step(mistake, 'Watch').click();
  await expect(mistake.locator('[data-says]')).toHaveText('Grab a chain whip.');
  await step(mistake, 'What').click();
  await expect(mistake.locator('[data-says-who]')).toHaveText('What');
  await expect(mistake.locator('[data-says]')).toContainText('wrong object');
  await step(mistake, 'When').click();
  await expect(mistake.locator('[data-readout-value]')).toHaveText('3.2 s');
  await expect(mistake.locator('[data-readout-label]')).toHaveText('Point of no return');
  await step(mistake, 'Where').click();
  await expect(mistake.locator('[data-says-who]')).toHaveText('Where');

  // The arc ends at the clinic, shows MILLY at work, and the third claim leads on to VIGIL.
  await expect(thesis.locator('.arc > li')).toHaveCount(5);
  await expectClip(thesis.locator('.arc-wrap [data-clip]'));
  await expect(thesis.locator('.arc-wrap [data-clip] figcaption')).toContainText('MILLY');
  await thesis.locator('.arc-next').click();
  await expect(page.locator('section.vigil')).toBeInViewport();
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

test('the course being taught now leads the teaching page', async ({ page }) => {
  await page.goto(at('/teaching/'));
  const now = page.locator('.now-card');
  await expect(now).toContainText('Teaching now');
  await expect(now.getByRole('heading')).toBeVisible();
  await expect(now.getByRole('link', { name: /Course materials/ })).toHaveAttribute(
    'href',
    /^https:/,
  );
});

test('unknown pages show the 404 page', async ({ page }) => {
  const response = await page.goto(at('/no-such-page/'));
  expect(response?.status()).toBe(404);
  await expect(page.locator('h1')).toContainText('Nothing in');
});
