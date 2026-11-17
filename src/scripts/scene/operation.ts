/**
 * The cast of the home page scene: an operating field seen from above, in which a bypass graft
 * is sewn onto a coronary artery, one stitch at a time.
 *
 * Like the other scenes, everything is a signed distance field sized in units, where `u` is one
 * percent of the scene's height. Nothing here draws: `operationAt` says where everything is at a
 * moment, and the scene decides how to show it. The anatomy is a diagram, not a likeness.
 */
import {
  type Bone,
  type Box,
  type Vec,
  capsule,
  circle,
  clamp,
  easeInOut,
  lerp,
  type Figure,
} from './geometry';

// --- Timing ------------------------------------------------------------------

/** Stitches in one round of sewing. */
export const STITCHES = 8;
export const STITCH_SECONDS = 2.6;
/** After the last stitch, blood runs through the finished graft for this long. */
export const FLOW_SECONDS = 4.2;
export const LOOP_SECONDS = STITCHES * STITCH_SECONDS + FLOW_SECONDS;

/** What the sewing hand does for each stitch, in order. */
export const GESTURES = ['reach', 'drive', 'pull', 'tighten'] as const;
export type Gesture = (typeof GESTURES)[number];
/** The share of a stitch at which each gesture ends. */
const GESTURE_ENDS = [0.24, 0.5, 0.82, 1];

export interface Progress {
  /** Stitches finished so far in this round. */
  stitches: number;
  /** The gesture under way, or null once the graft is finished and blood is flowing. */
  gesture: Gesture | null;
  /** How far through the gesture, from 0 to 1. */
  within: number;
  /** How far the blood has run through the finished graft, from 0 to 1. It is 0 while sewing. */
  flow: number;
}

export function progressAt(time: number): Progress {
  const t = ((time % LOOP_SECONDS) + LOOP_SECONDS) % LOOP_SECONDS;
  const sewing = STITCHES * STITCH_SECONDS;
  if (t >= sewing) {
    return { stitches: STITCHES, gesture: null, within: 0, flow: (t - sewing) / FLOW_SECONDS };
  }
  const stitches = Math.floor(t / STITCH_SECONDS);
  const p = t / STITCH_SECONDS - stitches;
  const index = GESTURE_ENDS.findIndex((end) => p < end);
  const start = index === 0 ? 0 : GESTURE_ENDS[index - 1];
  return {
    stitches,
    gesture: GESTURES[index],
    within: (p - start) / (GESTURE_ENDS[index] - start),
    flow: 0,
  };
}

/** The heartbeat, from 0 at rest to 1 at the peak of each contraction. */
export function beatAt(time: number): number {
  const phase = (((time * 1.1) % 1) + 1) % 1;
  return Math.exp(-Math.pow((phase - 0.16) / 0.085, 2));
}

// --- Shapes ------------------------------------------------------------------

const direction = (angle: number): Vec => ({ x: Math.cos(angle), y: Math.sin(angle) });
const mix = (a: Vec, b: Vec, t: number): Vec => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

/** Signed distance to an ellipse turned by `turn`, good near the outline. */
function ellipse(px: number, py: number, c: Vec, rx: number, ry: number, turn: number): number {
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const x = (px - c.x) * cos + (py - c.y) * sin;
  const y = -(px - c.x) * sin + (py - c.y) * cos;
  return (Math.hypot(x / rx, y / ry) - 1) * Math.min(rx, ry);
}

/** Points along a curve from `a` to `b` that bends toward `pull`. */
function curve(a: Vec, pull: Vec, b: Vec, pieces: number): Vec[] {
  return Array.from({ length: pieces + 1 }, (_, i) => {
    const t = i / pieces;
    return mix(mix(a, pull, t), mix(pull, b, t), t);
  });
}

const segments = (points: Vec[]): Bone[] =>
  points.slice(1).map((point, i) => [points[i].x, points[i].y, point.x, point.y] as const);

function boundsOf(points: Vec[], pad: number): Box {
  return {
    x0: Math.min(...points.map((p) => p.x)) - pad,
    y0: Math.min(...points.map((p) => p.y)) - pad,
    x1: Math.max(...points.map((p) => p.x)) + pad,
    y1: Math.max(...points.map((p) => p.y)) + pad,
  };
}

