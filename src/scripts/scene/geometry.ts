/** Shared 2D helpers for the dot-matrix scene on the home page. */

export type Vec = { x: number; y: number };
export type Box = { x0: number; y0: number; x1: number; y1: number };
/** A line segment as [ax, ay, bx, by]. */
export type Bone = readonly [number, number, number, number];

/** Anything in a scene: a silhouette, given as a signed distance field. */
export interface Figure {
  /** Loose bounds used to limit which dots are sampled. */
  bounds: Box;
  /** The segments the figure is built on, such as the bones of a hand. */
  bones: Bone[];
  /** Signed distance from a point to the silhouette, in pixels. */
  sdf: (x: number, y: number) => number;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Signed distance from a point to a circle. */
export function circle(px: number, py: number, cx: number, cy: number, r: number): number {
  return Math.hypot(px - cx, py - cy) - r;
}

/** Signed distance from a point to a segment with rounded ends. */
export function capsule(px: number, py: number, [ax, ay, bx, by]: Bone, r: number): number {
  const abx = bx - ax;
  const aby = by - ay;
  const t = clamp(((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby || 1), 0, 1);
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t)) - r;
}

export const area = (box: Box) => Math.max(0, box.x1 - box.x0) * Math.max(0, box.y1 - box.y0);

/** Intersection over union: 1 for identical boxes, 0 for boxes that do not overlap. */
export function iou(a: Box, b: Box): number {
  const overlap = area({
    x0: Math.max(a.x0, b.x0),
    y0: Math.max(a.y0, b.y0),
    x1: Math.min(a.x1, b.x1),
    y1: Math.min(a.y1, b.y1),
  });
  const union = area(a) + area(b) - overlap;
  return union > 0 ? overlap / union : 0;
}
