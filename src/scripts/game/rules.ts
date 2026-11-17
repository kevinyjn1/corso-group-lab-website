/**
 * Rules of Ground Truth, the annotation game: what counts as a correct box, how it scores, and
 * how a round ramps up. Nothing here touches the page, so the rules can be tested on their own.
 */
import { FIGURE_COLORS } from '../scene/figures';
import { type Box, clamp, iou, lerp } from '../scene/geometry';

export type Kind = keyof typeof FIGURE_COLORS;

export interface KindSpec {
  action: string;
  color: string;
  /** Score multiplier: smaller and faster targets are worth more. */
  value: number;
  /** Speed range, in scene units per second. */
  speed: readonly [number, number];
  /** Size relative to the figure's standard size on the home page. */
  size: number;
}

export const KINDS: Record<Kind, KindSpec> = {
  adult: {
    action: 'walking',
    color: FIGURE_COLORS.adult,
    value: 1,
    speed: [8, 10.5],
    size: 1,
  },
  dog: {
    action: 'running',
    color: FIGURE_COLORS.dog,
    value: 1.3,
    speed: [16, 21],
    size: 1,
  },
  ball: {
    action: 'bouncing',
    color: FIGURE_COLORS.ball,
    value: 1.5,
    speed: [12, 16],
    size: 1.5,
  },
  bird: {
    action: 'flying',
    color: FIGURE_COLORS.bird,
    value: 1.6,
    speed: [12, 16],
    size: 1.3,
  },
};

export const ROUND_SECONDS = 30;

/** Seconds as minutes and seconds, for the clock on the readout. */
export const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
/** The classic bar for a correct detection: the box and the truth overlap by at least half. */
export const HIT_IOU = 0.5;
/** Boxes this tight earn a bonus. */
export const PERFECT_IOU = 0.85;
export const PERFECT_BONUS = 50;
/** Below this overlap a box is treated as drawn around nothing. */
export const NEAR_IOU = 0.1;
/** Streaks stop adding to the multiplier after this many correct boxes in a row. */
export const STREAK_CAP = 10;

export type Verdict =
  | { result: 'hit' | 'loose'; index: number; iou: number }
  | { result: 'empty'; index: -1; iou: number };

/** Judge a drawn box against the true boxes of every target that is still unlabeled. */
export function judge(drawn: Box, truths: readonly Box[]): Verdict {
  let index = -1;
  let best = 0;
  truths.forEach((truth, i) => {
    const overlap = iou(drawn, truth);
    if (overlap > best) {
      best = overlap;
      index = i;
    }
  });
  if (index < 0 || best < NEAR_IOU) return { result: 'empty', index: -1, iou: best };
  return { result: best >= HIT_IOU ? 'hit' : 'loose', index, iou: best };
}

/**
 * Targets cross a floor that recedes from the viewer. Depth 1 is the near edge and depth 0 the
 * far edge, where targets are drawn smaller and are worth more.
 */
export const depthScale = (depth: number) => lerp(0.6, 1.05, clamp(depth, 0, 1));
export const FAR_BONUS = 0.3;

/** `streak` is the number of correct boxes in a row before this one. */
export const streakMultiplier = (streak: number) => 1 + Math.min(streak, STREAK_CAP) * 0.1;

export function pointsFor(overlap: number, kind: Kind, streak: number, depth = 1): number {
  const base = Math.round(overlap * 100) + (overlap >= PERFECT_IOU ? PERFECT_BONUS : 0);
  const distance = 1 + (1 - clamp(depth, 0, 1)) * FAR_BONUS;
  return Math.round(base * KINDS[kind].value * distance * streakMultiplier(streak));
}

const progress = (elapsed: number) => clamp(elapsed / ROUND_SECONDS, 0, 1);

/** Seconds between new targets: the scene gets busier as the round goes on. */
export const spawnGap = (elapsed: number) => lerp(1.9, 0.85, progress(elapsed));

/** Targets speed up as the round goes on. */
export const speedScale = (elapsed: number) => lerp(1, 1.45, progress(elapsed));

/** Which kind of target appears next: big and slow early, small and quick later. */
export function pickKind(elapsed: number, roll: number): Kind {
  const weights: [Kind, number][] =
    elapsed < ROUND_SECONDS / 5
      ? [
          ['adult', 4],
          ['dog', 3],
          ['ball', 2],
          ['bird', 1],
        ]
      : [
          ['adult', 2],
          ['dog', 3],
          ['ball', 3],
          ['bird', 3],
        ];
  let mark = clamp(roll, 0, 0.999999) * weights.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [kind, weight] of weights) {
    mark -= weight;
    if (mark < 0) return kind;
  }
  return 'bird';
}

/** Viewing conditions get harder in thirds, the way real footage does. */
export type Condition = 'clear' | 'occlusion' | 'low light';

export function conditionAt(elapsed: number): Condition {
  if (elapsed < ROUND_SECONDS / 3) return 'clear';
  return elapsed < (ROUND_SECONDS * 2) / 3 ? 'occlusion' : 'low light';
}

export const CONDITION_NOTES: Record<Condition, string> = {
  clear: 'Box everything that moves',
  occlusion: 'Label what you know is there',
  'low light': 'Trust the motion',
};

/** Score needed for each rank. Tuned for a round of ROUND_SECONDS; rescale if that changes. */
export const RANKS = [
  {
    from: 0,
    title: 'Random initialization',
    line: 'Everyone starts as noise. Train one more epoch.',
  },
  { from: 400, title: 'Weakly supervised', line: 'The labels are there in spirit.' },
  {
    from: 1000,
    title: 'Undergraduate annotator',
    line: 'Solid work. The next batch is ten thousand frames.',
  },
  {
    from: 1900,
    title: 'First-year Ph.D. student',
    line: 'You now have opinions about IoU thresholds.',
  },
  {
    from: 3000,
    title: 'Senior Ph.D. student',
    line: 'Fast, tight, and one deadline from graduating.',
  },
  { from: 4300, title: 'Ground truth', line: 'The benchmark is graded against you.' },
] as const;

export function rankFor(score: number) {
  return [...RANKS].reverse().find((rank) => score >= rank.from) ?? RANKS[0];
}

export interface Tally {
  score: number;
  /** Correct boxes. */
  hits: number;
  /** Boxes drawn, correct or not. */
  attempts: number;
  /** Targets that came and went during the round. */
  seen: number;
  /** Sum of the IoU of every correct box. */
  overlap: number;
  streak: number;
  bestStreak: number;
}

export const emptyTally = (): Tally => ({
  score: 0,
  hits: 0,
  attempts: 0,
  seen: 0,
  overlap: 0,
  streak: 0,
  bestStreak: 0,
});

/** The numbers a detector is graded on, computed for the player. */
export function summarize(tally: Tally) {
  return {
    recall: tally.seen > 0 ? tally.hits / tally.seen : 0,
    precision: tally.attempts > 0 ? tally.hits / tally.attempts : 0,
    meanIou: tally.hits > 0 ? tally.overlap / tally.hits : 0,
  };
}
