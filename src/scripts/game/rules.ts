/**
 * Rules of Ground Truth, the annotation game.
 *
 * The player labels a moving scene to keep a model alive. Correct boxes score and keep the
 * model's accuracy up; missed targets, stray boxes, and boxed hallucinations bring it down, and
 * the round ends when it reaches zero. Waves get harder, and crates that drift past give
 * power-ups. Nothing here touches the page, so the rules can be tested on their own.
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
  adult: { action: 'walking', color: FIGURE_COLORS.adult, value: 1, speed: [8, 10.5], size: 1 },
  dog: { action: 'running', color: FIGURE_COLORS.dog, value: 1.3, speed: [16, 21], size: 1 },
  ball: { action: 'bouncing', color: FIGURE_COLORS.ball, value: 1.5, speed: [12, 16], size: 1.5 },
  bird: { action: 'flying', color: FIGURE_COLORS.bird, value: 1.6, speed: [12, 16], size: 1.3 },
};

// --- Boxes -------------------------------------------------------------------

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

/** `streak` is the number of correct boxes in a row before this one. */
export const streakMultiplier = (streak: number) => 1 + Math.min(streak, STREAK_CAP) * 0.1;

/**
 * Targets cross a floor that recedes from the viewer. Depth 1 is the near edge and depth 0 the
 * far edge, where targets are drawn smaller and are worth more.
 */
export const depthScale = (depth: number) => lerp(0.6, 1.05, clamp(depth, 0, 1));
export const FAR_BONUS = 0.3;

/** `boost` carries the double-points power-up and the bonus for a rare target. */
export function pointsFor(overlap: number, kind: Kind, streak: number, depth = 1, boost = 1) {
  const base = Math.round(overlap * 100) + (overlap >= PERFECT_IOU ? PERFECT_BONUS : 0);
  const distance = 1 + (1 - clamp(depth, 0, 1)) * FAR_BONUS;
  return Math.round(base * KINDS[kind].value * distance * streakMultiplier(streak) * boost);
}

/** Streaks are cheered on the way a paper moves up at a conference. */
const CALLOUTS: readonly (readonly [number, string])[] = [
  [3, 'Accepted'],
  [6, 'Spotlight'],
  [9, 'Oral'],
  [12, 'Best paper'],
  [16, 'Test of time'],
];

export const calloutFor = (streak: number) => CALLOUTS.find(([at]) => at === streak)?.[1];

// --- The model's accuracy ---------------------------------------------------

/** What each event does to the model's accuracy, in percentage points. The round ends at 0. */
export const ACCURACY = {
  start: 100,
  /** A correct box, and a tight one. */
  hit: 2,
  perfect: 4,
  /** A real target that left the frame unlabeled. */
  miss: -16,
  /** A box around nothing, or too loose to count. */
  wrong: -6,
  /** A box around a hallucination. */
  fooled: -14,
  /** The clean-data power-up. */
  cleanData: 30,
} as const;

export const applyAccuracy = (current: number, change: number) => clamp(current + change, 0, 100);

/** Points for letting a hallucination go by without boxing it. */
export const NOT_FOOLED_POINTS = 25;
/** A rare target is worth this many times an ordinary one. */
export const RARE_BOOST = 3;
/** Chance that a wave after the first includes one rare target. */
export const RARE_CHANCE = 0.45;

// --- Waves -------------------------------------------------------------------

export interface Wave {
  name: string;
  note: string;
  /** How often each kind of target appears, as relative weights. */
  kinds: Partial<Record<Kind, number>>;
  /** Seconds between new targets. */
  gap: number;
  /** Multiplier on how fast targets move. */
  speed: number;
  /** Share of targets that are hallucinations: flickering figures that must not be boxed. */
  fakes: number;
  occlusion: boolean;
  dark: boolean;
}

export const WAVE_SECONDS = 8;

const EVERYTHING = { adult: 2, dog: 3, ball: 3, bird: 3 };

const SCRIPT: readonly Wave[] = [
  {
    name: 'Warm-up',
    note: 'Box everything that moves',
    kinds: { adult: 4, dog: 3 },
    gap: 1.5,
    speed: 1,
    fakes: 0,
    occlusion: false,
    dark: false,
  },
  {
    name: 'Fast movers',
    note: 'Small and quick is worth more',
    kinds: { dog: 2, ball: 3, bird: 3 },
    gap: 1.2,
    speed: 1.1,
    fakes: 0,
    occlusion: false,
    dark: false,
  },
  {
    name: 'Hallucinations',
    note: 'Flickering figures are not real. Leave them',
    kinds: EVERYTHING,
    gap: 1.05,
    speed: 1.1,
    fakes: 0.38,
    occlusion: false,
    dark: false,
  },
  {
    name: 'Occlusion',
    note: 'Label what you know is there',
    kinds: EVERYTHING,
    gap: 1,
    speed: 1.2,
    fakes: 0.12,
    occlusion: true,
    dark: false,
  },
  {
    name: 'Low light',
    note: 'Trust the motion',
    kinds: EVERYTHING,
    gap: 0.95,
    speed: 1.25,
    fakes: 0.2,
    occlusion: false,
    dark: true,
  },
  {
    name: 'Rush hour',
    note: 'Everything at once',
    kinds: EVERYTHING,
    gap: 0.75,
    speed: 1.35,
    fakes: 0.25,
    occlusion: true,
    dark: false,
  },
];

