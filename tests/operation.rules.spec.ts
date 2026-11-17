import { expect, test } from '@playwright/test';
import {
  GESTURES,
  HAND_KEYPOINTS,
  LOOP_SECONDS,
  STITCHES,
  STITCH_SECONDS,
  beatAt,
  operationAt,
  progressAt,
} from '../src/scripts/scene/operation';

/** The scene on the home page is a pure function of time, so its story can be checked directly. */

test('each stitch is four gestures in order, and the stitches add up', () => {
  for (let stitch = 0; stitch < STITCHES; stitch++) {
    const seen: string[] = [];
    for (let i = 0; i < 100; i++) {
      // Sampled between the hundredths, so no sample falls exactly on a boundary.
      const progress = progressAt((stitch + (i + 0.5) / 100) * STITCH_SECONDS);
      expect(progress.stitches).toBe(stitch);
      expect(progress.flow).toBe(0);
      expect(progress.within).toBeGreaterThanOrEqual(0);
      expect(progress.within).toBeLessThan(1);
      if (seen[seen.length - 1] !== progress.gesture) seen.push(progress.gesture!);
    }
    expect(seen).toEqual([...GESTURES]);
  }
});

test('after the last stitch the graft is open, and then the round starts again', () => {
  const sewing = STITCHES * STITCH_SECONDS;
  const open = progressAt(sewing + 1);
  expect(open.stitches).toBe(STITCHES);
  expect(open.gesture).toBeNull();
  expect(open.flow).toBeGreaterThan(0);
  expect(open.flow).toBeLessThan(1);
  expect(progressAt(LOOP_SECONDS + 0.1)).toEqual(progressAt(0.1));
  // Time before the start is treated as the end of the round before.
  expect(progressAt(-1).gesture).toBeNull();
});

test('the heart beats between rest and a peak', () => {
  const samples = Array.from({ length: 200 }, (_, i) => beatAt(i / 100));
  expect(Math.min(...samples)).toBeGreaterThanOrEqual(0);
  expect(Math.max(...samples)).toBeGreaterThan(0.95);
  expect(Math.max(...samples)).toBeLessThanOrEqual(1);
});

test('each hand has 21 keypoints, and the instruments meet at the join', () => {
  const [width, height, unit] = [1280, 420, 7];
  for (const time of [0.2, 1.1, 4.4, 9.7, 15.3, 22]) {
    const scene = operationAt(time, width, height, unit);
    for (const hand of [scene.left, scene.right]) {
      expect(hand.joints).toHaveLength(HAND_KEYPOINTS);
      // The wrist, and four joints for each of five fingers, joined by twenty bones.
      expect(hand.bones).toHaveLength(HAND_KEYPOINTS - 1);
      for (const joint of hand.joints) {
        expect(Number.isFinite(joint.x) && Number.isFinite(joint.y)).toBe(true);
      }
    }
    // Both working ends stay close to where the graft joins the artery.
    for (const tool of [scene.driver, scene.forceps]) {
      const reach = Math.hypot(tool.tip.x - scene.site.x, tool.tip.y - scene.site.y) / unit;
      expect(reach).toBeLessThan(24);
    }
    expect(scene.ring).toHaveLength(STITCHES);
    // The left hand is on the left and the right hand on the right.
    expect(scene.left.joints[0].x).toBeLessThan(scene.site.x);
    expect(scene.right.joints[0].x).toBeGreaterThan(scene.site.x);
  }
});

test('the suture is only drawn out after the needle has passed through', () => {
  const at = (stitch: number, share: number) =>
    operationAt((stitch + share) * STITCH_SECONDS, 1280, 420, 7);
  expect(at(2, 0.1).thread).toBeNull();
  expect(at(2, 0.4).thread).toBeNull();
  expect(at(2, 0.7).thread).not.toBeNull();
  expect(at(2, 0.9).thread).not.toBeNull();
});

test('the blood takes the graft, then the artery beyond the join', () => {
  const scene = operationAt(1, 1280, 420, 7);
  const [first] = scene.route;
  const last = scene.route[scene.route.length - 1];
  expect(first).toEqual(scene.graft.path[0]);
  expect(last).toEqual(scene.artery.path[scene.artery.path.length - 1]);
  // The blockage is upstream of the join, which is why the graft is needed.
  expect(scene.blockage.x).toBeLessThan(scene.site.x);
});
