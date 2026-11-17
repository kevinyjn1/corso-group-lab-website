/**
 * Hero scene: a synthetic "video" rendered as a dot matrix, re-read four ways
 * the way the group's research reads real video - detection and tracking,
 * segmentation, pose, and depth - with a running caption and activity timeline.
 *
 * Everything is procedural. Actors are signed distance functions sampled on a
 * grid; boxes are fitted to the dots each actor actually covers, so they
 * tighten, loosen, and clip at the frame edge the way real detections do.
 * Switching modes sweeps a scan line across the frame.
 */

import {
  BALL_RADIUS,
  FIGURE_COLORS,
  type Figure,
  bouncingBall,
  flyingBird,
  runningDog,
  walkingAdult,
} from './scene/figures';
import { type Box, type Vec, circle, clamp, easeInOut, easeOut, lerp } from './scene/geometry';
import { FOUND_EVENT, FOUND_KEY } from './easter-egg';
import { INK, drawChip, drawCorners, sample } from './scene/raster';

type Mode = 'detect' | 'segment' | 'pose' | 'depth';

interface Actor extends Figure {
  key: string;
  name: string;
  action: string;
  color: string;
  /** Distance from the camera in meters, for the depth view. */
  meters: number;
  /** Dots covered this frame, as flat [x, y, coverage] triples. */
  cells: number[];
  /** Smoothed detection box, or null while the actor is out of frame. */
  box: Box | null;
  /** Scene time at which the current detection first appeared. */
  acquiredAt: number;
  confidence: number;
  trail: Vec[];
}

const MODES: Mode[] = ['detect', 'segment', 'pose', 'depth'];
const ACTOR_KEYS = ['adult', 'dog', 'ball', 'bird', 'visitor'] as const;
const TIMELINE_ROWS = ['adult', 'dog', 'ball', 'bird'] as const;

const COLORS = {
  ...FIGURE_COLORS,
  visitor: '#eef1f6',
  ink: INK,
  dot: 'rgba(255, 255, 255, 0.11)',
  ground: 'rgba(255, 255, 255, 0.16)',
  text: 'rgba(238, 241, 246, 0.62)',
  scan: '#ffcb05',
};
const ACTIONS: Record<string, string> = {
  adult: 'walking',
  dog: 'running',
  ball: 'bouncing',
  bird: 'flying',
  visitor: 'watching',
};
const METERS: Record<string, number> = {
  adult: 4.2,
  dog: 2.9,
  ball: 2.6,
  bird: 11.5,
  visitor: 0.6,
};
const FAR = 14;

/** Near is warm, far is cool: a reversed viridis ramp. */
const DEPTH_RAMP = [
  [253, 231, 37],
  [94, 201, 98],
  [33, 145, 140],
  [59, 82, 139],
  [72, 30, 110],
];

const SAMPLE_INTERVAL = 0.1;
const TRAIL_LENGTH = 36;
const MODE_DURATION = 7;
const WIPE_DURATION = 0.95;
/** Height of the controls strip along the top of the viewport, which labels must not cover. */
const HUD_HEIGHT = 46;
const TIMELINE_STRIP = 58;
const COMPACT_STRIP = 98;