/** A vessel: a run of rounded segments of one thickness. */
function vessel(points: Vec[], radius: number): Figure & { path: Vec[] } {
  const bones = segments(points);
  return {
    path: points,
    bones,
    bounds: boundsOf(points, radius * 2),
    sdf: (x, y) => Math.min(...bones.map((bone) => capsule(x, y, bone, radius))),
  };
}

// --- Hands -------------------------------------------------------------------

/**
 * A hand has 21 keypoints, the layout used in hand pose estimation: the wrist, then four joints
 * for each finger, from the thumb to the little finger.
 */
export const HAND_KEYPOINTS = 21;

export interface Hand extends Figure {
  joints: Vec[];
  /** The sleeve behind the wrist, which runs out of the frame. */
  sleeve: Figure;
}

/** Each finger: its angle from the hand's heading, where its knuckle sits, and how it bends. */
const FINGERS = [
  { spread: -0.98, reach: 3.6, lengths: [3.7, 3.1, 2.5], curl: -0.34, thick: 1.15 },
  { spread: -0.36, reach: 5.9, lengths: [4.5, 3.2, 2.5], curl: 0.3, thick: 0.92 },
  { spread: -0.07, reach: 6.2, lengths: [4.9, 3.4, 2.6], curl: 0.34, thick: 0.95 },
  { spread: 0.22, reach: 5.9, lengths: [4.5, 3.2, 2.4], curl: 0.38, thick: 0.9 },
  { spread: 0.5, reach: 5.2, lengths: [3.6, 2.6, 2.1], curl: 0.42, thick: 0.8 },
];

/**
 * A hand holding something between thumb and forefinger at `grip`, pointing along `heading`.
 * `side` is 1 for a right hand and -1 for a left, and `far` is a point well outside the frame
 * that the sleeve runs to.
 */
export function hand(grip: Vec, heading: number, side: 1 | -1, far: Vec, u: number): Hand {
  const fingers = FINGERS.map((finger) => {
    let angle = heading + side * finger.spread;
    let point: Vec = {
      x: Math.cos(angle) * finger.reach * u,
      y: Math.sin(angle) * finger.reach * u,
    };
    const joints = [point];
    for (const length of finger.lengths) {
      // Fingers bend toward the thumb and the thumb bends toward the fingers: a pinch.
      angle -= side * finger.curl;
      point = {
        x: point.x + Math.cos(angle) * length * u,
        y: point.y + Math.sin(angle) * length * u,
      };
      joints.push(point);
    }
    return joints;
  });
  // Place the hand so that the tips of the thumb and forefinger meet at the grip.
  const pinch = mix(fingers[0][3], fingers[1][3], 0.5);
  const palm: Vec = { x: grip.x - pinch.x, y: grip.y - pinch.y };
  const at = (p: Vec): Vec => ({ x: p.x + palm.x, y: p.y + palm.y });
  const wrist = at({ x: -Math.cos(heading) * 6.8 * u, y: -Math.sin(heading) * 6.8 * u });
  const placed = fingers.map((joints) => joints.map(at));
  const joints = [wrist, ...placed.flat()];

  const bones: Bone[] = [];
  const widths: number[] = [];
  placed.forEach((finger, f) => {
    bones.push([wrist.x, wrist.y, finger[0].x, finger[0].y]);
    widths.push(1.5 * u);
    for (let i = 1; i < finger.length; i++) {
      bones.push([finger[i - 1].x, finger[i - 1].y, finger[i].x, finger[i].y]);
      widths.push(FINGERS[f].thick * u);
    }
  });
  const cuff: Bone = [wrist.x, wrist.y, far.x, far.y];
  return {
    joints,
    bones,
    bounds: boundsOf(joints, 4 * u),
    sdf: (x, y) =>
      Math.min(
        circle(x, y, palm.x, palm.y, 3.9 * u),
        ...bones.map((bone, i) => capsule(x, y, bone, widths[i])),
      ),
    sleeve: {
      bones: [cuff],
      bounds: boundsOf([wrist, far], 6 * u),
      sdf: (x, y) => capsule(x, y, cuff, 4.3 * u),
    },
  };
}