/** The wave with this index, counting from 0. Past the scripted waves it only gets harder. */
export function waveAt(index: number): Wave {
  if (index < SCRIPT.length) return SCRIPT[Math.max(0, index)];
  const extra = index - SCRIPT.length + 1;
  return {
    name: `Overtime ${extra}`,
    note: 'Nobody has labeled this far',
    kinds: EVERYTHING,
    gap: Math.max(0.42, 0.7 * Math.pow(0.92, extra)),
    speed: Math.min(2.2, 1.4 * Math.pow(1.06, extra)),
    fakes: 0.28,
    occlusion: extra % 2 === 1,
    dark: extra % 2 === 0,
  };
}

export const waveIndexAt = (elapsed: number) => Math.max(0, Math.floor(elapsed / WAVE_SECONDS));

/** Which kind of target a wave sends next. `roll` is a random number in [0, 1). */
export function pickKind(wave: Wave, roll: number): Kind {
  const weights = Object.entries(wave.kinds) as [Kind, number][];
  let mark = clamp(roll, 0, 0.999999) * weights.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [kind, weight] of weights) {
    mark -= weight;
    if (mark < 0) return kind;
  }
  return weights[weights.length - 1][0];
}

// --- Power-ups ---------------------------------------------------------------

export type PowerUp = 'auto' | 'slow' | 'double' | 'data';

export const POWER_UPS: Record<PowerUp, { label: string; name: string; seconds: number }> = {
  /** The model labels every real target in frame and prunes the hallucinations. */
  auto: { label: 'A', name: 'Auto-label', seconds: 0 },
  slow: { label: 'S', name: 'Slow motion', seconds: 4.5 },
  double: { label: '×2', name: 'Double points', seconds: 7 },
  data: { label: '+', name: 'Clean data', seconds: 0 },
};

/** Seconds between crates, as a range. */
export const CRATE_GAP = [7, 11] as const;
/** How much of normal speed the scene keeps during slow motion. */
export const SLOW_FACTOR = 0.35;
/** Auto-labeled targets score this share of a hand-drawn box. */
export const AUTO_SHARE = 0.6;
/** A box collects a crate when it overlaps it at least this much. */
export const CRATE_IOU = 0.15;

/** Which crate comes next. Clean data shows up more often when the model is struggling. */
export function pickPowerUp(roll: number, accuracy: number): PowerUp {
  const weights: [PowerUp, number][] = [
    ['auto', 3],
    ['slow', 3],
    ['double', 3],
    ['data', accuracy < 50 ? 6 : accuracy < 80 ? 2 : 0.5],
  ];
  let mark = clamp(roll, 0, 0.999999) * weights.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [type, weight] of weights) {
    mark -= weight;
    if (mark < 0) return type;
  }
  return 'data';
}

// --- Results -----------------------------------------------------------------

/** Score needed for each rank. */
export const RANKS = [
  {
    from: 0,
    title: 'Random initialization',
    line: 'Everyone starts as noise. Train one more epoch.',
  },
  { from: 500, title: 'Weakly supervised', line: 'The labels are there in spirit.' },
  {
    from: 1500,
    title: 'Undergraduate annotator',
    line: 'Solid work. The next batch is ten thousand frames.',
  },
  {
    from: 3000,
    title: 'First-year Ph.D. student',
    line: 'You now have opinions about IoU thresholds.',
  },
  {
    from: 5500,
    title: 'Senior Ph.D. student',
    line: 'Fast, tight, and one deadline from graduating.',
  },
  { from: 9000, title: 'Ground truth', line: 'The benchmark is graded against you.' },
] as const;

export function rankFor(score: number) {
  return [...RANKS].reverse().find((rank) => score >= rank.from) ?? RANKS[0];
}

export interface Tally {
  score: number;
  /** Correct boxes drawn by hand. */
  hits: number;
  /** Boxes drawn, correct or not. */
  attempts: number;
  /** Real targets that came and went during the round. */
  seen: number;
  /** Sum of the IoU of every correct box. */
  overlap: number;
  streak: number;
  bestStreak: number;
  /** Hallucinations the player boxed. */
  fooled: number;
  /** Crates collected. */
  powerUps: number;
  /** The wave the round ended in, counting from 1. */
  wave: number;
}

export const emptyTally = (): Tally => ({
  score: 0,
  hits: 0,
  attempts: 0,
  seen: 0,
  overlap: 0,
  streak: 0,
  bestStreak: 0,
  fooled: 0,
  powerUps: 0,
  wave: 1,
});

/** The numbers a detector is graded on, computed for the player. */
export function summarize(tally: Tally) {
  return {
    recall: tally.seen > 0 ? Math.min(1, tally.hits / tally.seen) : 0,
    precision: tally.attempts > 0 ? tally.hits / tally.attempts : 0,
    meanIou: tally.hits > 0 ? tally.overlap / tally.hits : 0,
  };
}
