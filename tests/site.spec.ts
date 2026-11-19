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
    // What is drawn is the test: held, the picture does not change; playing, it does.
    const picture = () =>
      scene.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());

    await scene.getByRole('button', { name: 'Pause the scene' }).click();
    await expect(scene).toHaveAttribute('data-held', '');
    await page.waitForTimeout(300);
    const stopped = await picture();
    await page.waitForTimeout(1200);
    expect(await picture()).toBe(stopped);

    await scene.getByRole('button', { name: 'Play the scene' }).click();
    await expect(scene).not.toHaveAttribute('data-held', '');
    await expect.poll(picture, { timeout: 5_000 }).not.toBe(stopped);
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
  // One figure for each of the six areas. The VIGIL project above them is shown in footage.
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

test('with motion reduced, no page scrolls sideways', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const path of pages) {
    await page.goto(at(path));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBe(0);
  }
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
  await expect(band.locator('[data-figure]')).toHaveCount(0);
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
  // The third claim is numbered and worded like the two above it, and is written once.
  await expect(page.locator('section.vigil .kicker')).toHaveText(
    /^\s*03\s+It is being proven in healthcare delivery\s*$/,
  );
  await expect(page.getByText('And it is being proven')).toHaveCount(0);

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

test('the home page is not a dashboard: no rows of big numbers, no ticker, no ornament that poses as data', async ({
  page,
}) => {
  await page.goto(at('/'));
  // The rows of statistics, the scrolling strip of venues, and the numbers that counted up are gone.
  await expect(page.locator('.stats, .numbers, .vigil-facts, .ticker, [data-count]')).toHaveCount(
    0,
  );
  // Where the group publishes is said once, in a sentence, beside its latest papers.
  await expect(page.getByText(/^The group publishes mainly at CVPR, ICCV, and ECCV/)).toHaveCount(
    1,
  );
  // No running totals on the links to more.
  for (const text of await page.locator('main a.more, main .area-count').allInnerTexts()) {
    expect(text, text).not.toMatch(/\d/);
  }
  // A video's summary says what it is about, not how long it runs.
  await expect(page.locator('main')).not.toContainText(/\b\d+ minutes\b/);
  // The surgery figure has no recording light or frame counter, and the footer no coordinates.
  await expect(page.locator('[data-hero-scene]')).not.toContainText(/Frame\s*\d/i);
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
  await expect(thesis.locator('.claims [data-figure], .claims canvas')).toHaveCount(0);

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

  // Mistake attribution: a clip of the model's output on real video, then the paper's own figure.
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
  await expect(claims.nth(1).locator('[data-paper-figure="li2026mistake"]')).toHaveCount(1);

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

test('the steps under a live figure stay where they are while the figure plays', async ({
  page,
}) => {
  for (const [path, name] of [
    ['/research/', 'human'],
    ['/vigil/', 'vigil'],
  ] as const) {
    await page.goto(at(path));
    const panel = page.locator(`[data-figure="${name}"] + [data-console]`).first();
    await panel.scrollIntoViewIfNeeded();
    // Long enough for the story to move through several steps.
    const seen = new Set<string>();
    const steps = new Set<string>();
    for (let i = 0; i < 24; i += 1) {
      const sample = await panel.evaluate((el) => ({
        on: el.getAttribute('data-on') ?? '',
        layout: JSON.stringify([
          Math.round(el.getBoundingClientRect().height),
          ...[...el.querySelectorAll('[data-step]')].map((step) => {
            const box = step.getBoundingClientRect();
            return [Math.round(box.left), Math.round(box.width), Math.round(box.height)];
          }),
        ]),
      }));
      seen.add(sample.layout);
      steps.add(sample.on);
      await page.waitForTimeout(250);
    }
    expect(steps.size, `${name}: the story advanced`).toBeGreaterThan(1);
    expect([...seen], `${name}: one layout throughout`).toHaveLength(1);
    // Each step is wide and tall enough to press.
    for (const step of await panel.locator('[data-step]').all()) {
      const box = (await step.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(40);
    }
    // The current step is named.
    await expect(panel.locator('[data-step][data-on] .step-name')).toBeVisible();
  }
});

test('figures from the papers are shown as published, each with its paper', async ({ page }) => {
  // One under the second claim of the thesis, and one in each research area.
  for (const [path, count] of [
    ['/', 1],
    ['/research/', 6],
  ] as const) {
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
      await expect(source).toHaveText(/^(Figure|Table) \d+ of .+, .+ (19|20)\d\d$/);
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

test('unknown pages show the 404 page', async ({ page }) => {
  const response = await page.goto(at('/no-such-page/'));
  expect(response?.status()).toBe(404);
  await expect(page.locator('h1')).toContainText('Nothing in');
});