// --- Instruments -------------------------------------------------------------

export interface Tool extends Figure {
  tip: Vec;
  /** Half way along the shaft, where a label can point. */
  middle: Vec;
}

/** A slender instrument held at `grip`, with its working end `length` units along `heading`. */
function tool(grip: Vec, heading: number, length: number, u: number): Tool {
  const d = direction(heading);
  const tip = { x: grip.x + d.x * length * u, y: grip.y + d.y * length * u };
  const handle = { x: grip.x - d.x * 5 * u, y: grip.y - d.y * 5 * u };
  const shaft: Bone = [handle.x, handle.y, tip.x, tip.y];
  return {
    tip,
    middle: mix(grip, tip, 0.45),
    bones: [shaft],
    bounds: boundsOf([handle, tip], 2 * u),
    sdf: (x, y) => capsule(x, y, shaft, 0.8 * u),
  };
}

// --- The operation -----------------------------------------------------------

const TOOL_LENGTH = 15;

export interface Operation {
  progress: Progress;
  /** Center of the heart. */
  center: Vec;
  heart: Figure;
  /** The coronary artery in two parts, with the blockage in the gap between them. */
  artery: Figure & { path: Vec[] };
  blockage: Vec;
  graft: Figure & { path: Vec[] };
  /** Where the graft joins the artery. */
  site: Vec;
  /** Every place a stitch goes, in sewing order; the first `progress.stitches` are done. */
  ring: Vec[];
  left: Hand;
  right: Hand;
  /** The needle driver in the right hand, and the forceps in the left. */
  driver: Tool;
  forceps: Tool;
  /** The suture between the last stitch and the needle, when it is being drawn through. */
  thread: Vec[] | null;
  /** The route the blood takes once the graft is open: down the graft, then on along the artery. */
  route: Vec[];
}

/**
 * Everything in the operating field at `time`, for a scene of this size. The view is a close one:
 * the join between graft and artery is at the center, the heart runs off the bottom of the frame,
 * and the surgeon's hands come in from the lower corners.
 */
