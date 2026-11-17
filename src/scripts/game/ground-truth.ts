/**
 * Ground Truth: the easter egg. The visitor is the annotator. Figures from the home page scene
 * cross the frame, the visitor drags a box around each one, and every box is scored on IoU
 * against the true box, the way a detector is graded.
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
import { type Box, clamp, easeOut, lerp } from '../scene/geometry';
import { INK, drawChip, drawCorners, paintCells, sample } from '../scene/raster';
import {
  CONDITION_NOTES,
  type Condition,
  KINDS,
  type Kind,
  PERFECT_IOU,
  ROUND_SECONDS,
  type Tally,
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
  /** The player's box, stored as offsets from the true box so it follows the target. */
  label: { iou: number; inset: Box; at: number } | null;
  /** What the stand-in model reports between rounds. */
  confidence: number;
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

export interface GameElement extends HTMLElement {
  /** True boxes of the targets a player could label right now. The end-to-end tests use it. */
  groundTruth?: () => { kind: Kind; box: Box }[];
}

/** Height of the readout strip along the top, which labels must not cover. */
const HUD_HEIGHT = 46;
/** Smaller drags are treated as stray clicks, not as boxes. */
const MIN_BOX = 8;
const BEST_KEY = 'ground-truth-best';
const PILLARS = [0.3, 0.68];
const COLORS = {
  dot: 'rgba(255, 255, 255, 0.11)',
  floor: 'rgba(255, 255, 255, 0.2)',
  ground: 'rgba(255, 255, 255, 0.16)',
  maize: '#ffcb05',
  miss: '#ff6b6b',
  text: '#eef1f6',
};

const random = (lo: number, hi: number) => lerp(lo, hi, Math.random());