function depthColor(meters: number, alpha = 1): string {
  const t = clamp(meters / FAR, 0, 1) * (DEPTH_RAMP.length - 1);
  const i = Math.min(Math.floor(t), DEPTH_RAMP.length - 2);
  const [a, b] = [DEPTH_RAMP[i], DEPTH_RAMP[i + 1]];
  const c = a.map((v, k) => Math.round(lerp(v, b[k], t - i)));
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

/** Back-and-forth traversal of the frame with a pause off-screen between passes. */
function traverse(
  t: number,
  speed: number,
  span: number,
  pause: number,
  margin: number,
  width: number,
) {
  const pass = span / speed + pause;
  const index = Math.floor(t / pass);
  const dir = index % 2 === 0 ? 1 : -1;
  const dist = Math.min((t - index * pass) * speed, span);
  const x = dir === 1 ? -margin + dist : width + margin - dist;
  return { x, dir, dist };
}

function describe(visible: Set<string>): string {
  const parts: string[] = [];
  if (visible.has('dog') && visible.has('ball')) parts.push('a dog chases a bouncing ball');
  else if (visible.has('dog')) parts.push('a dog runs across the frame');
  else if (visible.has('ball')) parts.push('a ball bounces across the frame');
  if (visible.has('adult')) parts.push('an adult walks by');
  if (visible.has('bird')) parts.push('a bird flies overhead');
  if (visible.has('visitor')) parts.push('a visitor looks on');
  if (parts.length === 0) return 'The scene is empty.';
  let sentence = parts[0];
  if (parts.length === 2) sentence += ` while ${parts[1]}`;
  if (parts.length > 2) {
    sentence += `, ${parts.slice(1, -1).join(', ')}, and ${parts[parts.length - 1]}`;
  }
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

export function mountHeroScene(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas');
  const captionEl = root.querySelector<HTMLElement>('[data-caption]');
  const frameEl = root.querySelector<HTMLElement>('[data-frame]');
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-mode]')];
  const playLink = root.querySelector<HTMLElement>('[data-play]');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx || !captionEl) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let step = 10;
  let unit = 5;
  let ground = 0;
  let timelineTop = 0;
  let compact = false;
  let fontFamily = 'monospace';
  const backdrops: Partial<Record<Mode, HTMLCanvasElement>> = {};

  let time = reduceMotion ? 7.4 : 2.5;
  let last = 0;
  let frame = 0;
  let running = false;
  let onScreen = true;
  let sampleClock = 0;
  let confidenceClock = 0;
  let history: number[] = [];

  let mode: Mode = 'detect';
  /** The view being wiped away; null when idle. 'off' is the blank screen at boot. */
  let previous: Mode | 'off' | null = reduceMotion ? null : 'off';
  let wipeStart = time;
  let auto = !reduceMotion;
  let modeSince = time;

  let caption = '';
  let captionTarget = '';
  let captionShown = 0;
  let pendingCaption = '';
  let pendingSince = 0;

  const pointer = { x: 0, y: 0, active: false };
  /** Views the visitor has picked by hand. */
  const chosen = new Set<Mode>();

  const actors: Actor[] = ACTOR_KEYS.map((key) => ({
    key,
    name: key,
    action: ACTIONS[key],
    color: COLORS[key],
    meters: METERS[key],
    sdf: () => 1,
    bounds: { x0: 0, y0: 0, x1: -1, y1: -1 },
    bones: [],
    cells: [],
    box: null,
    acquiredAt: 0,
    confidence: 0.97,
    trail: [],
  }));
  const byKey = Object.fromEntries(actors.map((a) => [a.key, a])) as Record<string, Actor>;

  /** Pre-render the static part of each view: the dot matrix and its tinting. */
  function buildBackdrops() {
    for (const view of ['detect', 'segment', 'depth'] as const) {
      const layer = document.createElement('canvas');
      layer.width = canvas!.width;
      layer.height = canvas!.height;
      const g = layer.getContext('2d')!;
      g.scale(dpr, dpr);
      for (let y = step / 2; y < timelineTop - 1; y += step) {
        const floor = y > ground;
        for (let x = step / 2; x < width; x += step) {
          let size = Math.max(1, step * 0.14);
          if (view === 'detect') {
            g.fillStyle = COLORS.dot;
          } else if (view === 'segment') {
            size = step - 1;
            g.fillStyle = floor ? 'rgba(183, 156, 255, 0.2)' : 'rgba(92, 200, 255, 0.055)';
          } else {
            const meters = floor ? lerp(5.5, 0.8, (y - ground) / (timelineTop - ground)) : FAR;
            size = step * (floor ? 0.58 : 0.34);
            g.fillStyle = depthColor(meters, floor ? 0.8 : 0.5);
          }
          g.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }
      backdrops[view] = layer;
    }
    backdrops.pose = backdrops.detect;
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
    unit = timelineTop / 100;
    step = clamp(Math.round(Math.min(width / 118, unit * 2.1)), 5, 11);
    ground = Math.round((timelineTop * 0.86) / step) * step;

    buildBackdrops();
    history = [];
    for (const actor of actors) {
      actor.box = null;
      actor.trail = [];
    }
    if (!running) draw();
  }

  /** Position every actor for the current time and define its silhouette and skeleton. */
  function pose() {
    const u = unit;
    const margin = 26 * u;
    const span = width + 2 * margin;

    // Adult, walking.
    {
      const { x, dir, dist } = traverse(time + 9, 8.5 * u, span, 5, margin, width);
      Object.assign(byKey.adult, walkingAdult(x, dir, dist, ground, u));
    }

    // Dog, running after the ball.
    const chase = traverse(time, 25 * u, span + 18 * u, 3.5, margin + 18 * u, width);
    Object.assign(byKey.dog, runningDog(chase.x, chase.dir, chase.dist, ground, u));

    // Ball, bouncing just ahead of the dog.
    {
      const x = chase.x + chase.dir * 27 * u;
      const bounce = Math.abs(Math.sin(chase.dist / (8.5 * u))) * 10.5 * u;
      Object.assign(byKey.ball, bouncingBall(x, ground - BALL_RADIUS * u - bounce, chase.dir, u));
    }

    // Bird, flying.
    {
      const { x, dir, dist } = traverse(time + 4, 15 * u, span, 6, margin, width);
      const y = 24 * u + Math.sin(dist / (26 * u)) * 7 * u;
      Object.assign(byKey.bird, flyingBird(x, y, dir, time * 9, u));
    }

    // The visitor: whoever is moving a pointer over the scene.
    {
      const a = byKey.visitor;
      const r = 3.6 * u;
      const { x, y } = pointer;
      a.bones = [];
      a.bounds = pointer.active
        ? { x0: x - r - u, y0: y - r - u, x1: x + r + u, y1: y + r + u }
        : { x0: 0, y0: 0, x1: -1, y1: -1 };
      a.sdf = (px, py) => circle(px, py, x, y, r);
    }
  }

  /** Sample an actor on the grid; record covered dots and return the box around them. */
  const measure = (actor: Actor) =>
    sample(actor, { step, width, bottom: timelineTop }, actor.cells);

  function drawDots(actor: Actor, view: Mode) {
    const { cells } = actor;
    ctx!.fillStyle = view === 'depth' ? depthColor(actor.meters) : actor.color;
    for (let i = 0; i < cells.length; i += 3) {
      const cover = cells[i + 2];
      let size = step * (0.2 + 0.62 * cover);
      let alpha = 0.35 + 0.65 * cover;
      if (view === 'segment') {
        if (cover < 0.35) continue;
        size = step - 1;
        alpha = 0.95;
      } else if (view === 'pose') {
        alpha *= 0.3;
      } else if (view === 'depth') {
        size = step * (0.3 + 0.62 * cover);
      }
      ctx!.globalAlpha = alpha;
      ctx!.fillRect(cells[i] - size / 2, cells[i + 1] - size / 2, size, size);
    }
    ctx!.globalAlpha = 1;
  }

  /** A label chip above a box, kept inside the frame and clear of the controls. */
  function chip(text: string, detail: string, box: Box, color: string, alpha: number) {
    drawChip(ctx!, text, compact ? '' : detail, box, color, alpha, {
      fontFamily,
      fontSize: compact ? 10 : 11,
      width,
      top: HUD_HEIGHT,
    });
  }

  function drawOverlay(actor: Actor, view: Mode) {
    if (!actor.box) return;
    // A fresh detection snaps in from a looser box.
    const lock = reduceMotion ? 1 : easeOut(clamp((time - actor.acquiredAt) / 0.4, 0, 1));
    const grow = (1 - lock) * 0.55;
    const bw = actor.box.x1 - actor.box.x0;
    const bh = actor.box.y1 - actor.box.y0;
    const x = Math.round(actor.box.x0 - (bw * grow) / 2) + 0.5;
    const y = Math.round(actor.box.y0 - (bh * grow) / 2) + 0.5;
    const w = Math.round(bw * (1 + grow));
    const h = Math.round(bh * (1 + grow));
    const outer: Box = { x0: x - 0.5, y0: y - 0.5, x1: x + w, y1: y + h };
    const color = view === 'depth' ? depthColor(actor.meters) : actor.color;
    ctx!.strokeStyle = color;

    if (view === 'detect') {
      if (actor.trail.length > 1) {
        ctx!.lineWidth = 1;
        for (let i = 1; i < actor.trail.length; i++) {
          ctx!.globalAlpha = (i / actor.trail.length) * 0.4;
          ctx!.beginPath();
          ctx!.moveTo(actor.trail[i - 1].x, actor.trail[i - 1].y);
          ctx!.lineTo(actor.trail[i].x, actor.trail[i].y);
          ctx!.stroke();
        }
      }
      ctx!.globalAlpha = 0.55 * lock;
      ctx!.lineWidth = 1;
      ctx!.strokeRect(x, y, w, h);
      ctx!.globalAlpha = lock;
      drawCorners(ctx!, x, y, w, h);
      const label = compact ? actor.name : `${actor.name} \u00b7 ${actor.action}`;
      chip(label, actor.confidence.toFixed(2), outer, color, lock);
      return;
    }

    if (view === 'segment') {
      ctx!.globalAlpha = lock;
      drawCorners(ctx!, x, y, w, h);
      chip(actor.name, `IoU ${(actor.confidence - 0.04).toFixed(2)}`, outer, color, lock);
      return;
    }

    if (view === 'pose') {
      ctx!.globalAlpha = lock;
      ctx!.lineWidth = 2;
      ctx!.lineCap = 'round';
      ctx!.beginPath();
      for (const [ax, ay, bx, by] of actor.bones) {
        ctx!.moveTo(ax, ay);
        ctx!.lineTo(bx, by);
      }
      ctx!.stroke();
      ctx!.lineCap = 'butt';
      const r = clamp(unit * 0.62, 2, 3.5);
      const joints = new Map<string, Vec>();
      for (const [ax, ay, bx, by] of actor.bones) {
        joints.set(`${ax},${ay}`, { x: ax, y: ay });
        joints.set(`${bx},${by}`, { x: bx, y: by });
      }
      ctx!.fillStyle = COLORS.visitor;
      ctx!.lineWidth = 1.5;
      for (const joint of joints.values()) {
        ctx!.beginPath();
        ctx!.arc(joint.x, joint.y, r, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.stroke();
      }
      const detail =
        actor.key === 'ball' ? 'velocity' : joints.size > 0 ? `${joints.size} keypoints` : '';
      chip(actor.name, detail, outer, color, lock);
      return;
    }

    ctx!.globalAlpha = 0.5 * lock;
    ctx!.lineWidth = 1;
    ctx!.setLineDash([3, 3]);
    ctx!.strokeRect(x, y, w, h);
    ctx!.setLineDash([]);
    chip(actor.name, `${actor.meters.toFixed(1)} m`, outer, color, lock);
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
    ctx!.fillStyle = COLORS.visitor;
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

  /** Paint one complete reading of the scene. */
  function renderView(view: Mode | 'off') {
    const backdrop = backdrops[view === 'off' ? 'detect' : view];
    if (backdrop) ctx!.drawImage(backdrop, 0, 0, width, height);
    if (view === 'off') return;

    if (view === 'detect' || view === 'pose') {
      ctx!.fillStyle = COLORS.ground;
      ctx!.fillRect(0, ground, width, 1);
      for (let x = step / 2; x < width; x += step * 4) ctx!.fillRect(x, ground, 1, 4);
    }

    drawLens();
    for (const actor of actors) drawDots(actor, view);
    for (const actor of actors) drawOverlay(actor, view);
    ctx!.globalAlpha = 1;
  }

  /** Rolling per-actor activity timeline: the right edge is now. */
  function drawTimeline() {
    const top = timelineTop;
    ctx!.fillStyle = COLORS.ink;
    ctx!.fillRect(0, top, width, height - top);
    ctx!.fillStyle = COLORS.ground;
    ctx!.fillRect(0, top, width, 1);
    if (compact) return;

    const gutter = 64;
    const rowH = 5;
    const rows = TIMELINE_ROWS.length;
    const gap = (height - top - 14 - rowH * rows) / (rows - 1);
    const cell = 3;
    const columns = Math.floor((width - gutter - 14) / cell);
    if (history.length > columns) history = history.slice(history.length - columns);

    ctx!.font = `500 9px ${fontFamily}`;
    ctx!.textBaseline = 'middle';
    ctx!.textAlign = 'left';
    TIMELINE_ROWS.forEach((key, row) => {
      const y = top + 8 + row * (rowH + gap);
      ctx!.fillStyle = COLORS.text;
      ctx!.fillText(key.toUpperCase(), 14, y + rowH / 2 + 0.5);
      ctx!.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx!.fillRect(gutter, y, columns * cell, rowH);
      ctx!.fillStyle = byKey[key].color;
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
    ctx!.fillStyle = COLORS.visitor;
    ctx!.fillRect(gutter + columns * cell, top + 5, 1, height - top - 10);
  }

  function draw(): Set<string> | undefined {
    if (!backdrops.detect || width === 0) return undefined;
    pose();

    const visible = new Set<string>();
    for (const actor of actors) {
      const measured = measure(actor);
      if (!measured) {
        actor.box = null;
        actor.trail = [];
        continue;
      }
      if (!actor.box) actor.acquiredAt = time;
      const k = actor.box ? 0.4 : 1;
      actor.box = actor.box
        ? {
            x0: lerp(actor.box.x0, measured.x0, k),
            y0: lerp(actor.box.y0, measured.y0, k),
            x1: lerp(actor.box.x1, measured.x1, k),
            y1: lerp(actor.box.y1, measured.y1, k),
          }
        : measured;
      actor.trail.push({
        x: (actor.box.x0 + actor.box.x1) / 2,
        y: (actor.box.y0 + actor.box.y1) / 2,
      });
      if (actor.trail.length > TRAIL_LENGTH) actor.trail.shift();
      visible.add(actor.key);
    }

    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.clearRect(0, 0, width, height);

    const progress = previous === null ? 1 : clamp((time - wipeStart) / WIPE_DURATION, 0, 1);
    if (previous === null || progress >= 1) {
      previous = null;
      renderView(mode);
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
        renderView(view);
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
    updateCaption(visible);
    return visible;
  }

  function updateCaption(visible: Set<string>) {
    const next = describe(visible);
    if (reduceMotion) {
      if (caption !== next) captionEl!.textContent = caption = next;
      return;
    }
    // A change has to hold briefly before it is spoken, so edge flicker is ignored.
    if (next !== pendingCaption) {
      pendingCaption = next;
      pendingSince = time;
    }
    if (pendingCaption !== captionTarget && time - pendingSince > 0.35) {
      let shared = 0;
      while (
        shared < captionShown &&
        shared < pendingCaption.length &&
        pendingCaption[shared] === captionTarget[shared]
      ) {
        shared++;
      }
      captionTarget = pendingCaption;
      captionShown = shared;
    }
  }

  /** Trying all four views by hand reveals the way into the hidden game, and it stays revealed. */
  function unlockPlay() {
    playLink?.removeAttribute('hidden');
    document.dispatchEvent(new CustomEvent(FOUND_EVENT));
  }

  function setMode(next: Mode, byUser: boolean) {
    if (byUser) {
      auto = false;
      chosen.add(next);
      if (chosen.size === MODES.length) unlockPlay();
    }
    if (next !== mode) {
      previous = reduceMotion ? null : mode;
      mode = next;
      wipeStart = time;
    }
    modeSince = time;
    for (const tab of tabs) {
      const active = tab.dataset.mode === mode;
      tab.setAttribute('aria-pressed', String(active));
      tab.style.setProperty('--progress', active && !auto ? '1' : '0');
    }
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

    const visible = draw();

    if (visible) {
      sampleClock += dt;
      if (sampleClock >= SAMPLE_INTERVAL) {
        sampleClock -= SAMPLE_INTERVAL;
        let mask = 0;
        TIMELINE_ROWS.forEach((key, row) => {
          if (visible.has(key)) mask |= 1 << row;
        });
        history.push(mask);
      }
      confidenceClock += dt;
      if (confidenceClock >= 0.4) {
        confidenceClock = 0;
        for (const actor of actors) actor.confidence = 0.9 + Math.random() * 0.09;
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
  try {
    if (localStorage.getItem(FOUND_KEY)) playLink?.removeAttribute('hidden');
  } catch {
    // No storage: the link stays hidden until it is earned.
  }

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