export function operationAt(time: number, width: number, height: number, u: number): Operation {
  const progress = progressAt(time);
  const beat = beatAt(time);
  const swell = 1 + 0.03 * beat;
  const center: Vec = { x: width / 2, y: height * 0.47 };
  /** A point on the heart, which moves with each beat. */
  const on = (x: number, y: number): Vec => ({
    x: center.x + x * u * swell,
    y: center.y + (y - 14) * u * swell + 14 * u,
  });

  // The heart fills the middle of the frame, with the aorta leaving its upper left.
  const aorta: Bone = [on(-44, -8).x, on(-44, -8).y, on(-64, -48).x, on(-64, -48).y];
  const heart: Figure = {
    bones: [],
    bounds: { x0: on(-76, 0).x, y0: 0, x1: on(66, 0).x, y1: height },
    sdf: (x, y) =>
      Math.min(
        ellipse(x, y, on(0, 14), 62 * u * swell, 36 * u * swell, 0.06),
        capsule(x, y, aorta, 9 * u),
      ),
  };

  // The artery crosses the heart from left to right. Blood cannot pass the blockage near its
  // start, so the graft joins it further along, at the center of the frame.
  const course = [
    on(-46, -9),
    on(-38, -8),
    on(-27, -6),
    on(-18, -4),
    on(-9, -2),
    on(0, 0),
    on(9, 2.5),
    on(19, 5.5),
    on(30, 9),
    on(42, 13.5),
    on(56, 20),
  ];
  const branch = [course[6], on(17, -3), on(27, -6.5), on(36, -9)];
  const siteIndex = 5;
  const site = course[siteIndex];
  const parts = [course.slice(0, 2), course.slice(2), branch].map((points, i) =>
    vessel(points, (i === 2 ? 0.85 : 1.15) * u),
  );
  const artery = {
    path: course,
    bones: parts.flatMap((part) => part.bones),
    bounds: boundsOf([...course, ...branch], 3 * u),
    sdf: (x: number, y: number) => Math.min(...parts.map((part) => part.sdf(x, y))),
  };
  const blockage = mix(course[1], course[2], 0.5);

  // The graft leaves the aorta and arches over to the artery beyond the blockage.
  const graft = vessel(curve(on(-50, -22), on(-6, -44), site, 18), 1.5 * u);
  const route = [...graft.path, ...course.slice(siteIndex + 1)];

  // Stitches go round the join, which lies along the artery.
  const along = Math.atan2(course[siteIndex + 1].y - site.y, course[siteIndex + 1].x - site.x);
  const ring = Array.from({ length: STITCHES }, (_, k) => {
    const angle = (k / STITCHES) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * 3.4 * u;
    const y = Math.sin(angle) * 2.3 * u;
    return {
      x: site.x + x * Math.cos(along) - y * Math.sin(along),
      y: site.y + x * Math.sin(along) + y * Math.cos(along),
    };
  });

  // The right hand sews. For each stitch it reaches in, drives the needle through, draws the
  // suture out, and tightens it; when the graft is finished it rests clear of the join.
  const next = ring[Math.min(progress.stitches, STITCHES - 1)];
  const outward = Math.atan2(next.y - site.y, next.x - site.x);
  const entry = {
    x: next.x + Math.cos(outward) * 1.5 * u,
    y: next.y + Math.sin(outward) * 1.5 * u,
  };
  const exit = { x: next.x - Math.cos(outward) * 1.3 * u, y: next.y - Math.sin(outward) * 1.3 * u };
  const away: Vec = { x: site.x + 13 * u, y: site.y - 9 * u };
  const ease = easeInOut(clamp(progress.within, 0, 1));
  let needle = away;
  let roll = 0;
  if (progress.gesture === 'reach') needle = mix(away, entry, ease);
  if (progress.gesture === 'drive') {
    needle = mix(entry, exit, ease);
    roll = Math.sin(progress.within * Math.PI) * 0.35;
  }
  if (progress.gesture === 'pull') needle = mix(exit, away, ease);
  const rightHome: Vec = { x: center.x + 52 * u, y: center.y + 26 * u };
  const rightHeading = Math.atan2(needle.y - rightHome.y, needle.x - rightHome.x) - roll;
  const rightReach = direction(rightHeading);
  const rightGrip = {
    x: needle.x - rightReach.x * TOOL_LENGTH * u,
    y: needle.y - rightReach.y * TOOL_LENGTH * u,
  };
  const driver = tool(rightGrip, rightHeading, TOOL_LENGTH, u);
  const right = hand(rightGrip, rightHeading, 1, { x: width + 60 * u, y: center.y + 70 * u }, u);

  // The left hand steadies the edge of the graft with forceps, across from where the needle is.
  const across = ring[(Math.min(progress.stitches, STITCHES - 1) + STITCHES / 2) % STITCHES];
  const steady = progress.gesture === null ? 0 : 1;
  const held: Vec = {
    x:
      lerp(site.x - 12 * u, site.x + (across.x - site.x) * 1.5, steady) +
      Math.sin(time * 3.1) * 0.2 * u,
    y:
      lerp(site.y - 8 * u, site.y + (across.y - site.y) * 1.5, steady) +
      Math.cos(time * 2.3) * 0.2 * u,
  };
  const leftHome: Vec = { x: center.x - 50 * u, y: center.y + 30 * u };
  const leftHeading = Math.atan2(held.y - leftHome.y, held.x - leftHome.x);
  const leftReach = direction(leftHeading);
  const leftGrip = {
    x: held.x - leftReach.x * TOOL_LENGTH * u,
    y: held.y - leftReach.y * TOOL_LENGTH * u,
  };
  const forceps = tool(leftGrip, leftHeading, TOOL_LENGTH, u);
  const left = hand(leftGrip, leftHeading, -1, { x: -60 * u, y: center.y + 78 * u }, u);

  const drawing = progress.gesture === 'pull' || progress.gesture === 'tighten';
  return {
    progress,
    center,
    heart,
    artery,
    blockage,
    graft,
    site,
    ring,
    left,
    right,
    driver,
    forceps,
    thread: drawing ? [next, driver.tip] : null,
    route,
  };
}
