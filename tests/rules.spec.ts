import { expect, test } from '@playwright/test';
import {
  ACCURACY,
  HIT_IOU,
  KINDS,
  type Kind,
  PERFECT_IOU,
  POWER_UPS,
  type PowerUp,
  RANKS,
  WAVE_SECONDS,
  applyAccuracy,
  calloutFor,
  depthScale,
  emptyTally,
  judge,
  pickKind,
  pickPowerUp,
  pointsFor,
  rankFor,
  streakMultiplier,
  summarize,
  waveAt,
  waveIndexAt,
} from '../src/scripts/game/rules';
import { iou } from '../src/scripts/scene/geometry';

const box = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });
const truth = box(100, 100, 200, 200);
const rolls = Array.from({ length: 200 }, (_, i) => i / 200);

test('IoU is 1 for a perfect box, 0 for a miss, and the same either way round', () => {
  expect(iou(truth, truth)).toBe(1);
  expect(iou(truth, box(300, 300, 400, 400))).toBe(0);
  expect(iou(truth, box(200, 100, 300, 200))).toBe(0);
  // Half of each box overlaps: 5000 shared out of 15000 covered.
  expect(iou(truth, box(150, 100, 250, 200))).toBeCloseTo(1 / 3);
  expect(iou(box(150, 100, 250, 200), truth)).toBeCloseTo(1 / 3);
  expect(iou(truth, box(0, 0, 0, 0))).toBe(0);
});

test('a box counts at half overlap and is loose just below it', () => {
  // A box the same height that covers the left two thirds of the truth: IoU 2/3.
  expect(judge(box(100, 100, 166.7, 200), [truth])).toMatchObject({ result: 'hit', index: 0 });
  // The same box, one third wide: IoU 1/3.
  expect(judge(box(100, 100, 133.3, 200), [truth])).toMatchObject({ result: 'loose', index: 0 });
  expect(judge(box(100, 100, 150, 200), [truth]).iou).toBeCloseTo(HIT_IOU);
  expect(judge(box(100, 100, 150, 200), [truth]).result).toBe('hit');
  expect(judge(box(400, 400, 450, 450), [truth])).toMatchObject({ result: 'empty', index: -1 });
  expect(judge(truth, [])).toMatchObject({ result: 'empty', index: -1 });
});

test('a box is judged against the target it overlaps most', () => {
  const others = [box(0, 0, 60, 60), truth, box(180, 180, 300, 300)];
  expect(judge(box(105, 95, 205, 195), others)).toMatchObject({ result: 'hit', index: 1 });
});

test('tighter boxes, harder targets, distance, streaks, and boosts all score more', () => {
  expect(pointsFor(0.6, 'adult', 0)).toBe(60);
  expect(pointsFor(0.8, 'adult', 0)).toBeGreaterThan(pointsFor(0.6, 'adult', 0));
  // Crossing the "perfect" line is worth a bonus on top of the extra overlap.
  expect(pointsFor(PERFECT_IOU, 'adult', 0) - pointsFor(PERFECT_IOU - 0.01, 'adult', 0)).toBe(51);
  expect(pointsFor(0.7, 'bird', 0)).toBeGreaterThan(pointsFor(0.7, 'adult', 0));
  expect(pointsFor(0.7, 'adult', 0, 0)).toBeGreaterThan(pointsFor(0.7, 'adult', 0, 1));
  expect(pointsFor(0.7, 'adult', 5)).toBeGreaterThan(pointsFor(0.7, 'adult', 0));
  // Double points, or a rare target, multiply the whole score.
  expect(pointsFor(0.7, 'adult', 0, 1, 2)).toBe(2 * pointsFor(0.7, 'adult', 0));
});

test('the streak multiplier starts at one and is capped at two', () => {
  expect(streakMultiplier(0)).toBe(1);
  expect(streakMultiplier(5)).toBeCloseTo(1.5);
  expect(streakMultiplier(10)).toBe(2);
  expect(streakMultiplier(50)).toBe(2);
});

test('streaks are cheered at milestones and not in between', () => {
  expect(calloutFor(3)).toBe('Accepted');
  expect(calloutFor(12)).toBe('Best paper');
  expect(calloutFor(1)).toBeUndefined();
  expect(calloutFor(4)).toBeUndefined();
});

