/**
 * Hero scene: an operating field drawn as a dot matrix, in which a bypass graft is sewn onto a
 * coronary artery, read four ways. Each reading is work the group has published on surgery and
 * the heart:
 *
 *   hands     articulated hand pose: a box, a side, an identity, and 21 joints for each hand
 *             (Louis et al., IJCARS 2023)
 *   language  the operation put into words: what each thing is, and which step this is
 *             (SurgAtlas, 2026)
 *   surface   the surface of the beating heart, followed as it deforms (Lau et al., MICCAI 2004)
 *   motion    economy of motion: the path of the suturing hand and of the other hand, the
 *             measure planned in the group's study of bypass operations (Likosky et al., 2021)
 *
 * The readings are listed with their papers in src/lib/readings.ts.
 *
 * Everything is procedural and nothing is footage: the cast is in ./scene/operation.ts. A running
 * caption narrates the operation and a strip along the bottom records each gesture of each
 * stitch. Switching readings sweeps a scan line across the frame.
 */

import { type Box, type Figure, type Vec, clamp, easeInOut, lerp } from './scene/geometry';
import {
  GESTURES,
  HAND_KEYPOINTS,
  STITCHES,
  STITCH_SECONDS,
  type Operation,
  beatAt,
  operationAt,
} from './scene/operation';
import { INK, drawChip, drawCorners, paintCells, sample } from './scene/raster';

import { READINGS, type ReadingId } from '../lib/readings';

type Mode = ReadingId;

const MODES: Mode[] = READINGS.map((reading) => reading.id);
const PARTS = [
  'heart',
  'artery',
  'graft',
  'leftSleeve',
  'rightSleeve',
  'left',
  'right',
  'forceps',
  'driver',
] as const;
type PartKey = (typeof PARTS)[number];

const COLORS = {
  heart: '#ff9466',
  artery: '#ff7ab6',
  graft: '#ffcb05',
  hand: '#eef1f6',
  sleeve: '#9fb2c8',
  tool: '#5cc8ff',
  stitch: '#7be495',
  left: '#5cc8ff',
  right: '#ffcb05',
  ink: INK,
  dot: 'rgba(255, 255, 255, 0.11)',
  rule: 'rgba(255, 255, 255, 0.16)',
  text: 'rgba(238, 241, 246, 0.62)',
  scan: '#ffcb05',
};
/** Near is warm, far is cool: a reversed viridis ramp. */
const DEPTH_RAMP = [
  [253, 231, 37],
  [94, 201, 98],
  [33, 145, 140],
  [59, 82, 139],
  [72, 30, 110],
];

const SAMPLE_INTERVAL = 0.1;
const TRAIL_LENGTH = 420;
/** Hands, instruments, and vessels are sampled on a grid twice as fine as the heart's. */
const FINE: readonly PartKey[] = ['artery', 'graft', 'left', 'right', 'forceps', 'driver'];
const MODE_DURATION = 8;
const WIPE_DURATION = 0.95;
/** Height of the controls strip along the top of the viewport, which labels must not cover. */
const HUD_HEIGHT = 46;
const TIMELINE_STRIP = 58;
const COMPACT_STRIP = 98;

