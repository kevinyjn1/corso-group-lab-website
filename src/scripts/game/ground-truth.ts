/**
 * Ground Truth: the easter egg. The visitor is the annotator, and a model's life depends on it.
 *
 * Figures from the home page scene cross the frame in waves. Dragging a box around one labels
 * it, scored on IoU against the true box the way a detector is graded. Correct boxes keep the
 * model's accuracy up; missed targets, stray boxes, and boxed hallucinations (figures that
 * flicker and are not really there) bring it down, and the round ends when it reaches zero.
 * Crates drift past with power-ups: auto-label, slow motion, double points, and clean data.
 *
 * The scene is the same dot matrix as the hero: figures are signed distance fields sampled on
 * a grid, and a figure's true box is the box around the dots it covers. Between rounds a
 * stand-in "model" labels the scene so the screen is never still.
 */
import {
  BALL_RADIUS,
  type Figure,
  bouncingBall,
  flyingBird,
  runningDog,
  walkingAdult,
} from '../scene/figures';
import { type Box, clamp, easeOut, iou, lerp } from '../scene/geometry';
import { INK, drawChip, drawCorners, paintCells, sample } from '../scene/raster';
import {
  ACCURACY,
  AUTO_SHARE,
  CRATE_GAP,
  CRATE_IOU,
  KINDS,
  type Kind,
  NOT_FOOLED_POINTS,
  PERFECT_IOU,
  POWER_UPS,
  type PowerUp,
  RARE_BOOST,
  RARE_CHANCE,
  SLOW_FACTOR,
  type Tally,
  WAVE_SECONDS,
  type Wave,
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
} from './rules';

type Phase = 'idle' | 'playing' | 'over';

interface Target {
  kind: Kind;
  x: number;
  dir: 1 | -1;
  /** Scene units per second. */
  speed: number;
  /** Distance traveled, which drives the gait. */
  dist: number;
  /** 0 at the far edge of the floor, 1 at the near edge. Far targets are smaller. */
  depth: number;
  scale: number;
  /** The y of the floor under this target. */
  floor: number;
  /** Flight altitude for birds and bounce height for balls, in scene units. */
  lift: number;
  phase: number;
  figure: Figure;
  cells: number[];
  /** The true box this frame, or null while the target is out of frame. */
  box: Box | null;
  /** Center of the last true box, for feedback after the target has left. */
  lastY: number;
  /** True once the target has been in frame, so it counts toward recall. */
  seen: boolean;
  /** A hallucination: it flickers, and boxing it costs the model accuracy. */
  fake: boolean;
  /** A rare class: worth several times an ordinary target. */
  rare: boolean;
  /** The label on it, stored as offsets from the true box so it follows the target. */
  label: { iou: number; inset: Box; at: number; auto: boolean } | null;
  /** What the stand-in model reports between rounds. */
  confidence: number;
}

interface Crate {
  type: PowerUp;
  x: number;
  y: number;
  dir: 1 | -1;
  /** Pixels per second. */
  speed: number;
  phase: number;
}

interface Float {
  text: string;
  x: number;
  y: number;
  color: string;
  at: number;
}

interface Rejection {
  box: Box;
  text: string;
  at: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  at: number;
}

export interface GameElement extends HTMLElement {
  /** True boxes of the real targets a player could label right now. The tests use it. */
  groundTruth?: () => { kind: Kind; box: Box }[];
}

/** Height of the readout strip along the top, which labels must not cover. */
const HUD_HEIGHT = 46;
/** Smaller drags are treated as stray clicks, not as boxes. */
const MIN_BOX = 8;
const BEST_KEY = 'ground-truth-best';
const MUTED_KEY = 'ground-truth-muted';
const PILLARS = [0.3, 0.68];
const COLORS = {
  dot: 'rgba(255, 255, 255, 0.11)',
  floor: 'rgba(255, 255, 255, 0.2)',
  ground: 'rgba(255, 255, 255, 0.16)',
  maize: '#ffcb05',
  miss: '#ff6b6b',
  text: '#f6f3ea',
  quiet: 'rgba(246, 243, 234, 0.7)',
};
const ZERO: Box = { x0: 0, y0: 0, x1: 0, y1: 0 };

