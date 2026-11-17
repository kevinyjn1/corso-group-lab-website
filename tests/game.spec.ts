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

    // A small box in the corner of the floor surrounds nothing: it is an attempt, not a hit,
    // and it costs the model some accuracy.
    const { height } = (await game.boundingBox())!;
    const [hits, attempts, accuracy] = [
      await count(game, 'hits'),
      await count(game, 'attempts'),
      await count(game, 'accuracy'),
    ];
    await drawBox(page, game, { x0: 2, y0: height - 16, x1: 14, y1: height - 4 });
    await expect(game).toHaveAttribute('data-attempts', String(attempts + 1));
    await expect(game).toHaveAttribute('data-hits', String(hits));
    expect(await count(game, 'accuracy')).toBeLessThan(accuracy);

    // A stray click is not a box at all.
    await drawBox(page, game, { x0: 40, y0: height - 10, x1: 42, y1: height - 9 });
    await expect(game).toHaveAttribute('data-attempts', String(attempts + 1));
  });

  test('the round ends when the model collapses, and can be played again', async ({ page }) => {
    await page.clock.install();
    const game = await startRound(page);
    const results = game.locator('[data-results-panel]');
    await expect(results).toBeHidden();
    await expect(game).toHaveAttribute('data-accuracy', '100');
    await expect(game.locator('[data-wave]')).toHaveText('1');

    // With nobody labeling, targets get away and the model's accuracy drains to nothing.
    await page.clock.runFor(60_000);
    await expect(game).toHaveAttribute('data-phase', 'over');
    await expect(game).toHaveAttribute('data-accuracy', '0');
    await expect(results).toBeVisible();
    await expect(results.locator('[data-verdict]')).toContainText(/collapsed in wave \d+/);
    await expect(results.getByRole('heading')).toHaveText('Random initialization');
    await expect(results.locator('[data-final-score]')).toHaveText(/^\d+$/);
    await expect(results.locator('[data-stat-labeled]')).toHaveText(/^0 of \d+$/);
    await expect(game.getByRole('status')).toContainText('Round over');

    // The whole result card has to fit inside the game screen.
    const [screen, card] = [await game.boundingBox(), await results.locator('.card').boundingBox()];
    expect(card!.y).toBeGreaterThanOrEqual(screen!.y);
    expect(card!.y + card!.height).toBeLessThanOrEqual(screen!.y + screen!.height);

    await results.getByRole('button', { name: 'Label again' }).click();
    await expect(game).toHaveAttribute('data-phase', 'playing');
    await expect(game).toHaveAttribute('data-accuracy', '100');
    await expect(results).toBeHidden();
  });

  test('sound can be turned off, and the choice is remembered', async ({ page }) => {
    await page.goto(at('/play/'));
    const sound = page.locator('[data-game] [data-sound]');
    await expect(sound).toHaveAttribute('aria-pressed', 'true');
    await sound.click();
    await expect(sound).toHaveAttribute('aria-pressed', 'false');
    await expect(sound).toHaveAccessibleName('Turn sound on');
    await page.reload();
    await expect(sound).toHaveAttribute('aria-pressed', 'false');
  });

  test('starting a round brings the whole game screen into view', async ({ page }) => {
    await page.goto(at('/play/'));
    const game = page.locator('[data-game]');
    await expect(game).toHaveAttribute('data-ready', '');
    // Leave the game partly scrolled away, as it is for a visitor who has read on past it.
    await game.evaluate((element) =>
      window.scrollTo({
        top: element.getBoundingClientRect().top + window.scrollY + 180,
        behavior: 'instant',
      }),
    );
    expect((await game.boundingBox())!.y).toBeLessThan(0);

    await page.getByRole('button', { name: 'Start labeling' }).click();
    const header = (await page.locator('header.site-header').boundingBox())!;
    const viewport = page.viewportSize()!;
    await expect(async () => {
      const screen = (await game.boundingBox())!;
      expect(screen.y).toBeGreaterThanOrEqual(header.y + header.height);
      expect(screen.y + screen.height).toBeLessThanOrEqual(viewport.height);
    }).toPass({ timeout: 5_000 });
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

test('a round that makes the board can be posted with initials', async ({ page }) => {
  await page.clock.install();
  const game = await startRound(page);
  const board = page.locator('[data-board]');
  await expect(board).toHaveAttribute('data-shared', 'false');
  await expect(board.locator('[data-board-scope]')).toHaveText('This device');
  await expect(board.locator('[data-board-empty]')).toBeVisible();
  await expect(board.getByRole('button', { name: 'Post' })).toBeDisabled();

  // Score at least once, then let the round run out.
  await expect(async () => {
    const width = (await game.boundingBox())!.width;
    const inFrame = (await targets(game)).filter(({ box }) => box.x0 > 8 && box.x1 < width - 8);
    expect(inFrame.length).toBeGreaterThan(0);
    await drawBox(page, game, inFrame[0].box);
    expect(await count(game, 'hits')).toBeGreaterThan(0);
  }).toPass({ timeout: 20_000 });
  await page.clock.runFor(90_000);
  await expect(game).toHaveAttribute('data-phase', 'over');
  const score = await count(game, 'score');
  expect(score).toBeGreaterThan(0);

  await expect(board.locator('[data-board-status]')).toContainText('makes the board');
  const initials = board.getByLabel('Your initials');
  await initials.pressSequentially('k-n!7x');
  await expect(initials).toHaveValue('KN7');
  await board.getByRole('button', { name: 'Post' }).click();

  const rows = board.locator('[data-board-list] li');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('KN7');
  await expect(rows.first()).toContainText(score.toLocaleString('en-US'));
  await expect(rows.first()).toHaveAttribute('data-mine', '');
  await expect(board.locator('[data-board-status]')).toContainText('number 1');
  await expect(board.locator('[data-board-empty]')).toBeHidden();

  // The board and the initials are still there on the next visit.
  await page.reload();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('KN7');
  await expect(initials).toHaveValue('KN7');
});

test.describe('finding the hidden game', () => {
  test('the first find is announced once, with a way to play', async ({ page }) => {
    await page.goto(at('/'));
    const toast = page.locator('[data-egg-toast]');
    await expect(toast).toBeHidden();
    const scene = page.locator('[data-hero-scene]');
    await scene.scrollIntoViewIfNeeded();
    for (const mode of ['segment', 'pose', 'depth', 'detect']) {
      await scene.locator(`[data-mode="${mode}"]`).click();
    }
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Easter egg unlocked');
    await expect(toast.getByRole('link', { name: 'Play' })).toHaveAttribute('href', at('/play/'));
    await toast.getByRole('button', { name: 'Dismiss' }).click();
    await expect(toast).toBeHidden();

    // It is said once: coming back does not announce it again.
    await page.reload();
    await scene.scrollIntoViewIfNeeded();
    await scene.locator('[data-mode="pose"]').click();
    await expect(toast).toBeHidden();
  });

  test('arriving at the game marks it found without covering it', async ({ page }) => {
    await page.goto(at('/play/'));
    await expect(page.locator('.egg-label')).toHaveText('Easter egg unlocked');
    await expect(page.locator('html')).toHaveAttribute('data-egg-found', 'new');
    await expect(page.locator('[data-egg-toast]')).toBeHidden();
    await page.reload();
    await expect(page.locator('html')).not.toHaveAttribute('data-egg-found', 'new');
    // Having found it, the way in from the home page scene is already open.
    await page.goto(at('/'));
    await expect(page.locator('[data-hero-scene] [data-play]')).toBeVisible();
    await expect(page.locator('[data-egg-toast]')).toBeHidden();
  });
});

test.describe('ways into the hidden game', () => {
  test('the Konami code opens it from any page', async ({ page }) => {
    await page.goto(at('/people/'));
    const code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown'];
    code.push('ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a');
    for (const key of code) await page.keyboard.press(key);
    // A first find is announced where the visitor is, then the game opens.
    await expect(page.locator('[data-egg-toast]')).toBeVisible();
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