function depthColor(depth: number, alpha = 1): string {
  const t = clamp(depth, 0, 1) * (DEPTH_RAMP.length - 1);
  const i = Math.min(Math.floor(t), DEPTH_RAMP.length - 2);
  const [a, b] = [DEPTH_RAMP[i], DEPTH_RAMP[i + 1]];
  const c = a.map((v, k) => Math.round(lerp(v, b[k], t - i)));
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

/** The operation in a sentence. It changes a few times a round, not with every gesture. */
function describe({ progress }: Operation): string {
  if (progress.gesture === null) {
    return 'The graft is open: blood now reaches the heart muscle beyond the blockage.';
  }
  if (progress.stitches < 3) {
    return 'A surgeon sews a bypass graft onto a coronary artery, beyond a blockage.';
  }
  if (progress.stitches < 6) {
    return 'The right hand drives the needle while the left steadies the graft with forceps.';
  }
  return 'The last stitches close the join between the graft and the artery.';
}

export function mountHeroScene(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas');
  const captionEl = root.querySelector<HTMLElement>('[data-caption]');
  const frameEl = root.querySelector<HTMLElement>('[data-frame]');
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-mode]')];
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx || !captionEl) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let step = 10;
  let unit = 5;
  let timelineTop = 0;
  let compact = false;
  let fontFamily = 'monospace';
  let backdrop: HTMLCanvasElement | null = null;

  // Without motion the scene holds one telling moment: the needle part way through a stitch.
  let time = reduceMotion ? 4 * STITCH_SECONDS + 1 : 0;
  let last = 0;
  let frame = 0;
  let running = false;
  let onScreen = true;
  let sampleClock = 0;
  let history: number[] = [];

  let mode: Mode = MODES[0];
  /** The view being wiped away; null when idle. 'off' is the blank screen at boot. */
  let previous: Mode | 'off' | null = reduceMotion ? null : 'off';
  let wipeStart = time;
  let auto = !reduceMotion;
  let modeSince = time;

  let caption = '';
  let captionTarget = '';
  let captionShown = 0;

  const pointer = { x: 0, y: 0, active: false };

  const cells = Object.fromEntries(PARTS.map((key) => [key, [] as number[]])) as Record<
    PartKey,
    number[]
  >;
  const boxes: Partial<Record<PartKey, Box | null>> = {};
  /** Where the tip of each instrument has been, newest last, and how far it has traveled. */
  const trails = { left: [] as Vec[], right: [] as Vec[] };
  const traveled = { left: 0, right: 0 };

  /** Pre-render the resting dot matrix that every view is drawn over. */
  function buildBackdrop() {
    const layer = document.createElement('canvas');
    layer.width = canvas!.width;
    layer.height = canvas!.height;
    const g = layer.getContext('2d')!;
    g.scale(dpr, dpr);
    g.fillStyle = COLORS.dot;
    const size = Math.max(1, step * 0.14);
    for (let y = step / 2; y < timelineTop - 1; y += step) {
      for (let x = step / 2; x < width; x += step) {
        g.fillRect(x - size / 2, y - size / 2, size, size);
      }
    }
    backdrop = layer;
  }

  function resize() {
    const rect = root.getBoundingClientRect();
    width = Math.round(rect.width);
    height = Math.round(rect.height);
    if (width === 0 || height === 0) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas!.width = Math.round(width * dpr);
    canvas!.height = Math.round(height * dpr);
    fontFamily = getComputedStyle(canvas!).fontFamily || 'monospace';

    // Narrow screens trade the timeline for a strip that holds the caption below the scene.
    compact = width < 560;
    timelineTop = height - (compact ? COMPACT_STRIP : TIMELINE_STRIP);
    root.toggleAttribute('data-compact', compact);
    // The field is sized by its height, and by its width where the screen is narrow.
    unit = Math.min(timelineTop / 60, width / 100);
    step = clamp(Math.round(Math.min(width / 118, unit * 2.1)), 5, 11);

    buildBackdrop();
    history = [];
    trails.left = [];
    trails.right = [];
    for (const key of PARTS) boxes[key] = null;
    if (!running) draw();
  }

  const pitchOf = (key: PartKey) => (FINE.includes(key) ? step / 2 : step);

  const figureOf = (scene: Operation, key: PartKey): Figure =>
    key === 'leftSleeve'
      ? scene.left.sleeve
      : key === 'rightSleeve'
        ? scene.right.sleeve
        : scene[key];

  /** A label chip on a box, kept inside the frame and clear of the controls. */
  function chip(text: string, detail: string, box: Box, color: string, alpha = 1) {
    drawChip(ctx!, text, compact ? '' : detail, box, color, alpha, {
      fontFamily,
      fontSize: compact ? 10 : 11,
      width,
      top: HUD_HEIGHT,
    });
  }

  /** A label joined by a thin line to the thing it names. */
  function callout(text: string, anchor: Vec, dx: number, dy: number, color: string) {
    const fontSize = compact ? 10 : 11;
    ctx!.font = `500 ${fontSize}px ${fontFamily}`;
    const w = Math.ceil(ctx!.measureText(text).width + 12);
    const h = fontSize + 7;
    const x = clamp(anchor.x + dx * unit - (dx < 0 ? w : 0), 4, width - w - 4);
    const y = clamp(anchor.y + dy * unit - h / 2, HUD_HEIGHT + 2, timelineTop - h - 4);
    ctx!.strokeStyle = color;
    ctx!.lineWidth = 1;
    ctx!.globalAlpha = 0.8;
    ctx!.beginPath();
    ctx!.moveTo(anchor.x, anchor.y);
    ctx!.lineTo(dx < 0 ? x + w : x, y + h / 2);
    ctx!.stroke();
    ctx!.globalAlpha = 1;
    ctx!.fillStyle = color;
    ctx!.fillRect(anchor.x - 2.5, anchor.y - 2.5, 5, 5);
    ctx!.fillRect(x, y, w, h);
    ctx!.fillStyle = INK;
    ctx!.textBaseline = 'middle';
    ctx!.textAlign = 'left';
    ctx!.fillText(text, x + 6, y + h / 2 + 0.5);
  }

  /** A small plate of readings in the top right corner of the scene. */
  function plate(rows: readonly (readonly [string, string])[]) {
    if (compact) return;
    const fontSize = 11;
    const lineH = fontSize + 8;
    ctx!.font = `500 ${fontSize}px ${fontFamily}`;
    const labelW = Math.max(...rows.map(([label]) => ctx!.measureText(label).width));
    const valueW = Math.max(...rows.map(([, value]) => ctx!.measureText(value).width));
    const w = Math.ceil(labelW + valueW + 34);
    const x = width - w - 14;
    const y = HUD_HEIGHT + 8;
    ctx!.fillStyle = 'rgba(5, 8, 15, 0.82)';
    ctx!.fillRect(x, y, w, rows.length * lineH + 8);
    ctx!.fillStyle = COLORS.scan;
    ctx!.fillRect(x, y, 2, rows.length * lineH + 8);
    ctx!.textBaseline = 'middle';
    rows.forEach(([label, value], i) => {
      const lineY = y + 4 + lineH * (i + 0.5) + 0.5;
      ctx!.textAlign = 'left';
      ctx!.fillStyle = COLORS.text;
      ctx!.fillText(label, x + 12, lineY);
      ctx!.textAlign = 'right';
      ctx!.fillStyle = COLORS.hand;
      ctx!.fillText(value, x + w - 10, lineY);
    });
    ctx!.textAlign = 'left';
  }

  /** Dots swell around the pointer, like a receptive field following the visitor. */
  function drawLens() {
    if (!pointer.active) return;
    const radius = 22 * unit;
    const c0 = Math.max(0, Math.floor((pointer.x - radius) / step));
    const c1 = Math.min(Math.ceil(width / step) - 1, Math.ceil((pointer.x + radius) / step));
    const r0 = Math.max(0, Math.floor((pointer.y - radius) / step));
    const r1 = Math.min(
      Math.floor((timelineTop - 1) / step) - 1,
      Math.ceil((pointer.y + radius) / step),
    );
    ctx!.fillStyle = COLORS.hand;
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const cx = col * step + step / 2;
        const cy = row * step + step / 2;
        const d = Math.hypot(cx - pointer.x, cy - pointer.y) / radius;
        if (d >= 1) continue;
        const falloff = (1 - d) * (1 - d);
        const ripple = 0.75 + 0.25 * Math.sin(d * 14 - time * 6);
        const size = step * (0.14 + 0.34 * falloff * ripple);
        ctx!.globalAlpha = 0.42 * falloff * ripple;
        ctx!.fillRect(cx - size / 2, cy - size / 2, size, size);
      }
    }
    ctx!.globalAlpha = 1;
  }

  /** The heart as a lit dome: its dots grow and brighten toward the middle, and thin at the rim. */
  function drawHeart(scene: Operation) {
    const dots = cells.heart;
    ctx!.fillStyle = COLORS.heart;
    for (let i = 0; i < dots.length; i += 3) {
      const cover = dots[i + 2];
      const inside = clamp(-scene.heart.sdf(dots[i], dots[i + 1]) / (26 * unit), 0, 1);
      const size = step * (0.16 + 0.26 * Math.sqrt(inside)) * (0.4 + 0.6 * cover);
      ctx!.globalAlpha = (0.3 + 0.4 * inside) * cover;
      ctx!.fillRect(dots[i] - size / 2, dots[i + 1] - size / 2, size, size);
    }
    ctx!.globalAlpha = 1;
  }

  /** The heart as a surface: every dot colored by its height, under a mesh that moves with it. */
  function drawSurface(scene: Operation) {
    const dots = cells.heart;
    for (let i = 0; i < dots.length; i += 3) {
      const cover = dots[i + 2];
      if (cover < 0.3) continue;
      // The heart is a dome: the deeper inside its outline, the nearer the camera.
      const inside = clamp(-scene.heart.sdf(dots[i], dots[i + 1]) / (20 * unit), 0, 1);
      const size = step * (0.34 + 0.5 * cover);
      ctx!.fillStyle = depthColor(1 - Math.sqrt(inside), 0.4 + 0.5 * cover);
      ctx!.fillRect(dots[i] - size / 2, dots[i + 1] - size / 2, size, size);
    }

    // The tracked mesh. Each knot is pulled toward the center as the heart contracts.
    const beat = beatAt(time);
    const pitch = 7 * unit;
    const knot = (i: number, j: number): Vec | null => {
      const rest = { x: scene.center.x + i * pitch, y: scene.center.y + (j + 0.4) * pitch };
      if (scene.heart.sdf(rest.x, rest.y) > -1.5 * unit) return null;
      const pull = 1 - 0.07 * beat * (0.5 + 0.5 * Math.sin(i * 1.7 + j * 2.3));
      return {
        x: scene.center.x + (rest.x - scene.center.x) * pull,
        y: scene.center.y + (rest.y - scene.center.y) * pull,
      };
    };
    ctx!.strokeStyle = COLORS.hand;
    ctx!.fillStyle = COLORS.hand;
    ctx!.lineWidth = 1;
    for (let j = -5; j <= 5; j++) {
      for (let i = -4; i <= 4; i++) {
        const here = knot(i, j);
        if (!here) continue;
        ctx!.globalAlpha = 0.5;
        for (const there of [knot(i + 1, j), knot(i, j + 1)]) {
          if (!there) continue;
          ctx!.beginPath();
          ctx!.moveTo(here.x, here.y);
          ctx!.lineTo(there.x, there.y);
          ctx!.stroke();
        }
        ctx!.globalAlpha = 0.95;
        ctx!.fillRect(here.x - 1.5, here.y - 1.5, 3, 3);
      }
    }
    ctx!.globalAlpha = 1;
  }

  /** Finished stitches round the join, the suture being drawn through, and the needle. */
  function drawSewing(scene: Operation, opacity: number) {
    const { site, ring, progress, thread, driver } = scene;
    ctx!.lineCap = 'round';
    // The join itself: the opening where the graft meets the artery.
    ctx!.strokeStyle = COLORS.graft;
    ctx!.lineWidth = 1.5;
    ctx!.globalAlpha = 0.9 * opacity;
    ctx!.beginPath();
    ring.forEach((point, k) =>
      k === 0 ? ctx!.moveTo(point.x, point.y) : ctx!.lineTo(point.x, point.y),
    );
    ctx!.closePath();
    ctx!.stroke();
    // Each finished stitch is a short tick across its edge.
    ctx!.strokeStyle = COLORS.stitch;
    ctx!.lineWidth = Math.max(2, unit * 0.34);
    ctx!.globalAlpha = opacity;
    ctx!.beginPath();
    ring.slice(0, progress.stitches).forEach((stitch) => {
      const dx = (stitch.x - site.x) * 0.3;
      const dy = (stitch.y - site.y) * 0.3;
      ctx!.moveTo(stitch.x - dx, stitch.y - dy);
      ctx!.lineTo(stitch.x + dx, stitch.y + dy);
    });
    ctx!.stroke();

    if (thread) {
      ctx!.strokeStyle = COLORS.hand;
      ctx!.lineWidth = 1;
      ctx!.globalAlpha = 0.85 * opacity;
      ctx!.beginPath();
      ctx!.moveTo(thread[0].x, thread[0].y);
      ctx!.lineTo(thread[1].x, thread[1].y);
      ctx!.stroke();
    }
    if (progress.gesture !== null) {
      // The curved needle at the jaws of the driver.
      const turn = Math.atan2(driver.tip.y - site.y, driver.tip.x - site.x);
      ctx!.strokeStyle = COLORS.hand;
      ctx!.lineWidth = 1.5;
      ctx!.globalAlpha = opacity;
      ctx!.beginPath();
      ctx!.arc(driver.tip.x, driver.tip.y, 1.7 * unit, turn + 0.6, turn + 3.4);
      ctx!.stroke();
    }
    ctx!.lineCap = 'butt';
    ctx!.globalAlpha = 1;
  }

  /** Blood running down the finished graft and on along the artery. */
  function drawFlow({ route, progress }: Operation) {
    if (progress.flow <= 0) return;
    const lengths = route.slice(1).map((p, i) => Math.hypot(p.x - route[i].x, p.y - route[i].y));
    const total = lengths.reduce((sum, length) => sum + length, 0);
    const at = (share: number): Vec => {
      let left = share * total;
      for (let i = 0; i < lengths.length; i++) {
        if (left <= lengths[i]) {
          const t = left / lengths[i];
          return { x: lerp(route[i].x, route[i + 1].x, t), y: lerp(route[i].y, route[i + 1].y, t) };
        }
        left -= lengths[i];
      }
      return route[route.length - 1];
    };
    const front = Math.min(1, progress.flow * 2.4);
    const size = step * 0.72;
    ctx!.fillStyle = COLORS.hand;
    for (let share = (time * 0.35) % 0.07; share < front; share += 0.07) {
      const p = at(share);
      ctx!.globalAlpha = 0.95 * (1 - clamp((progress.flow - 0.86) / 0.14, 0, 1));
      ctx!.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    }
    ctx!.globalAlpha = 1;
  }

  /** The skeleton of a hand: its bones, and a dot on each of its 21 keypoints. */
  function drawHand(scene: Operation, side: 'left' | 'right') {
    const hand = scene[side];
    const color = COLORS[side];
    ctx!.strokeStyle = color;
    ctx!.lineWidth = 2;
    ctx!.lineCap = 'round';
    ctx!.beginPath();
    for (const [ax, ay, bx, by] of hand.bones) {
      ctx!.moveTo(ax, ay);
      ctx!.lineTo(bx, by);
    }
    ctx!.stroke();
    ctx!.lineCap = 'butt';
    const r = clamp(unit * 0.62, 2, 3.5);
    ctx!.fillStyle = COLORS.hand;
    ctx!.lineWidth = 1.5;
    for (const joint of hand.joints) {
      ctx!.beginPath();
      ctx!.arc(joint.x, joint.y, r, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.stroke();
    }
    const box = boxes[side];
    if (box) {
      const w = box.x1 - box.x0;
      const h = box.y1 - box.y0;
      drawCorners(ctx!, Math.round(box.x0) + 0.5, Math.round(box.y0) + 0.5, w, h);
      chip(
        `${side} hand`,
        `id ${side === 'left' ? 1 : 2} \u00b7 ${HAND_KEYPOINTS} joints`,
        box,
        color,
      );
    }
  }

  /** Where the tip of an instrument has been: a line that fades with age. */
  function drawTrail(trail: Vec[], color: string) {
    ctx!.strokeStyle = color;
    ctx!.lineWidth = 1.5;
    for (let i = 1; i < trail.length; i++) {
      ctx!.globalAlpha = (i / trail.length) * 0.85;
      ctx!.beginPath();
      ctx!.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx!.lineTo(trail[i].x, trail[i].y);
      ctx!.stroke();
    }
    ctx!.globalAlpha = 1;
  }

  /** Paint one complete reading of the scene. */
  function renderView(view: Mode | 'off', scene: Operation) {
    if (backdrop) ctx!.drawImage(backdrop, 0, 0, width, height);
    if (view === 'off') return;
    drawLens();

    if (view === 'surface') drawSurface(scene);
    else drawHeart(scene);
    paintCells(ctx!, cells.artery, step / 2, COLORS.artery, view === 'surface' ? 0.55 : 1);
    paintCells(ctx!, cells.graft, step / 2, COLORS.graft, view === 'surface' ? 0.55 : 1);
    drawFlow(scene);
    drawSewing(scene, view === 'surface' ? 0.4 : 1);

    // Hands and instruments step back where the reading is not about them.
    const hands = view === 'surface' ? 0.13 : view === 'hands' ? 0.34 : 1;
    const tools = view === 'surface' ? 0.13 : view === 'hands' ? 0.5 : 1;
    for (const key of ['leftSleeve', 'rightSleeve'] as const) {
      paintCells(ctx!, cells[key], step, COLORS.sleeve, 0.3 * hands);
    }
    for (const key of ['left', 'right'] as const)
      paintCells(ctx!, cells[key], step / 2, COLORS.hand, hands);
    for (const key of ['forceps', 'driver'] as const) {
      paintCells(ctx!, cells[key], step / 2, COLORS.tool, tools);
    }

    const { stitches, gesture } = scene.progress;
    const count = `${Math.min(stitches + (gesture ? 1 : 0), STITCHES)} of ${STITCHES}`;
    if (view === 'hands') {
      drawHand(scene, 'left');
      drawHand(scene, 'right');
    } else if (view === 'language') {
      callout('graft', scene.graft.path[9], 8, -5, COLORS.graft);
      callout('coronary artery', scene.artery.path[8], 6, 7, COLORS.artery);
      callout('blockage', scene.blockage, -6, 9, COLORS.hand);
      callout('needle driver', scene.driver.middle, 7, -9, COLORS.tool);
      callout('forceps', scene.forceps.middle, -7, -8, COLORS.tool);
      plate([
        ['step', gesture ? 'sew graft to artery' : 'check the flow'],
        ['stitch', gesture ? count : 'done'],
      ]);
    } else if (view === 'surface') {
      const box = boxes.heart;
      if (box) {
        const top = Math.max(box.y0, HUD_HEIGHT + 6);
        const bottom = Math.min(box.y1, timelineTop - 8);
        ctx!.strokeStyle = COLORS.hand;
        drawCorners(
          ctx!,
          Math.round(box.x0) + 0.5,
          Math.round(top) + 0.5,
          box.x1 - box.x0,
          bottom - top,
        );
        // The label hangs under the top edge, where there is always room for it.
        chip('heart surface', '66 beats a minute', { ...box, y0: 0, y1: top + 6 }, COLORS.hand);
      }
    } else {
      drawTrail(trails.left, COLORS.left);
      drawTrail(trails.right, COLORS.right);
      const share = traveled.left + traveled.right || 1;
      plate([
        ['stitches', gesture ? count : `${STITCHES} of ${STITCHES}`],
        ['time a stitch', `${STITCH_SECONDS.toFixed(1)} s`],
        ['suturing hand path', `${Math.round((traveled.right / share) * 100)}%`],
        ['other hand path', `${Math.round((traveled.left / share) * 100)}%`],
      ]);
    }
    ctx!.globalAlpha = 1;
  }

  /** Rolling timeline of the sewing hand's gestures: the right edge is now. */
  function drawTimeline() {
    const top = timelineTop;
    ctx!.fillStyle = COLORS.ink;
    ctx!.fillRect(0, top, width, height - top);
    ctx!.fillStyle = COLORS.rule;
    ctx!.fillRect(0, top, width, 1);
    if (compact) return;

    const gutter = 78;
    const rowH = 5;
    const rows = GESTURES.length;
    const gap = (height - top - 14 - rowH * rows) / (rows - 1);
    const cell = 3;
    const columns = Math.floor((width - gutter - 14) / cell);
    if (history.length > columns) history = history.slice(history.length - columns);

    ctx!.font = `500 9px ${fontFamily}`;
    ctx!.textBaseline = 'middle';
    ctx!.textAlign = 'left';
    GESTURES.forEach((gesture, row) => {
      const y = top + 8 + row * (rowH + gap);
      ctx!.fillStyle = COLORS.text;
      ctx!.fillText(gesture.toUpperCase(), 14, y + rowH / 2 + 0.5);
      ctx!.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx!.fillRect(gutter, y, columns * cell, rowH);
      ctx!.fillStyle = [COLORS.tool, COLORS.graft, COLORS.artery, COLORS.stitch][row];
      const offset = columns - history.length;
      let runStart = -1;
      for (let i = 0; i <= history.length; i++) {
        const on = i < history.length && (history[i] & (1 << row)) !== 0;
        if (on && runStart < 0) runStart = i;
        if (!on && runStart >= 0) {
          ctx!.fillRect(gutter + (offset + runStart) * cell, y, (i - runStart) * cell, rowH);
          runStart = -1;
        }
      }
    });
    ctx!.fillStyle = COLORS.hand;
    ctx!.fillRect(gutter + columns * cell, top + 5, 1, height - top - 10);
  }

  function draw(): Operation | undefined {
    if (!backdrop || width === 0) return undefined;
    const scene = operationAt(time, width, timelineTop, unit);
    for (const key of PARTS) {
      const grid = { step: pitchOf(key), width, bottom: timelineTop };
      const measured = sample(figureOf(scene, key), grid, cells[key]);
      const box = boxes[key];
      boxes[key] =
        measured && box
          ? {
              x0: lerp(box.x0, measured.x0, 0.4),
              y0: lerp(box.y0, measured.y0, 0.4),
              x1: lerp(box.x1, measured.x1, 0.4),
              y1: lerp(box.y1, measured.y1, 0.4),
            }
          : measured;
    }
    root.dataset.stitch = String(scene.progress.stitches);

    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.clearRect(0, 0, width, height);

    const progress = previous === null ? 1 : clamp((time - wipeStart) / WIPE_DURATION, 0, 1);
    if (previous === null || progress >= 1) {
      previous = null;
      renderView(mode, scene);
    } else {
      // A scan line sweeps across: the new reading behind it, the old one ahead.
      const edge = lerp(-40, width + 40, easeInOut(progress));
      const halves: [Mode | 'off', number, number][] = [
        [mode, 0, edge],
        [previous, edge, width],
      ];
      for (const [view, x0, x1] of halves) {
        if (x1 <= x0) continue;
        ctx!.save();
        ctx!.beginPath();
        ctx!.rect(x0, 0, x1 - x0, timelineTop);
        ctx!.clip();
        renderView(view, scene);
        ctx!.restore();
      }
      const glow = ctx!.createLinearGradient(edge - 90, 0, edge, 0);
      glow.addColorStop(0, 'rgba(255, 203, 5, 0)');
      glow.addColorStop(1, 'rgba(255, 203, 5, 0.22)');
      ctx!.fillStyle = glow;
      ctx!.fillRect(edge - 90, 0, 90, timelineTop);
      ctx!.fillStyle = COLORS.scan;
      ctx!.fillRect(edge - 1, 0, 2, timelineTop);
    }

    drawTimeline();
    updateCaption(scene);
    return scene;
  }

  function updateCaption(scene: Operation) {
    const next = describe(scene);
    if (reduceMotion) {
      if (caption !== next) captionEl!.textContent = caption = next;
      return;
    }
    if (next === captionTarget) return;
    // Keep what the two sentences share, and type the rest.
    let shared = 0;
    while (
      shared < captionShown &&
      shared < next.length &&
      next[shared] === captionTarget[shared]
    ) {
      shared++;
    }
    captionTarget = next;
    captionShown = shared;
  }

  function setMode(next: Mode, byUser: boolean) {
    if (byUser) auto = false;
    if (next !== mode) {
      previous = reduceMotion ? null : mode;
      mode = next;
      wipeStart = time;
    }
    modeSince = time;
    root.dataset.view = mode;
    for (const tab of tabs) {
      const active = tab.dataset.mode === mode;
      tab.setAttribute('aria-pressed', String(active));
      tab.style.setProperty('--progress', active && !auto ? '1' : '0');
    }
    document.dispatchEvent(new CustomEvent('hero-scene:view', { detail: mode }));
    if (!running) draw();
  }

  function tick(now: number) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;
    frame++;

    if (auto) {
      const elapsed = time - modeSince;
      const active = tabs.find((tab) => tab.dataset.mode === mode);
      active?.style.setProperty('--progress', clamp(elapsed / MODE_DURATION, 0, 1).toFixed(3));
      if (elapsed >= MODE_DURATION) setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length], false);
    }

    const scene = draw();

    if (scene) {
      sampleClock += dt;
      if (sampleClock >= SAMPLE_INTERVAL) {
        sampleClock -= SAMPLE_INTERVAL;
        const { gesture } = scene.progress;
        history.push(gesture ? 1 << GESTURES.indexOf(gesture) : 0);
      }
      for (const [side, tip] of [
        ['left', scene.forceps.tip],
        ['right', scene.driver.tip],
      ] as const) {
        const trail = trails[side];
        const before = trail[trail.length - 1];
        if (before) traveled[side] += Math.hypot(tip.x - before.x, tip.y - before.y) / unit;
        trail.push(tip);
        if (trail.length > TRAIL_LENGTH) trail.shift();
      }
    }

    if (captionShown < captionTarget.length) {
      captionShown = Math.min(captionTarget.length, captionShown + dt * 46);
    }
    const text = captionTarget.slice(0, Math.floor(captionShown));
    if (text !== caption) captionEl!.textContent = caption = text;

    if (frameEl && frame % 3 === 0) {
      frameEl.textContent = String(Math.floor(time * 30)).padStart(6, '0');
    }
    requestAnimationFrame(tick);
  }

  function setRunning(next: boolean) {
    if (reduceMotion || next === running) return;
    running = next;
    if (running) {
      last = performance.now();
      requestAnimationFrame(tick);
    }
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => setMode(tab.dataset.mode as Mode, true));
  }
  root.dataset.view = mode;
  root.dataset.keypoints = String(HAND_KEYPOINTS * 2);

  new ResizeObserver(resize).observe(root);
  resize();
  document.fonts?.ready.then(() => {
    fontFamily = getComputedStyle(canvas).fontFamily || fontFamily;
    if (!running) draw();
  });

  if (reduceMotion) return;

  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    setRunning(onScreen && !document.hidden);
  }).observe(root);
  document.addEventListener('visibilitychange', () => setRunning(onScreen && !document.hidden));

  root.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const rect = root.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    // The HUD strip at the top and the timeline at the bottom are not part of the scene.
    pointer.active = pointer.y > HUD_HEIGHT && pointer.y < timelineTop - unit * 4;
  });
  root.addEventListener('pointerleave', () => {
    pointer.active = false;
  });
}
