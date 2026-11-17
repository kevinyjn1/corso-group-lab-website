import { expect, test } from '@playwright/test';
import {
  HIT_IOU,
  KINDS,
  type Kind,
  PERFECT_IOU,
  RANKS,
  ROUND_SECONDS,
  clock,
  conditionAt,
  depthScale,
  emptyTally,
  judge,
  pickKind,
  pointsFor,
  rankFor,
  spawnGap,
  speedScale,
  streakMultiplier,
  summarize,
} from '../src/scripts/game/rules';
import { iou } from '../src/scripts/scene/geometry';

const box = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });
const truth = box(100, 100, 200, 200);

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

test('tighter boxes, harder targets, distance, and streaks all score more', () => {
  expect(pointsFor(0.6, 'adult', 0)).toBe(60);
  expect(pointsFor(0.8, 'adult', 0)).toBeGreaterThan(pointsFor(0.6, 'adult', 0));
  // Crossing the "perfect" line is worth a bonus on top of the extra overlap.
  expect(pointsFor(PERFECT_IOU, 'adult', 0) - pointsFor(PERFECT_IOU - 0.01, 'adult', 0)).toBe(51);
  expect(pointsFor(0.7, 'bird', 0)).toBeGreaterThan(pointsFor(0.7, 'adult', 0));
  expect(pointsFor(0.7, 'adult', 0, 0)).toBeGreaterThan(pointsFor(0.7, 'adult', 0, 1));
  expect(pointsFor(0.7, 'adult', 5)).toBeGreaterThan(pointsFor(0.7, 'adult', 0));
});

test('the streak multiplier starts at one and is capped at two', () => {
  expect(streakMultiplier(0)).toBe(1);
  expect(streakMultiplier(5)).toBeCloseTo(1.5);
  expect(streakMultiplier(10)).toBe(2);
  expect(streakMultiplier(50)).toBe(2);
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

test('the clock reads in minutes and seconds', () => {
  expect(clock(0)).toBe('0:00');
  expect(clock(7)).toBe('0:07');
  expect(clock(30)).toBe('0:30');
  expect(clock(75)).toBe('1:15');
});

test('a round gets busier, faster, and harder to see as it goes on', () => {
  expect(spawnGap(ROUND_SECONDS)).toBeLessThan(spawnGap(0));
  expect(speedScale(ROUND_SECONDS)).toBeGreaterThan(speedScale(0));
  // Nothing keeps ramping after the round is over.
  expect(spawnGap(ROUND_SECONDS * 3)).toBe(spawnGap(ROUND_SECONDS));
  expect(conditionAt(0)).toBe('clear');
  expect(conditionAt(ROUND_SECONDS / 2)).toBe('occlusion');
  expect(conditionAt(ROUND_SECONDS - 1)).toBe('low light');
});

test('every kind of target can appear, and far targets are drawn smaller', () => {
  const kinds = Object.keys(KINDS) as Kind[];
  for (const moment of [0, ROUND_SECONDS]) {
    const seen = new Set<Kind>();
    for (let roll = 0; roll < 1; roll += 0.01) seen.add(pickKind(moment, roll));
    expect([...seen].sort()).toEqual([...kinds].sort());
  }
  // Rolls outside [0, 1) still give a kind rather than nothing.
  expect(kinds).toContain(pickKind(0, 1));
  expect(kinds).toContain(pickKind(0, -1));
  expect(depthScale(0)).toBeLessThan(depthScale(1));
});

test('the summary of a round grades it like a detector', () => {
  expect(summarize(emptyTally())).toEqual({ recall: 0, precision: 0, meanIou: 0 });
  const tally = { ...emptyTally(), hits: 6, attempts: 8, seen: 12, overlap: 4.5 };
  expect(summarize(tally)).toEqual({ recall: 0.5, precision: 0.75, meanIou: 0.75 });
});