const random = (lo: number, hi: number) => lerp(lo, hi, Math.random());
/** A repeatable value in [0, 1) for a pair of numbers, used to make hallucinations flicker. */
const noise = (a: number, b: number) => {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

export interface GameOptions {
  /** Called when a round ends, with its score and the wave it ended in. */
  onRoundOver?: (run: { score: number; wave: number }) => void;
}

export function mountGroundTruth(root: GameElement, options: GameOptions = {}): void {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;

  const part = <T extends HTMLElement = HTMLElement>(name: string) =>
    root.querySelector<T>(`[data-${name}]`);
  const set = (name: string, text: string) => {
    const element = part(name);
    if (element && element.textContent !== text) element.textContent = text;
  };
  const stored = (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const store = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Private browsing: the setting lasts for this visit only.
    }
  };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let unit = 5;
  let step = 10;
  /** The floor runs from the horizon down to its near edge. */
  let horizon = 0;
  let near = 0;
  /** Wide scenes take longer to cross, so everything moves a little faster in them. */
  let pace = 1;
  let compact = false;
  let fontFamily = 'monospace';
  let backdrop: HTMLCanvasElement | null = null;

  let phase: Phase = 'idle';
  /** Seconds of animation, which never slow down. */
  let time = 0;
  /** Seconds of play in the current round, which slow motion stretches. */
  let elapsed = 0;
  let last = 0;
  let running = false;
  let spawnClock = 0;
  let crateClock = 0;
  let tally: Tally = emptyTally();
  let accuracy: number = ACCURACY.start;
  let best = Number(stored(BEST_KEY)) || 0;

  let waveIndex = 0;
  let wave: Wave = waveAt(0);
  let rarePending = false;
  let occlusion = 0;
  let darkness = 0;
  let slowUntil = 0;
  let doubleUntil = 0;

  let targets: Target[] = [];
  let crates: Crate[] = [];
  let lastKind: Kind | null = null;
  let lastDir: 1 | -1 = 1;
  let floats: Float[] = [];
  let rejections: Rejection[] = [];
  let particles: Particle[] = [];
  let banner: { title: string; note: string; at: number } | null = null;
  let callout: { text: string; at: number } | null = null;
  let flash: { color: string; at: number } | null = null;
  let shakeUntil = 0;
  /** A beat of stillness after a perfect box. */
  let freeze = 0;
  let drag: { id: number; ax: number; ay: number; bx: number; by: number } | null = null;

  // --- Sound ---------------------------------------------------------------

  let audio: AudioContext | null = null;
  let muted = stored(MUTED_KEY) === '1';

  /** Play a short run of notes: [frequency, delay, length] in hertz and seconds. */
  function play(notes: [number, number, number][], shape: OscillatorType = 'square', level = 0.05) {
    if (muted || !audio || audio.state !== 'running') return;
    for (const [frequency, delay, length] of notes) {
      const at = audio.currentTime + delay;
      const voice = audio.createOscillator();
      const volume = audio.createGain();
      voice.type = shape;
      voice.frequency.setValueAtTime(frequency, at);
      volume.gain.setValueAtTime(level, at);
      volume.gain.exponentialRampToValueAtTime(0.0001, at + length);
      voice.connect(volume).connect(audio.destination);
      voice.start(at);
      voice.stop(at + length + 0.02);
    }
  }

  const sfx = {
    // Each box in a streak rings a step higher.
    hit: (streak: number) => play([[330 * Math.pow(2, Math.min(streak, 14) / 12), 0, 0.09]]),
    perfect: (streak: number) => {
      const base = 330 * Math.pow(2, Math.min(streak, 14) / 12);
      play([
        [base, 0, 0.07],
        [base * 1.5, 0.06, 0.12],
      ]);
    },
    miss: () => play([[150, 0, 0.2]], 'sawtooth', 0.06),
    fooled: () =>
      play(
        [
          [240, 0, 0.09],
          [170, 0.08, 0.2],
        ],
        'sawtooth',
        0.06,
      ),
    power: () =>
      play([
        [523, 0, 0.08],
        [659, 0.07, 0.08],
        [784, 0.14, 0.16],
      ]),
    wave: () =>
      play(
        [
          [392, 0, 0.1],
          [523, 0.1, 0.18],
        ],
        'triangle',
        0.08,
      ),
    over: () =>
      play(
        [
          [392, 0, 0.16],
          [311, 0.16, 0.16],
          [233, 0.32, 0.4],
        ],
        'sawtooth',
        0.06,
      ),
  };

  function showSound() {
    const button = part<HTMLButtonElement>('sound');
    if (!button) return;
    button.setAttribute('aria-pressed', String(!muted));
    button.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
    set('sound-state', muted ? 'Sound off' : 'Sound on');
  }

  // --- Scene ---------------------------------------------------------------

  function resize() {
    const rect = root.getBoundingClientRect();
    width = Math.round(rect.width);
    height = Math.round(rect.height);
    if (width === 0 || height === 0) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas!.width = Math.round(width * dpr);
    canvas!.height = Math.round(height * dpr);
    fontFamily = getComputedStyle(canvas!).fontFamily || 'monospace';

    compact = width < 560;
    unit = height / 100;
    step = clamp(Math.round(Math.min(width / 118, unit * 2.1)), 5, 11);
    // Tall, narrow screens get a deeper floor, so the scene fills them.
    near = Math.round((height * 0.9) / step) * step;
    horizon = Math.round((height * (compact ? 0.56 : 0.7)) / step) * step;
    pace = clamp(width / unit / 110, 1, 1.8);
    for (const target of targets) target.floor = floorAt(target.depth);

    backdrop = document.createElement('canvas');
    backdrop.width = canvas!.width;
    backdrop.height = canvas!.height;
    const layer = backdrop.getContext('2d')!;
    layer.scale(dpr, dpr);
    const size = Math.max(1, step * 0.14);
    for (let y = step / 2; y < height; y += step) {
      layer.fillStyle = y > horizon ? COLORS.floor : COLORS.dot;
      for (let x = step / 2; x < width; x += step) {
        layer.fillRect(x - size / 2, y - size / 2, size, size);
      }
    }
    if (!running) draw();
  }

  const floorAt = (depth: number) => Math.round(lerp(horizon, near, depth) / step) * step;

  function place(target: Target): Figure {
    const u = unit * target.scale;
    switch (target.kind) {
      case 'adult':
        return walkingAdult(target.x, target.dir, target.dist, target.floor, u);
      case 'dog':
        return runningDog(target.x, target.dir, target.dist, target.floor, u);
      case 'ball': {
        const bounce = Math.abs(Math.sin(target.dist / (8.5 * u) + target.phase)) * target.lift;
        return bouncingBall(target.x, target.floor - BALL_RADIUS * u - bounce * u, target.dir, u);
      }
      case 'bird': {
        const y = target.lift * unit + Math.sin(target.dist / (26 * u) + target.phase) * 5 * u;
        return flyingBird(target.x, y, target.dir, time * 9 + target.phase, u);
      }
    }
  }

  /** How far outside the frame a target starts and ends, so it is fully out of view. */
  const margin = (target: Pick<Target, 'scale'>) => 20 * unit * target.scale;

  function spawn(kind: Kind, traits: { entering?: boolean; fake?: boolean; rare?: boolean } = {}) {
    const spec = KINDS[kind];
    // Targets mostly alternate sides, so they do not bunch up.
    const dir: 1 | -1 = Math.random() < 0.7 ? (lastDir === 1 ? -1 : 1) : lastDir;
    lastDir = dir;
    const depth = traits.entering ? 1 : Math.random();
    const scale = depthScale(depth) * spec.size;
    // Birds fly between the readout strip and the horizon.
    const ceiling = HUD_HEIGHT / unit + 16 * scale;
    const skyline = horizon / unit - 6 * scale;
    const target: Target = {
      kind,
      dir,
      x: 0,
      speed:
        random(...spec.speed) * pace * lerp(0.8, 1, depth) * (phase === 'playing' ? wave.speed : 1),
      dist: random(0, 40) * unit,
      depth,
      scale,
      floor: floorAt(depth),
      lift: kind === 'bird' ? random(ceiling, Math.max(ceiling + 2, skyline)) : random(6, 12),
      phase: random(0, Math.PI * 2),
      figure: { bounds: { x0: 0, y0: 0, x1: -1, y1: -1 }, bones: [], sdf: () => 1 },
      cells: [],
      box: null,
      lastY: near - 10 * unit,
      seen: false,
      fake: traits.fake ?? false,
      rare: traits.rare ?? false,
      label: null,
      confidence: random(0.9, 0.99),
    };
    // A target that is "entering" starts at the edge of the frame instead of well outside it.
    const start = traits.entering ? margin(target) * 0.45 : margin(target);
    target.x = dir === 1 ? -start : width + start;
    targets.push(target);
  }

  const crateSize = () => clamp(unit * 7.5, 30, 50);

  function crateBox(crate: Crate): Box {
    const half = crateSize() / 2;
    const y = crate.y + Math.sin(time * 2.2 + crate.phase) * unit * 1.6;
    return { x0: crate.x - half, y0: y - half, x1: crate.x + half, y1: y + half };
  }

  function spawnCrate() {
    const size = crateSize();
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    crates.push({
      type: pickPowerUp(Math.random(), accuracy),
      x: dir === 1 ? -size : width + size,
      y: random(HUD_HEIGHT + size * 1.4, Math.max(HUD_HEIGHT + size * 1.6, horizon - size * 1.6)),
      dir,
      speed: (width + size * 2) / random(6, 8),
      phase: random(0, Math.PI * 2),
    });
  }

  function startWave(index: number) {
    waveIndex = index;
    wave = waveAt(index);
    tally.wave = index + 1;
    rarePending = index > 0 && Math.random() < RARE_CHANCE;
    banner = { title: `Wave ${index + 1}: ${wave.name}`, note: wave.note, at: time };
    if (index > 0) sfx.wave();
  }

  function burst(x: number, y: number, color: string, count = 14) {
    if (reduceMotion) return;
    for (let i = 0; i < count; i++) {
      const angle = random(0, Math.PI * 2);
      const speed = random(60, 260);
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        color,
        at: time,
      });
    }
  }

  /** Something went wrong: the model loses accuracy and the screen says so. */
  function damage(change: number) {
    accuracy = applyAccuracy(accuracy, change);
    flash = { color: COLORS.miss, at: time };
    if (!reduceMotion) shakeUntil = time + 0.3;
  }

  function advance(dt: number) {
    time += dt;
    floats = floats.filter((item) => time - item.at < 1.1);
    rejections = rejections.filter((item) => time - item.at < 0.55);
    particles = particles.filter((item) => time - item.at < 0.6);
    if (banner && time - banner.at > 2.6) banner = null;
    if (callout && time - callout.at > 1.2) callout = null;
    if (flash && time - flash.at > 0.35) flash = null;
    for (const particle of particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 520 * dt;
    }
    if (freeze > 0) {
      freeze -= dt;
      return;
    }

    const playing = phase === 'playing';
    const sim = dt * (playing && time < slowUntil ? SLOW_FACTOR : 1);

    if (playing) {
      elapsed += sim;
      const index = waveIndexAt(elapsed);
      if (index !== waveIndex) startWave(index);
      crateClock -= sim;
      if (crateClock <= 0) {
        spawnCrate();
        crateClock = random(...CRATE_GAP);
      }
    }

    // Busier on wide screens, where there is room, and calmer between rounds.
    const capacity = clamp(Math.round(width / 160), 4, 7) + (playing && waveIndex >= 5 ? 1 : 0);
    spawnClock -= sim;
    if (spawnClock <= 0 && targets.length < capacity) {
      const source = playing ? wave : waveAt(2);
      let kind = pickKind(source, Math.random());
      // One more roll when the same kind comes up twice running, for variety.
      if (kind === lastKind) kind = pickKind(source, Math.random());
      lastKind = kind;
      const fake = playing && Math.random() < wave.fakes;
      const rare = playing && !fake && rarePending && elapsed % WAVE_SECONDS > 2;
      if (rare) rarePending = false;
      spawn(kind, { fake, rare });
      const density = clamp(640 / width, 0.65, 1.25);
      spawnClock = playing ? wave.gap * density : 2.4;
    }

    const grid = { step, width, bottom: height };
    for (const target of targets) {
      const travel = target.speed * unit * sim;
      target.x += target.dir * travel;
      // The gait keeps close to its natural cadence even where the scene is paced up.
      target.dist += travel / Math.sqrt(pace);
      target.figure = place(target);
      target.box = sample(target.figure, grid, target.cells);
      if (!target.box) continue;
      target.lastY = (target.box.y0 + target.box.y1) / 2;
      if (!target.seen) {
        target.seen = true;
        if (playing && !target.fake) tally.seen++;
      }
    }

    targets = targets.filter((target) => {
      const gone =
        target.dir === 1 ? target.x > width + margin(target) : target.x < -margin(target);
      if (gone && playing && target.seen && !target.label) {
        const x = target.dir === 1 ? width - 46 : 46;
        if (target.fake) {
          // Letting a hallucination go by is the right call.
          tally.score += NOT_FOOLED_POINTS;
          floats.push({
            text: `not fooled +${NOT_FOOLED_POINTS}`,
            x,
            y: target.lastY,
            color: COLORS.quiet,
            at: time,
          });
        } else {
          tally.streak = 0;
          damage(ACCURACY.miss);
          sfx.miss();
          floats.push({ text: 'missed', x, y: target.lastY, color: COLORS.miss, at: time });
        }
      }
      return !gone;
    });

    for (const crate of crates) crate.x += crate.dir * crate.speed * sim;
    crates = crates.filter(
      (crate) => crate.x > -crateSize() * 1.5 && crate.x < width + crateSize() * 1.5,
    );

    const dim = playing && wave.dark ? 1 : 0;
    const blocked = playing && wave.occlusion ? 1 : 0;
    occlusion += (blocked - occlusion) * Math.min(1, dt * 5);
    darkness += (dim - darkness) * Math.min(1, dt * 4);
    syncReadout();
    if (playing && accuracy <= 0) finish();
  }

  // --- Round ---------------------------------------------------------------

  function start() {
    // The first press is the visitor's permission for sound.
    try {
      audio ??= new AudioContext();
      void audio.resume();
    } catch {
      audio = null;
    }
    phase = 'playing';
    tally = emptyTally();
    accuracy = ACCURACY.start;
    elapsed = 0;
    targets = [];
    crates = [];
    floats = [];
    rejections = [];
    particles = [];
    callout = null;
    flash = null;
    drag = null;
    slowUntil = 0;
    doubleUntil = 0;
    freeze = 0;
    crateClock = random(5, 7);
    startWave(0);
    // Every round opens with a walker: the largest, slowest target.
    spawn('adult', { entering: true });
    spawnClock = 1.4;
    root.dataset.phase = phase;
    part('start-panel')?.setAttribute('hidden', '');
    part('results-panel')?.setAttribute('hidden', '');
    set('announce', 'Round started. Drag a box around each moving figure.');
    syncReadout();
    setRunning(true);
    // Bring the whole screen into view, so nothing has to be scrolled in the middle of a round.
    root.scrollIntoView({ block: 'nearest' });
  }

  function finish() {
    phase = 'over';
    drag = null;
    // Targets still crossing when the round ends were never the player's to miss.
    tally.seen -= targets.filter((target) => target.seen && !target.label && !target.fake).length;
    targets = targets.filter((target) => !target.fake);
    crates = [];
    banner = null;
    callout = null;
    slowUntil = 0;
    doubleUntil = 0;
    sfx.over();

    const { recall, meanIou } = summarize(tally);
    const rank = rankFor(tally.score);
    const record = tally.score > best;
    if (record) {
      best = tally.score;
      store(BEST_KEY, String(best));
    }

    set('verdict', `The model collapsed in wave ${tally.wave}`);
    set('final-score', tally.score.toLocaleString('en-US'));
    set('rank', rank.title);
    set('rank-line', rank.line);
    set('stat-labeled', `${tally.hits} of ${tally.seen}`);
    set('stat-recall', `${Math.round(recall * 100)}% recall`);
    set('stat-iou', tally.hits > 0 ? meanIou.toFixed(2) : '0.00');
    set('stat-waves', String(tally.wave));
    set('stat-streak', String(tally.bestStreak));
    set('record', record ? 'New personal best' : `Personal best ${best.toLocaleString('en-US')}`);
    part('record')?.toggleAttribute('data-new', record);
    showBest();

    root.dataset.phase = phase;
    const results = part('results-panel');
    results?.removeAttribute('hidden');
    results?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
    set(
      'announce',
      `Round over in wave ${tally.wave}. ${tally.score} points. Rank: ${rank.title}. ` +
        `Labeled ${tally.hits} of ${tally.seen} targets.`,
    );
    syncReadout();
    options.onRoundOver?.({ score: tally.score, wave: tally.wave });
    if (reduceMotion) setRunning(false);
  }

  function showBest() {
    const note = part('best');
    if (!note) return;
    note.toggleAttribute('hidden', best <= 0);
    set('best-value', best.toLocaleString('en-US'));
  }

  /** Label a real target, by hand (`drawn`) or by the auto-label power-up (no box). */
  function award(target: Target, overlap: number, drawn: Box | null): number {
    const truth = target.box!;
    const boost = (time < doubleUntil ? 2 : 1) * (target.rare ? RARE_BOOST : 1);
    let gained = pointsFor(overlap, target.kind, tally.streak, target.depth, boost);
    if (!drawn) gained = Math.round(gained * AUTO_SHARE);
    target.label = {
      iou: overlap,
      auto: !drawn,
      at: time,
      inset: drawn
        ? {
            x0: drawn.x0 - truth.x0,
            y0: drawn.y0 - truth.y0,
            x1: drawn.x1 - truth.x1,
            y1: drawn.y1 - truth.y1,
          }
        : ZERO,
    };
    tally.score += gained;
    burst((truth.x0 + truth.x1) / 2, (truth.y0 + truth.y1) / 2, KINDS[target.kind].color);
    return gained;
  }

  function collect(crate: Crate) {
    const { name, seconds } = POWER_UPS[crate.type];
    const box = crateBox(crate);
    crates = crates.filter((other) => other !== crate);
    tally.powerUps++;
    callout = { text: name, at: time };
    flash = { color: COLORS.maize, at: time };
    burst((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, COLORS.maize, 22);
    sfx.power();

    if (crate.type === 'slow') slowUntil = time + seconds;
    if (crate.type === 'double') doubleUntil = time + seconds;
    if (crate.type === 'data') accuracy = applyAccuracy(accuracy, ACCURACY.cleanData);
    if (crate.type === 'auto') {
      // The model labels every real target in frame and prunes the hallucinations.
      targets = targets.filter((target) => {
        if (target.label || !target.box) return true;
        const x = (target.box.x0 + target.box.x1) / 2;
        const y = target.box.y0;
        if (target.fake) {
          tally.score += NOT_FOOLED_POINTS;
          burst(x, target.lastY, COLORS.text, 8);
          floats.push({ text: 'pruned', x, y, color: COLORS.quiet, at: time });
          return false;
        }
        const gained = award(target, 0.75, null);
        floats.push({ text: `auto +${gained}`, x, y, color: COLORS.maize, at: time });
        return true;
      });
    }
    syncReadout();
  }

  function commit(drawn: Box) {
    if (drawn.x1 - drawn.x0 < MIN_BOX || drawn.y1 - drawn.y0 < MIN_BOX) return;

    const crate = crates.find((candidate) => iou(drawn, crateBox(candidate)) >= CRATE_IOU);
    if (crate) {
      collect(crate);
      return;
    }

    const open = targets.filter((target) => !target.label && target.box);
    const verdict = judge(
      drawn,
      open.map((target) => target.box!),
    );
    tally.attempts++;
    const x = (drawn.x0 + drawn.x1) / 2;
    const y = Math.max(drawn.y0, HUD_HEIGHT + 20);

    if (verdict.result === 'hit' && open[verdict.index].fake) {
      // It looked like a target, but it was never there.
      const ghost = open[verdict.index];
      targets = targets.filter((target) => target !== ghost);
      tally.fooled++;
      tally.streak = 0;
      damage(ACCURACY.fooled);
      sfx.fooled();
      burst(x, (drawn.y0 + drawn.y1) / 2, COLORS.miss, 18);
      rejections.push({ box: drawn, text: 'hallucination!', at: time });
    } else if (verdict.result === 'hit') {
      const target = open[verdict.index];
      const perfect = verdict.iou >= PERFECT_IOU;
      const gained = award(target, verdict.iou, drawn);
      tally.hits++;
      tally.overlap += verdict.iou;
      tally.streak++;
      tally.bestStreak = Math.max(tally.bestStreak, tally.streak);
      accuracy = applyAccuracy(accuracy, perfect ? ACCURACY.perfect : ACCURACY.hit);
      const praise = calloutFor(tally.streak);
      if (praise) callout = { text: praise, at: time };
      if (perfect) sfx.perfect(tally.streak);
      else sfx.hit(tally.streak);
      if (perfect && !reduceMotion) freeze = 0.06;
      floats.push({
        text: `${target.rare ? 'Rare ' : perfect ? 'Perfect ' : ''}+${gained}`,
        x,
        y,
        color: COLORS.maize,
        at: time,
      });
    } else {
      tally.streak = 0;
      damage(ACCURACY.wrong);
      sfx.miss();
      rejections.push({
        box: drawn,
        text:
          verdict.result === 'loose' ? `IoU ${verdict.iou.toFixed(2)} needs 0.50` : 'nothing here',
        at: time,
      });
    }
    syncReadout();
    if (accuracy <= 0) finish();
  }

  function syncReadout() {
    const playing = phase === 'playing';
    const level = Math.round(accuracy);
    set('score', tally.score.toLocaleString('en-US'));
    set('streak', `×${streakMultiplier(tally.streak).toFixed(1)}`);
    set('wave', String(playing || phase === 'over' ? tally.wave : 1));
    set('accuracy', `${level}%`);
    const meter = part('meter');
    meter?.style.setProperty('--level', (accuracy / 100).toFixed(3));
    meter?.toggleAttribute('data-low', accuracy < 35);
    // The bar along the top is the time left in the wave.
    const left = playing ? 1 - (elapsed % WAVE_SECONDS) / WAVE_SECONDS : 1;
    part('timebar')?.style.setProperty('--left', left.toFixed(4));
    root.dataset.score = String(tally.score);
    root.dataset.hits = String(tally.hits);
    root.dataset.attempts = String(tally.attempts);
    root.dataset.accuracy = String(level);
    root.dataset.wave = String(tally.wave);
  }

  // --- Drawing -------------------------------------------------------------

  const chipStyle = () => ({ fontFamily, fontSize: compact ? 10 : 11, width, top: HUD_HEIGHT });

  /** A box with corner brackets and a chip, snapping in from a looser box when it is new. */
  function drawBox(box: Box, color: string, text: string, detail: string, since: number) {
    const lock = reduceMotion ? 1 : easeOut(clamp((time - since) / 0.35, 0, 1));
    const grow = (1 - lock) * 0.4;
    const bw = box.x1 - box.x0;
    const bh = box.y1 - box.y0;
    const x = Math.round(box.x0 - (bw * grow) / 2) + 0.5;
    const y = Math.round(box.y0 - (bh * grow) / 2) + 0.5;
    const w = Math.round(bw * (1 + grow));
    const h = Math.round(bh * (1 + grow));
    ctx!.strokeStyle = color;
    ctx!.globalAlpha = 0.55 * lock;
    ctx!.lineWidth = 1;
    ctx!.strokeRect(x, y, w, h);
    ctx!.globalAlpha = lock;
    drawCorners(ctx!, x, y, w, h);
    drawChip(
      ctx!,
      text,
      detail,
      { x0: x - 0.5, y0: y - 0.5, x1: x + w, y1: y + h },
      color,
      lock,
      chipStyle(),
    );
  }

  /** A hallucination: the figure flickers and tears, row by row. */
  function paintGhost(cells: number[], color: string, light: number) {
    const tick = Math.floor(time * 14);
    ctx!.fillStyle = color;
    for (let i = 0; i < cells.length; i += 3) {
      const row = Math.round(cells[i + 1] / step);
      const col = Math.round(cells[i] / step);
      const cover = cells[i + 2];
      const size = step * (0.2 + 0.62 * cover);
      let shift = 0;
      let flicker = 0.45;
      if (!reduceMotion) {
        if (noise(row, tick) < 0.24) shift = (noise(row, tick + 9) < 0.5 ? -1 : 1) * step;
        flicker = 0.22 + 0.62 * noise(col + tick * 3, row);
      }
      ctx!.globalAlpha = (0.35 + 0.65 * cover) * flicker * light;
      ctx!.fillRect(cells[i] + shift - size / 2, cells[i + 1] - size / 2, size, size);
    }
    ctx!.globalAlpha = 1;
  }

  /** Foreground columns that hide whatever passes behind them. */
  function drawPillars() {
    if (occlusion < 0.01) return;
    const pillar = (compact ? 7 : 9) * unit;
    const top = HUD_HEIGHT;
    const drop = top + (height - top) * easeOut(occlusion);
    const size = step * 0.34;
    for (const at of PILLARS) {
      const x = Math.round((width * at) / step) * step;
      const w = Math.ceil(pillar / step) * step;
      ctx!.fillStyle = INK;
      ctx!.fillRect(x, top, w, drop - top);
      ctx!.fillStyle = 'rgba(255, 255, 255, 0.2)';
      for (let cy = Math.ceil(top / step) * step + step / 2; cy < drop; cy += step) {
        for (let cx = x + step / 2; cx < x + w; cx += step) {
          ctx!.fillRect(cx - size / 2, cy - size / 2, size, size);
        }
      }
      ctx!.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx!.fillRect(x, top, 1, drop - top);
      ctx!.fillRect(x + w - 1, top, 1, drop - top);
    }
  }

  /** Sensor noise that comes up as the light goes down. */
  function drawNoise() {
    if (darkness < 0.05) return;
    const size = Math.max(1, step * 0.3);
    ctx!.fillStyle = COLORS.text;
    const specks = Math.round((width * height) / 5200);
    for (let i = 0; i < specks; i++) {
      const x = Math.floor(Math.random() * (width / step)) * step + step / 2;
      const y = Math.floor(Math.random() * (height / step)) * step + step / 2;
      ctx!.globalAlpha = Math.random() * 0.22 * darkness;
      ctx!.fillRect(x - size / 2, y - size / 2, size, size);
    }
    ctx!.globalAlpha = 1;
  }

  function drawText(text: string, x: number, y: number, color: string, alpha: number, size = 13) {
    ctx!.font = `600 ${size}px ${fontFamily}`;
    ctx!.textAlign = 'center';
    ctx!.textBaseline = 'middle';
    const half = ctx!.measureText(text).width / 2 + 6;
    const cx = clamp(x, half, width - half);
    ctx!.globalAlpha = alpha;
    ctx!.lineWidth = 4;
    ctx!.lineJoin = 'round';
    ctx!.strokeStyle = INK;
    ctx!.strokeText(text, cx, y);
    ctx!.fillStyle = color;
    ctx!.fillText(text, cx, y);
    ctx!.globalAlpha = 1;
  }

  /** A crate carrying a power-up: box it to collect it. */
  function drawCrates() {
    for (const crate of crates) {
      const box = crateBox(crate);
      const size = box.x1 - box.x0;
      const pulse = reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(time * 6 + crate.phase);
      ctx!.fillStyle = COLORS.maize;
      ctx!.fillRect(box.x0, box.y0, size, size);
      ctx!.strokeStyle = INK;
      ctx!.lineWidth = 2;
      ctx!.strokeRect(box.x0 + 4, box.y0 + 4, size - 8, size - 8);
      ctx!.strokeStyle = COLORS.maize;
      ctx!.globalAlpha = 0.35 + 0.5 * pulse;
      drawCorners(
        ctx!,
        box.x0 - 6 - pulse * 3,
        box.y0 - 6 - pulse * 3,
        size + 12 + pulse * 6,
        size + 12 + pulse * 6,
      );
      ctx!.globalAlpha = 1;
      ctx!.font = `700 ${Math.round(size * 0.46)}px ${fontFamily}`;
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      ctx!.fillStyle = INK;
      ctx!.fillText(POWER_UPS[crate.type].label, (box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2 + 1);
    }
  }

  /** Power-ups that are running, with the time each has left. */
  function drawEffects() {
    const active: [string, number, number][] = [];
    if (time < slowUntil) active.push(['slow motion', slowUntil - time, POWER_UPS.slow.seconds]);
    if (time < doubleUntil)
      active.push(['double points', doubleUntil - time, POWER_UPS.double.seconds]);
    active.forEach(([name, left, total], i) => {
      const y = HUD_HEIGHT + 14 + i * 20;
      ctx!.font = `600 ${compact ? 10 : 11}px ${fontFamily}`;
      ctx!.textAlign = 'left';
      ctx!.textBaseline = 'middle';
      ctx!.fillStyle = COLORS.maize;
      ctx!.fillText(name.toUpperCase(), 12, y);
      const from = 12 + ctx!.measureText(name.toUpperCase()).width + 8;
      ctx!.globalAlpha = 0.25;
      ctx!.fillRect(from, y - 2, 60, 4);
      ctx!.globalAlpha = 1;
      ctx!.fillRect(from, y - 2, 60 * clamp(left / total, 0, 1), 4);
    });
  }

  function drawBanner() {
    if (banner) {
      const age = time - banner.at;
      const alpha = clamp(age / 0.25, 0, 1) * clamp((2.6 - age) / 0.5, 0, 1);
      const y = HUD_HEIGHT + (compact ? 30 : 38);
      drawText(banner.title.toUpperCase(), width / 2, y, COLORS.maize, alpha, compact ? 14 : 17);
      drawText(banner.note, width / 2, y + 22, COLORS.text, alpha * 0.9, compact ? 11 : 12);
    }
    if (callout) {
      const age = (time - callout.at) / 1.2;
      const pop = reduceMotion ? 1 : 1 + 0.35 * (1 - easeOut(Math.min(1, age * 5)));
      const size = Math.round((compact ? 22 : 30) * pop);
      drawText(
        callout.text.toUpperCase(),
        width / 2,
        height * 0.36,
        COLORS.maize,
        1 - age * age,
        size,
      );
    }
  }

  function draw() {
    if (!backdrop || width === 0) return;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.clearRect(0, 0, width, height);
    if (time < shakeUntil) {
      const strength = ((shakeUntil - time) / 0.3) * 7;
      ctx!.translate(random(-strength, strength), random(-strength, strength));
    }
    ctx!.drawImage(backdrop, 0, 0, width, height);
    ctx!.fillStyle = COLORS.ground;
    ctx!.fillRect(0, horizon, width, 1);
    for (let x = step / 2; x < width; x += step * 4) ctx!.fillRect(x, horizon, 1, 4);

    // Far targets first, so nearer ones pass in front of them.
    const light = lerp(1, 0.3, darkness);
    for (const target of [...targets].sort((a, b) => a.depth - b.depth)) {
      const color = target.rare ? COLORS.text : KINDS[target.kind].color;
      if (target.fake) paintGhost(target.cells, color, light);
      else paintCells(ctx!, target.cells, step, color, target.rare ? 1 : light);
    }
    drawNoise();
    drawPillars();
    drawCrates();

    for (const target of targets) {
      if (!target.box) continue;
      const { color, action } = KINDS[target.kind];
      if (target.label) {
        const { inset, iou: overlap, at, auto } = target.label;
        const box = {
          x0: target.box.x0 + inset.x0,
          y0: target.box.y0 + inset.y0,
          x1: target.box.x1 + inset.x1,
          y1: target.box.y1 + inset.y1,
        };
        drawBox(box, color, target.kind, auto ? 'auto' : `IoU ${overlap.toFixed(2)}`, at);
      } else if (phase !== 'playing') {
        // Between rounds a stand-in model labels the scene.
        drawBox(
          target.box,
          color,
          compact ? target.kind : `${target.kind} · ${action}`,
          compact ? '' : target.confidence.toFixed(2),
          -1,
        );
      } else if (target.rare) {
        // A rare class announces itself: it is worth going after.
        const twinkle = reduceMotion ? 1 : 0.6 + 0.4 * Math.sin(time * 9);
        drawChip(
          ctx!,
          'rare class',
          `×${RARE_BOOST}`,
          target.box,
          COLORS.maize,
          twinkle,
          chipStyle(),
        );
      }
    }
    ctx!.globalAlpha = 1;

    for (const particle of particles) {
      const age = (time - particle.at) / 0.6;
      const size = step * 0.6 * (1 - age * 0.6);
      ctx!.globalAlpha = 1 - age;
      ctx!.fillStyle = particle.color;
      ctx!.fillRect(particle.x - size / 2, particle.y - size / 2, size, size);
    }
    ctx!.globalAlpha = 1;

    for (const { box, text, at } of rejections) {
      const age = (time - at) / 0.55;
      const shake = reduceMotion ? 0 : Math.sin(age * 34) * 5 * (1 - age);
      ctx!.globalAlpha = 1 - age;
      ctx!.strokeStyle = COLORS.miss;
      ctx!.lineWidth = 1.5;
      ctx!.strokeRect(box.x0 + shake + 0.5, box.y0 + 0.5, box.x1 - box.x0, box.y1 - box.y0);
      drawText(
        text,
        (box.x0 + box.x1) / 2,
        Math.max(box.y0 - 12, HUD_HEIGHT + 12),
        COLORS.miss,
        1 - age,
        12,
      );
    }

    if (drag) {
      const x = Math.min(drag.ax, drag.bx);
      const y = Math.min(drag.ay, drag.by);
      const w = Math.abs(drag.bx - drag.ax);
      const h = Math.abs(drag.by - drag.ay);
      ctx!.fillStyle = 'rgba(255, 203, 5, 0.07)';
      ctx!.fillRect(x, y, w, h);
      ctx!.strokeStyle = COLORS.maize;
      ctx!.lineWidth = 1;
      ctx!.setLineDash([4, 3]);
      ctx!.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h));
      ctx!.setLineDash([]);
      if (w > 6 && h > 6) drawCorners(ctx!, Math.round(x) + 0.5, Math.round(y) + 0.5, w, h);
    }

    for (const { text, x, y, color, at } of floats) {
      const age = (time - at) / 1.1;
      const rise = reduceMotion ? 18 : easeOut(age) * 34;
      drawText(text, x, y - 10 - rise, color, 1 - age * age);
    }
    drawEffects();
    drawBanner();

    if (flash && !reduceMotion) {
      ctx!.globalAlpha = 0.2 * (1 - (time - flash.at) / 0.35);
      ctx!.fillStyle = flash.color;
      ctx!.fillRect(-10, -10, width + 20, height + 20);
      ctx!.globalAlpha = 1;
    }
  }

  // --- Loop and input ------------------------------------------------------

  function frame(now: number) {
    if (!running) return;
    advance(Math.min((now - last) / 1000, 0.05));
    last = now;
    draw();
    requestAnimationFrame(frame);
  }

  function setRunning(next: boolean) {
    // With reduced motion the scene only moves while a round is being played.
    const allowed = next && !document.hidden && (phase === 'playing' || !reduceMotion);
    if (allowed === running) return;
    running = allowed;
    if (running) {
      last = performance.now();
      requestAnimationFrame(frame);
    }
  }

  const point = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp(event.clientX - rect.left, 0, width),
      y: clamp(event.clientY - rect.top, 0, height),
    };
  };

  canvas.addEventListener('pointerdown', (event) => {
    if (phase !== 'playing' || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    const { x, y } = point(event);
    drag = { id: event.pointerId, ax: x, ay: y, bx: x, by: y };
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const { x, y } = point(event);
    drag.bx = x;
    drag.by = y;
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const { ax, ay, bx, by } = drag;
    drag = null;
    if (phase !== 'playing') return;
    commit({
      x0: Math.min(ax, bx),
      y0: Math.min(ay, by),
      x1: Math.max(ax, bx),
      y1: Math.max(ay, by),
    });
  });
  canvas.addEventListener('pointercancel', () => {
    drag = null;
  });

  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-start]')) {
    button.addEventListener('click', start);
  }
  part('sound')?.addEventListener('click', () => {
    muted = !muted;
    store(MUTED_KEY, muted ? '1' : '0');
    showSound();
    if (!muted) sfx.hit(4);
  });
  document.addEventListener('visibilitychange', () => setRunning(true));

  root.groundTruth = () =>
    targets
      .filter((target) => !target.label && target.box && !target.fake)
      .map((target) => ({ kind: target.kind, box: { ...target.box! } }));

  new ResizeObserver(resize).observe(root);
  resize();
  document.fonts?.ready.then(() => {
    fontFamily = getComputedStyle(canvas).fontFamily || fontFamily;
    if (!running) draw();
  });

  showBest();
  showSound();
  syncReadout();
  root.dataset.phase = phase;
  root.dataset.ready = '';

  // Open on a scene that is already under way rather than an empty frame.
  for (const kind of ['adult', 'dog', 'bird'] as const) spawn(kind);
  for (let i = 0; i < 150; i++) advance(0.05);
  draw();
  setRunning(true);
}
