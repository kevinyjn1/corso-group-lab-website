import { expect, test, type Locator, type Page } from '@playwright/test';
import { at } from './base-path';

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The true boxes of the targets on screen, from the hook the game exposes for these tests. */
const targets = (game: Locator) =>
  game.evaluate((element) =>
    (element as HTMLElement & { groundTruth: () => { kind: string; box: Box }[] }).groundTruth(),
  );

const count = async (game: Locator, name: string) =>
  Number(await game.getAttribute(`data-${name}`));

/** Drag out a box on the game with the mouse. Coordinates are relative to the game. */
async function drawBox(page: Page, game: Locator, box: Box) {
  const origin = (await game.boundingBox())!;
  await page.mouse.move(origin.x + box.x0, origin.y + box.y0);
  await page.mouse.down();
  await page.mouse.move(origin.x + box.x1, origin.y + box.y1);
  await page.mouse.up();
}

async function startRound(page: Page) {
  await page.goto(at('/play/'));
  const game = page.locator('[data-game]');
  await expect(game).toHaveAttribute('data-ready', '');
  await game.scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Start labeling' }).click();
  await expect(game).toHaveAttribute('data-phase', 'playing');
  return game;
}

test.describe('Ground Truth', () => {
  test('a tight box scores and a stray box does not', async ({ page }) => {
    const game = await startRound(page);
    await expect(game).toHaveAttribute('data-score', '0');

    // Box a target that is fully in frame. Targets move, so allow another try.
    await expect(async () => {
      const width = (await game.boundingBox())!.width;
      const inFrame = (await targets(game)).filter(({ box }) => box.x0 > 8 && box.x1 < width - 8);
      expect(inFrame.length).toBeGreaterThan(0);
      await drawBox(page, game, inFrame[0].box);
      expect(await count(game, 'hits')).toBeGreaterThan(0);
    }).toPass({ timeout: 20_000 });
    expect(await count(game, 'score')).toBeGreaterThan(0);
    await expect(game.locator('[data-score]')).not.toHaveText('0');

    // A small box in the corner of the floor surrounds nothing: an attempt, but not a hit.
    const { height } = (await game.boundingBox())!;
    const [hits, attempts] = [await count(game, 'hits'), await count(game, 'attempts')];
    await drawBox(page, game, { x0: 2, y0: height - 16, x1: 14, y1: height - 4 });
    await expect(game).toHaveAttribute('data-attempts', String(attempts + 1));
    await expect(game).toHaveAttribute('data-hits', String(hits));

    // A stray click is not a box at all.
    await drawBox(page, game, { x0: 40, y0: height - 10, x1: 42, y1: height - 9 });
    await expect(game).toHaveAttribute('data-attempts', String(attempts + 1));
  });

  test('a round ends with a graded result and can be played again', async ({ page }) => {
    await page.clock.install();
    const game = await startRound(page);
    const results = game.locator('[data-results-panel]');
    await expect(results).toBeHidden();

    // Let the 45 second round run out without waiting for it.
    await page.clock.runFor(47_000);
    await expect(game).toHaveAttribute('data-phase', 'over');
    await expect(results).toBeVisible();
    await expect(results.getByRole('heading')).toHaveText('Random initialization');
    await expect(results.locator('[data-final-score]')).toHaveText('0');
    await expect(results.locator('[data-stat-precision]')).toHaveText('0%');
    await expect(game.getByRole('status')).toContainText('Round over');

    // The whole result card has to fit inside the game screen.
    const [screen, card] = [await game.boundingBox(), await results.locator('.card').boundingBox()];
    expect(card!.y).toBeGreaterThanOrEqual(screen!.y);
    expect(card!.y + card!.height).toBeLessThanOrEqual(screen!.y + screen!.height);

    await results.getByRole('button', { name: 'Label again' }).click();
    await expect(game).toHaveAttribute('data-phase', 'playing');
    await expect(results).toBeHidden();
  });

  test('the start card fits inside the game screen', async ({ page }) => {
    await page.goto(at('/play/'));
    const game = page.locator('[data-game]');
    const [screen, card] = [
      await game.boundingBox(),
      await game.locator('[data-start-panel] .card').boundingBox(),
    ];
    expect(card!.y).toBeGreaterThanOrEqual(screen!.y);
    expect(card!.y + card!.height).toBeLessThanOrEqual(screen!.y + screen!.height);
  });
});

test.describe('ways into the hidden game', () => {
  test('the Konami code opens it from any page', async ({ page }) => {
    await page.goto(at('/people/'));
    const code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown'];
    code.push('ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a');
    for (const key of code) await page.keyboard.press(key);
    await expect(page).toHaveURL(/\/play\/$/);
    await expect(page.locator('h1')).toContainText('Ground truth');
  });

  test('typing in the publication search never triggers it', async ({ page }) => {
    await page.goto(at('/publications/'));
    await page.getByRole('searchbox').focus();
    for (const key of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown']) {
      await page.keyboard.press(key);
    }
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']) {
      await page.keyboard.press(key);
    }
    await expect(page.getByRole('searchbox')).toHaveValue('ba');
    await expect(page).toHaveURL(/\/publications\//);
  });

  test('trying every view of the home page scene reveals a way in', async ({ page }) => {
    await page.goto(at('/'));
    const scene = page.locator('[data-hero-scene]');
    const play = scene.locator('[data-play]');
    await expect(play).toBeHidden();
    for (const mode of ['segment', 'pose', 'depth']) {
      await scene.locator(`[data-mode="${mode}"]`).click();
      await expect(play).toBeHidden();
    }
    await scene.locator('[data-mode="detect"]').click();
    await expect(play).toBeVisible();

    // Once found, it stays found.
    await page.reload();
    await expect(play).toBeVisible();
    await play.click();
    await expect(page).toHaveURL(/\/play\/$/);
  });

  test('the footer and the 404 page both point to it', async ({ page }) => {
    await page.goto(at('/'));
    await expect(page.locator('footer a.egg')).toHaveAttribute('href', at('/play/'));
    await page.goto(at('/no-such-page/'));
    await page.getByRole('link', { name: 'Label some data instead' }).click();
    await expect(page).toHaveURL(/\/play\/$/);
  });
});