export function mountGroundTruth(root: GameElement): void {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;

  const part = <T extends HTMLElement = HTMLElement>(name: string) =>
    root.querySelector<T>(`[data-${name}]`);
  const set = (name: string, text: string) => {
    const element = part(name);
    if (element && element.textContent !== text) element.textContent = text;
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
  let time = 0;
  let last = 0;
  let running = false;
  let elapsed = 0;
  let spawnClock = 0;
  let tally: Tally = emptyTally();
  let best = readBest();

  let condition: Condition = 'clear';
  let occlusion = 0;
  let darkness = 0;
  let banner: { title: string; note: string; at: number } | null = null;

  let targets: Target[] = [];
  let lastKind: Kind | null = null;
  let lastDir: 1 | -1 = 1;
  let floats: Float[] = [];
  let rejections: Rejection[] = [];
  let drag: { id: number; ax: number; ay: number; bx: number; by: number } | null = null;

  function readBest(): number {
    try {
      return Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {
      return 0;
    }
  }

  function saveBest(score: number) {
    best = score;
    try {
      localStorage.setItem(BEST_KEY, String(score));
    } catch {
      // Private browsing: the best score lasts for this visit only.
    }
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

  function spawn(kind: Kind, entering = false) {
    const spec = KINDS[kind];
    // Targets mostly alternate sides, so they do not bunch up.
    const dir: 1 | -1 = Math.random() < 0.7 ? (lastDir === 1 ? -1 : 1) : lastDir;
    lastDir = dir;
    const depth = entering ? 1 : Math.random();
    const scale = depthScale(depth) * spec.size;
    // Birds fly between the readout strip and the horizon.
    const ceiling = HUD_HEIGHT / unit + 16 * scale;
    const skyline = horizon / unit - 6 * scale;
    const ramp = phase === 'playing' ? speedScale(elapsed) : 1;
    const target: Target = {
      kind,
      dir,
      x: 0,
      speed: random(...spec.speed) * pace * lerp(0.8, 1, depth) * ramp,
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
      label: null,
      confidence: random(0.9, 0.99),
    };
    // A target that is "entering" starts at the edge of the frame instead of well outside it.
    const start = entering ? margin(target) * 0.45 : margin(target);
    target.x = dir === 1 ? -start : width + start;
    targets.push(target);
  }

  function advance(dt: number) {
    time += dt;

    if (phase === 'playing') {
      elapsed += dt;
      const next = conditionAt(elapsed);
      if (next !== condition) setCondition(next);
      if (elapsed >= ROUND_SECONDS) finish();
    }

    // Busier on wide screens, where there is room, and calmer between rounds.
    const capacity = clamp(Math.round(width / 160), 4, 7);
    spawnClock -= dt;
    if (spawnClock <= 0 && targets.length < capacity) {
      const moment = phase === 'playing' ? elapsed : ROUND_SECONDS;
      let kind = pickKind(moment, Math.random());
      // One more roll when the same kind comes up twice running, for variety.
      if (kind === lastKind) kind = pickKind(moment, Math.random());
      lastKind = kind;
      spawn(kind);
      const density = clamp(640 / width, 0.65, 1.25);
      spawnClock = phase === 'playing' ? spawnGap(elapsed) * density : 2.4;
    }

    const grid = { step, width, bottom: height };
    for (const target of targets) {
      const travel = target.speed * unit * dt;
      target.x += target.dir * travel;
      // The gait keeps close to its natural cadence even where the scene is paced up.
      target.dist += travel / Math.sqrt(pace);
      target.figure = place(target);
      target.box = sample(target.figure, grid, target.cells);
      if (!target.box) continue;
      target.lastY = (target.box.y0 + target.box.y1) / 2;
      if (!target.seen) {
        target.seen = true;
        if (phase === 'playing') tally.seen++;
      }
    }

    targets = targets.filter((target) => {
      const gone =
        target.dir === 1 ? target.x > width + margin(target) : target.x < -margin(target);
      if (gone && phase === 'playing' && target.seen && !target.label) {
        tally.streak = 0;
        floats.push({
          text: 'missed',
          x: target.dir === 1 ? width - 34 : 34,
          y: target.lastY,
          color: COLORS.miss,
          at: time,
        });
      }
      return !gone;
    });

    occlusion += ((condition === 'occlusion' ? 1 : 0) - occlusion) * Math.min(1, dt * 5);
    darkness += ((condition === 'low light' ? 1 : 0) - darkness) * Math.min(1, dt * 4);
    floats = floats.filter((item) => time - item.at < 1.1);
    rejections = rejections.filter((item) => time - item.at < 0.55);
    if (banner && time - banner.at > 2.6) banner = null;
    syncReadout();
  }

  // --- Round ---------------------------------------------------------------

  function setCondition(next: Condition) {
    condition = next;
    if (phase === 'playing') {
      banner = { title: next.toUpperCase(), note: CONDITION_NOTES[next], at: time };
    }
    set('condition', phase === 'playing' ? next : phase === 'over' ? 'Round over' : 'Standby');
  }

  function start() {
    phase = 'playing';
    tally = emptyTally();
    elapsed = 0;
    targets = [];
    floats = [];
    rejections = [];
    drag = null;
    setCondition('clear');
    // Every round opens with a walker: the largest, slowest target.
    spawn('adult', true);
    spawnClock = 1.5;
    root.dataset.phase = phase;
    part('start-panel')?.setAttribute('hidden', '');
    part('results-panel')?.setAttribute('hidden', '');
    set('announce', 'Round started. Drag a box around each moving figure.');
    setRunning(true);
  }

  function finish() {
    phase = 'over';
    drag = null;
    // Targets still crossing when time runs out were never the player's to miss.
    tally.seen -= targets.filter((target) => target.seen && !target.label).length;
    setCondition('clear');
    banner = null;

    const { recall, precision, meanIou } = summarize(tally);
    const rank = rankFor(tally.score);
    const record = tally.score > best;
    if (record) saveBest(tally.score);

    set('final-score', tally.score.toLocaleString('en-US'));
    set('rank', rank.title);
    set('rank-line', rank.line);
    set('stat-labeled', `${tally.hits} of ${tally.seen}`);
    set('stat-recall', `${Math.round(recall * 100)}% recall`);
    set('stat-iou', tally.hits > 0 ? meanIou.toFixed(2) : '0.00');
    set('stat-precision', `${Math.round(precision * 100)}%`);
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
      `Round over. ${tally.score} points. Rank: ${rank.title}. ` +
        `Labeled ${tally.hits} of ${tally.seen} targets.`,
    );
    if (reduceMotion) setRunning(false);
  }

  function showBest() {
    const note = part('best');
    if (!note) return;
    note.toggleAttribute('hidden', best <= 0);
    set('best-value', best.toLocaleString('en-US'));
  }

  function commit(drawn: Box) {
    if (drawn.x1 - drawn.x0 < MIN_BOX || drawn.y1 - drawn.y0 < MIN_BOX) return;
    const open = targets.filter((target) => !target.label && target.box);
    const verdict = judge(
      drawn,
      open.map((target) => target.box!),
    );
    tally.attempts++;

    if (verdict.result === 'hit') {
      const target = open[verdict.index];
      const truth = target.box!;
      const gained = pointsFor(verdict.iou, target.kind, tally.streak, target.depth);
      target.label = {
        iou: verdict.iou,
        inset: {
          x0: drawn.x0 - truth.x0,
          y0: drawn.y0 - truth.y0,
          x1: drawn.x1 - truth.x1,
          y1: drawn.y1 - truth.y1,
        },
        at: time,
      };
      tally.hits++;
      tally.overlap += verdict.iou;
      tally.score += gained;
      tally.streak++;
      tally.bestStreak = Math.max(tally.bestStreak, tally.streak);
      floats.push({
        text: `${verdict.iou >= PERFECT_IOU ? 'Perfect +' : '+'}${gained}`,
        x: (drawn.x0 + drawn.x1) / 2,
        y: Math.max(drawn.y0, HUD_HEIGHT + 20),
        color: COLORS.maize,
        at: time,
      });
    } else {
      tally.streak = 0;
      rejections.push({
        box: drawn,
        text:
          verdict.result === 'loose' ? `IoU ${verdict.iou.toFixed(2)} needs 0.50` : 'nothing here',
        at: time,
      });
    }
    syncReadout();
  }

  function syncReadout() {
    const left = Math.max(0, ROUND_SECONDS - elapsed);
    const playing = phase === 'playing';
    set('score', tally.score.toLocaleString('en-US'));
    set('streak', `×${streakMultiplier(tally.streak).toFixed(1)}`);
    set('time', playing ? `0:${String(Math.ceil(left)).padStart(2, '0')}` : '0:45');
    part('timebar')?.style.setProperty('--left', playing ? (left / ROUND_SECONDS).toFixed(4) : '1');
    root.dataset.score = String(tally.score);
    root.dataset.hits = String(tally.hits);
    root.dataset.attempts = String(tally.attempts);
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

  function drawBanner() {
    if (!banner) return;
    const age = time - banner.at;
    const alpha = clamp(age / 0.25, 0, 1) * clamp((2.6 - age) / 0.5, 0, 1);
    const y = HUD_HEIGHT + (compact ? 26 : 34);
    drawText(banner.title, width / 2, y, COLORS.maize, alpha, compact ? 13 : 15);
    drawText(banner.note, width / 2, y + 20, COLORS.text, alpha * 0.85, compact ? 11 : 12);
  }

  function draw() {
    if (!backdrop || width === 0) return;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.clearRect(0, 0, width, height);
    ctx!.drawImage(backdrop, 0, 0, width, height);
    ctx!.fillStyle = COLORS.ground;
    ctx!.fillRect(0, horizon, width, 1);
    for (let x = step / 2; x < width; x += step * 4) ctx!.fillRect(x, horizon, 1, 4);

    // Far targets first, so nearer ones pass in front of them.
    const light = lerp(1, 0.3, darkness);
    for (const target of [...targets].sort((a, b) => a.depth - b.depth)) {
      paintCells(ctx!, target.cells, step, KINDS[target.kind].color, light);
    }
    drawNoise();
    drawPillars();

    for (const target of targets) {
      if (!target.box) continue;
      const { color, action } = KINDS[target.kind];
      if (target.label) {
        const { inset, iou, at } = target.label;
        const box = {
          x0: target.box.x0 + inset.x0,
          y0: target.box.y0 + inset.y0,
          x1: target.box.x1 + inset.x1,
          y1: target.box.y1 + inset.y1,
        };
        drawBox(box, color, target.kind, `IoU ${iou.toFixed(2)}`, at);
      } else if (phase !== 'playing') {
        // Between rounds a stand-in model labels the scene.
        drawBox(
          target.box,
          color,
          compact ? target.kind : `${target.kind} · ${action}`,
          compact ? '' : target.confidence.toFixed(2),
          -1,
        );
      }
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
    drawBanner();
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
  document.addEventListener('visibilitychange', () => setRunning(true));

  root.groundTruth = () =>
    targets
      .filter((target) => !target.label && target.box)
      .map((target) => ({ kind: target.kind, box: { ...target.box! } }));

  new ResizeObserver(resize).observe(root);
  resize();
  document.fonts?.ready.then(() => {
    fontFamily = getComputedStyle(canvas).fontFamily || fontFamily;
    if (!running) draw();
  });

  showBest();
  setCondition('clear');
  root.dataset.phase = phase;
  root.dataset.ready = '';

  // Open on a scene that is already under way rather than an empty frame.
  for (const kind of ['adult', 'dog', 'bird'] as const) spawn(kind);
  for (let i = 0; i < 150; i++) advance(0.05);
  draw();
  setRunning(true);
}