test("the model's accuracy stays between 0 and 100, and mistakes cost more than hits earn", () => {
  expect(applyAccuracy(98, ACCURACY.perfect)).toBe(100);
  expect(applyAccuracy(5, ACCURACY.miss)).toBe(0);
  expect(applyAccuracy(50, ACCURACY.hit)).toBe(52);
  expect(ACCURACY.miss).toBeLessThan(ACCURACY.wrong);
  expect(ACCURACY.fooled).toBeLessThan(ACCURACY.wrong);
  expect(Math.abs(ACCURACY.miss)).toBeGreaterThan(ACCURACY.perfect);
  // A round with no boxes at all still ends: a handful of misses is enough.
  expect(Math.ceil(ACCURACY.start / -ACCURACY.miss)).toBeLessThan(10);
});

test('every score has a rank, and ranks rise with the score', () => {
  expect(rankFor(0).title).toBe(RANKS[0].title);
  expect(rankFor(-5).title).toBe(RANKS[0].title);
  expect(rankFor(1e9).title).toBe(RANKS[RANKS.length - 1].title);
  for (const [i, rank] of RANKS.entries()) {
    expect(rankFor(rank.from).title).toBe(rank.title);
    if (i > 0) {
      expect(rank.from).toBeGreaterThan(RANKS[i - 1].from);
      expect(rankFor(rank.from - 1).title).toBe(RANKS[i - 1].title);
    }
  }
});

test('waves start gently and only get harder', () => {
  const first = waveAt(0);
  expect(first.fakes).toBe(0);
  expect(first.occlusion || first.dark).toBe(false);
  expect(waveAt(-3)).toEqual(first);
  for (let i = 1; i < 40; i++) {
    const [before, wave] = [waveAt(i - 1), waveAt(i)];
    expect(wave.gap, `gap of wave ${i}`).toBeLessThanOrEqual(before.gap);
    expect(wave.speed, `speed of wave ${i}`).toBeGreaterThanOrEqual(before.speed);
    expect(wave.gap).toBeGreaterThan(0.3);
    expect(wave.speed).toBeLessThan(3);
    expect(wave.name).not.toBe('');
  }
  expect(waveAt(2).fakes).toBeGreaterThan(0);
  expect(waveIndexAt(0)).toBe(0);
  expect(waveIndexAt(WAVE_SECONDS - 0.01)).toBe(0);
  expect(waveIndexAt(WAVE_SECONDS)).toBe(1);
  expect(waveIndexAt(-1)).toBe(0);
});

test('a wave only sends the kinds of target it lists, and far targets are drawn smaller', () => {
  const kinds = Object.keys(KINDS) as Kind[];
  for (const index of [0, 1, 2, 9]) {
    const wave = waveAt(index);
    const seen = new Set(rolls.map((roll) => pickKind(wave, roll)));
    expect([...seen].sort()).toEqual(Object.keys(wave.kinds).sort());
  }
  // Rolls outside [0, 1) still give a kind rather than nothing.
  expect(kinds).toContain(pickKind(waveAt(2), 1));
  expect(kinds).toContain(pickKind(waveAt(2), -1));
  expect(depthScale(0)).toBeLessThan(depthScale(1));
});

test('every power-up can appear, and clean data comes more often to a struggling model', () => {
  const types = Object.keys(POWER_UPS) as PowerUp[];
  const share = (accuracy: number) =>
    rolls.filter((roll) => pickPowerUp(roll, accuracy) === 'data').length / rolls.length;
  expect(new Set(rolls.map((roll) => pickPowerUp(roll, 60)))).toEqual(new Set(types));
  expect(share(20)).toBeGreaterThan(share(60));
  expect(share(60)).toBeGreaterThan(share(100));
  expect(types).toContain(pickPowerUp(1, 50));
});

test('the summary of a round grades it like a detector', () => {
  expect(summarize(emptyTally())).toEqual({ recall: 0, precision: 0, meanIou: 0 });
  const tally = { ...emptyTally(), hits: 6, attempts: 8, seen: 12, overlap: 4.5 };
  expect(summarize(tally)).toEqual({ recall: 0.5, precision: 0.75, meanIou: 0.75 });
});
