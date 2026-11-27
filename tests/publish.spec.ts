import { expect, test } from '@playwright/test';
import { at } from './base-path';
import { pages, watchForProblems } from './helpers';

/**
 * The checks every publish must pass, whatever the content says.
 *
 * The site's content is edited by people who are not programmers and is published without a
 * person reviewing it. Before a change goes live, the site is built from it and these tests run
 * against that build: every page must load without an error, show its pictures, fit the screen,
 * link only to real places, and run no code but the site's own. Nothing here depends on what a
 * page says, so no rewording can fail it.
 *
 * The tests of the design itself, written against the sample content, are in site.spec.ts.
 */

for (const path of pages) {
  test(`${path} loads without an error and fits the screen`, async ({ page }) => {
    const problems = watchForProblems(page);
    await page.goto(at(path));
    await page.evaluate(() => document.fonts.ready);

    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toBeVisible();

    // Nothing may push the page wider than the screen: not a long name, a long address, or a
    // wide picture.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    expect(problems).toEqual([]);
  });

  test(`${path} shows every picture and clip it names`, async ({ page, request }) => {
    await page.goto(at(path));
    // Pictures further down the page wait until they are scrolled to. Ask for all of them now,
    // and wait until each has either loaded or failed.
    const missing = await page.evaluate(async () => {
      const images = [...document.images];
      for (const image of images) image.loading = 'eager';
      await Promise.all(
        images
          .filter((image) => !image.complete)
          .map(
            (image) =>
              new Promise((resolve) => {
                image.addEventListener('load', resolve, { once: true });
                image.addEventListener('error', resolve, { once: true });
              }),
          ),
      );
      return images
        .filter((image) => image.naturalWidth === 0)
        .map((image) => image.currentSrc || image.src);
    });
    expect(missing, `pictures that did not load on ${path}`).toEqual([]);

    // A clip and the still shown before it plays are files of the site too.
    const clips = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLVideoElement>('video')].flatMap((video) =>
        [
          video.poster,
          video.currentSrc || video.src,
          ...[...video.querySelectorAll('source')].map((source) => source.src),
        ].filter(Boolean),
      ),
    );
    for (const url of new Set(clips)) {
      expect((await request.get(url)).status(), url).toBe(200);
    }
  });
}

test("only the site's own code can run: every page carries a strict content security policy", async ({
  page,
}) => {
  for (const path of pages) {
    await page.goto(at(path));
    const policy = await page
      .locator('meta[http-equiv="content-security-policy"]')
      .getAttribute('content');
    const rules = new Map(
      policy!
        .split(';')
        .map((rule) => rule.trim().split(/\s+/))
        .filter(([name]) => name)
        .map(([name, ...sources]) => [name, sources]),
    );
    expect(rules.get('default-src'), path).toEqual(["'self'"]);
    // Scripts: the site's own files, and the inline ones it was built with, each by its hash.
    // No blanket permission, and no outside host.
    expect(rules.get('script-src'), path).toContain("'self'");
    for (const source of rules.get('script-src')!) {
      expect(source, path).toMatch(/^('self'|'sha(256|384|512)-[A-Za-z0-9+/=]+')$/);
    }
    for (const source of rules.get('style-src-elem')!) {
      expect(source, path).toMatch(/^('self'|'sha(256|384|512)-[A-Za-z0-9+/=]+')$/);
    }
    expect(rules.get('object-src'), path).toEqual(["'none'"]);
    expect(rules.get('base-uri'), path).toEqual(["'self'"]);
    expect(rules.get('form-action'), path).toEqual(["'none'"]);
    // The one outside frame is the video player.
    expect(rules.get('frame-src'), path).toEqual(['https://www.youtube-nocookie.com']);
  }

  // The browser enforces it: a script written into the page does not run, and a link that
  // carries code does nothing when followed.
  await page.goto(at('/'));
  const ran = await page.evaluate(async () => {
    const flags = window as unknown as { injected?: boolean; followed?: boolean };
    const script = document.createElement('script');
    script.textContent = 'window.injected = true';
    document.body.append(script);
    const link = document.createElement('a');
    link.href = 'javascript:window.followed = true';
    document.body.append(link);
    link.click();
    await new Promise((resolve) => setTimeout(resolve, 150));
    return { injected: flags.injected === true, followed: flags.followed === true };
  });
  expect(ran).toEqual({ injected: false, followed: false });
});

test('every address on every page is an ordinary one: the site, the web, or mail', async ({
  page,
}) => {
  for (const path of pages) {
    await page.goto(at(path));
    const odd = await page.evaluate(() => {
      const found: string[] = [];
      for (const el of document.querySelectorAll('*')) {
        for (const attribute of el.attributes) {
          const name = attribute.name.toLowerCase();
          // Nothing is wired to run code from an attribute.
          if (name.startsWith('on')) found.push(`<${el.localName} ${name}>`);
          if (!['href', 'src', 'action', 'formaction', 'poster', 'data'].includes(name)) continue;
          const { protocol } = new URL(attribute.value, document.baseURI);
          // A small picture may be carried inline; nothing else may be anything but a plain
          // address.
          const inlinePicture = protocol === 'data:' && el.localName === 'img';
          if (!['http:', 'https:', 'mailto:'].includes(protocol) && !inlinePicture) {
            found.push(`<${el.localName} ${name}="${attribute.value.slice(0, 60)}">`);
          }
        }
      }
      return found;
    });
    expect(odd, path).toEqual([]);
  }
});

test('every video shown as a card has its picture and can be played', async ({ page }) => {
  // A video the site has no thumbnail for (one just added through the editor, say) is listed as
  // an ordinary row with a link. A card with no picture would leave a hole in its row.
  for (const path of ['/media/', '/vigil/']) {
    await page.goto(at(path));
    const cards = page.locator('article.video');
    const count = await cards.count();
    await expect(cards.locator('.frame button.thumb img'), path).toHaveCount(count);
  }
});

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

test('unknown pages show the 404 page', async ({ page }) => {
  const response = await page.goto(at('/no-such-page/'));
  expect(response?.status()).toBe(404);
  await expect(page.locator('h1')).toContainText('Nothing in');
});
