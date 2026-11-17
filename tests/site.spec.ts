import { expect, test, type Page } from '@playwright/test';
import { basePath } from './base-path';

/** The address of a site path under the mount point being tested. */
const at = (path: string) => `${basePath}${path}`;

const pages = [
  '/',
  '/research/',
  '/publications/',
  '/people/',
  '/resources/',
  '/teaching/',
  '/join/',
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
  test('draws, captions, and switches modes', async ({ page }) => {
    await page.goto(at('/'));
    const scene = page.locator('[data-hero-scene]');
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

    for (const mode of ['segment', 'pose', 'depth', 'detect']) {
      await scene.locator(`[data-mode="${mode}"]`).click();
      await expect(scene.locator(`[data-mode="${mode}"]`)).toHaveAttribute('aria-pressed', 'true');
      await expect(scene.locator('[aria-pressed="true"]')).toHaveCount(1);
    }
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

test('scrolling reveals content that starts hidden', async ({ page }) => {
  await page.goto(at('/'));
  const card = page.locator('.areas > li').first();
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveClass(/is-visible/);
  await expect(card).toHaveCSS('opacity', '1');
});

test('theme choice persists across pages', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(at('/'));
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch color theme' }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.goto(at('/people/'));
  await expect(html).toHaveAttribute('data-theme', 'light');
});

test('navigation reaches every page', async ({ page, isMobile }) => {
  await page.goto(at('/'));
  const targets = [
    ['Research', '/research/'],
    ['Publications', '/publications/'],
    ['People', '/people/'],
    ['Code & Data', '/resources/'],
    ['Teaching', '/teaching/'],
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

test('unknown pages show the 404 page', async ({ page }) => {
  const response = await page.goto(at('/no-such-page/'));
  expect(response?.status()).toBe(404);
  await expect(page.locator('h1')).toContainText('Nothing in');
});
