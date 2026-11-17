/**
 * Animated figures, one per research area. Each is a small live illustration of work the group
 * is known for, drawn on the same dot grid as the scene on the home page:
 *
 *   video     a supervoxel hierarchy that merges and splits (LIBSVX, streaming segmentation)
 *   language  dense captioning of a cooking video, step by step (YouCook2, ProcNets)
 *   robotics  a robot following spoken directions through a room (RobotSlang, navigation)
 *   human     an assistant that catches a mistake in a task and asks before going on
 *   health    an echocardiogram with tracked landmarks and a view-quality score
 *   learning  an embedding space from which a small, well-spread coreset is chosen
 *
 * Figures only run while they are on screen, and draw a single still frame for visitors who
 * ask for reduced motion.
 */

const PAPER = '#f6f3ea';
const MAIZE = '#ffcb05';
const PINK = '#ff7ab6';
const BLUE = '#5cc8ff';
const GREEN = '#7be495';
const MUTED = 'rgba(246, 243, 234, 0.55)';
const FAINT = 'rgba(246, 243, 234, 0.13)';

const TINTS: Record<string, string> = {
  video: MAIZE,
  language: BLUE,
  robotics: GREEN,
  human: PINK,
  health: '#ff9466',
  learning: '#b79cff',
};

interface Stage {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** Pitch of the dot grid, and how many cells fit. */
  step: number;
  cols: number;
  rows: number;
  /** Seconds since the figure started. */
  t: number;
  /** The research area's own color. */
  tint: string;
  /** Fill the grid cell at (col, row). `size` is the share of the cell that is covered. */
  cell(col: number, row: number, color: string, alpha?: number, size?: number): void;
  /** Small monospace text. */
  text(value: string, x: number, y: number, color?: string, align?: CanvasTextAlign): void;
}

type Figure = (stage: Stage) => void;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

/** A small seeded generator, so every visit draws the same figure. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let v = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    v = (v + Math.imul(v ^ (v >>> 7), 61 | v)) ^ v;
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}

/** A repeatable value in [0, 1) for a grid cell at a moment. */
function hash(a: number, b: number, c = 0) {
  let v = Math.imul(a + 374761393, 668265263) ^ Math.imul(b + 1274126177, 2246822519) ^ (c * 977);
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
}

const typed = (value: string, elapsed: number, rate = 20) =>
  value.slice(0, clamp(Math.floor(elapsed * rate), 0, value.length));

// --- Video: a supervoxel hierarchy ------------------------------------------

const video: Figure = (() => {
  const random = seeded(11);
  // Seeds sit on a 6 by 4 lattice and wander a little, so regions breathe but keep their place.
  const seeds = Array.from({ length: 24 }, (_, i) => ({
    x: ((i % 6) + 0.5) / 6,
    y: (Math.floor(i / 6) + 0.5) / 4,
    fx: 0.25 + random() * 0.3,
    fy: 0.25 + random() * 0.3,
    px: random() * 6.28,
    py: random() * 6.28,
  }));
  const LEVELS = [0, 1, 2, 3, 2, 1];
  const COUNTS = [24, 12, 6, 3];
  const BASE = [MAIZE, BLUE, PAPER];
  /** The region a seed belongs to at a level: neighbors merge pairwise as the level rises. */
  const region = (i: number, level: number) => {
    const col = i % 6;
    const row = Math.floor(i / 6);
    if (level === 0) return i;
    if (level === 1) return (col >> 1) + 3 * row;
    if (level === 2) return (col >> 1) + 3 * (row >> 1);
    return col >> 1;
  };
  /** Children of one parent share its color and differ in strength until they merge. */
  const strength = (i: number, level: number) => {
    const col = i % 6;
    const row = Math.floor(i / 6);
    const child =
      level === 0 ? (col & 1) + 2 * row : level === 1 ? row * 2 : level === 2 ? (row >> 1) * 4 : 0;
    return level === 3 ? 1 : 0.34 + 0.66 * (((child * 5) % 8) / 7);
  };
  let nearest = new Int8Array(0);

  return (s) => {
    const period = 2.6;
    const turn = Math.floor(s.t / period);
    const level = LEVELS[turn % LEVELS.length];
    const before = LEVELS[(turn + LEVELS.length - 1) % LEVELS.length];
    const scan = clamp((s.t - turn * period) / 0.8, 0, 1) * (s.cols + 2);
    if (nearest.length !== s.cols * s.rows) nearest = new Int8Array(s.cols * s.rows);

    for (let row = 0; row < s.rows; row++) {
      for (let col = 0; col < s.cols; col++) {
        let best = 0;
        let bestD = Infinity;
        for (let i = 0; i < seeds.length; i++) {
          const seed = seeds[i];
          const dx = (seed.x + Math.sin(s.t * seed.fx + seed.px) * 0.05) * s.cols - col;
          const dy = (seed.y + Math.cos(s.t * seed.fy + seed.py) * 0.07) * s.rows - row;
          const d = dx * dx + dy * dy;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
        nearest[row * s.cols + col] = best;
      }
    }

    const bottom = s.rows - 3;
    for (let row = 0; row < bottom; row++) {
      for (let col = 0; col < s.cols; col++) {
        const at = col < scan ? level : before;
        const seed = nearest[row * s.cols + col];
        const id = region(seed, at);
        const right = col + 1 < s.cols ? region(nearest[row * s.cols + col + 1], at) : id;
        const below = row + 1 < bottom ? region(nearest[(row + 1) * s.cols + col], at) : id;
        const edge = right !== id || below !== id;
        s.cell(
          col,
          row,
          BASE[(seed % 6) >> 1],
          strength(seed, at) * (edge ? 0.5 : 1),
          edge ? 0.3 : 0.84,
        );
      }
    }
    if (scan < s.cols + 1) {
      s.ctx.fillStyle = MAIZE;
      s.ctx.fillRect(scan * s.step - 1, 0, 2, bottom * s.step);
    }
    s.text(`level ${level + 1}/4`, s.step, s.h - s.step * 1.3, PAPER);
    s.text(`${COUNTS[level]} supervoxels`, s.w - s.step, s.h - s.step * 1.3, MUTED, 'right');
  };
})();

// --- Language: dense captioning of an instructional video ------------------

const language: Figure = (() => {
  const STEPS = [
    'crack the eggs into a bowl',
    'whisk with milk and salt',
    'melt butter in the pan',
    'pour in the eggs',
    'fold, then serve',
  ];
  const SPANS = [
    [0.04, 0.19],
    [0.23, 0.39],
    [0.43, 0.57],
    [0.61, 0.79],
    [0.83, 0.95],
  ];
  const LOOP = 13;

  return (s) => {
    const head = ((s.t % LOOP) / LOOP) * 1.1;
    const tall = Math.max(4, Math.round(s.rows * 0.26));
    const trackRow = tall + 4;

    // How strongly the model believes an event is under way, column by column.
    for (let col = 1; col < s.cols - 1; col++) {
      const u = (col - 0.5) / (s.cols - 2);
      let score = 0;
      for (const [a, b] of SPANS) {
        score = Math.max(
          score,
          smooth(clamp((u - a) / 0.03, 0, 1)) * smooth(clamp((b - u) / 0.03, 0, 1)),
        );
      }
      const level = score * 0.8 + 0.2 * hash(col, Math.floor(s.t * 5));
      const filled = Math.round(level * tall);
      for (let k = 0; k < filled; k++) {
        s.cell(
          col,
          tall + 2 - k,
          u <= head ? s.tint : PAPER,
          u <= head ? 0.3 + (0.7 * k) / tall : 0.18,
          0.7,
        );
      }
    }

    const left = s.step;
    const span = s.w - 2 * s.step;
    const y = trackRow * s.step;
    for (const [a, b] of SPANS) {
      s.ctx.fillStyle = FAINT;
      s.ctx.fillRect(left + a * span, y, (b - a) * span, s.step);
      if (head > a) {
        s.ctx.fillStyle = s.tint;
        s.ctx.fillRect(left + a * span, y, (Math.min(head, b) - a) * span, s.step);
      }
    }
    s.ctx.fillStyle = MAIZE;
    s.ctx.fillRect(left + Math.min(head, 1) * span - 1, s.step * 3, 2, y - s.step * 2);

    const top = y + s.step * 2.6;
    const line = Math.min(s.step * 2.1, (s.h - top - s.step * 0.5) / STEPS.length);
    STEPS.forEach((step, i) => {
      const [a, b] = SPANS[i];
      if (head < a) return;
      const row = top + i * line;
      const shown = typed(step, (head - a) * LOOP);
      const active = head < b;
      s.text(`0${i + 1}`, left, row, s.tint);
      s.text(
        shown + (active && shown.length < step.length ? '_' : ''),
        left + s.step * 2.6,
        row,
        active ? PAPER : MUTED,
      );
    });
  };
})();

// --- Robotics: following directions through a room --------------------------

const robotics: Figure = (() => {
  const OBSTACLES = [
    { x: 0.16, y: 0.16, w: 0.2, h: 0.17, name: 'table' },
    { x: 0.6, y: 0.1, w: 0.13, h: 0.3, name: 'shelf' },
    { x: 0.32, y: 0.58, w: 0.27, h: 0.13, name: 'bench' },
  ];
  const ROUTE = [
    { x: 0.07, y: 0.46, say: 'head for the table' },
    { x: 0.44, y: 0.44, say: 'turn left past the table' },
    { x: 0.48, y: 0.1, say: 'follow the wall to the shelf' },
    { x: 0.86, y: 0.5, say: 'go around the shelf' },
    { x: 0.8, y: 0.86, say: 'pass behind the bench' },
    { x: 0.2, y: 0.86, say: 'come back to the start' },
  ];
  const SPEED = 0.085;

  return (s) => {
    const usable = s.rows - 3;
    const px = (v: number) => v * s.cols;
    const py = (v: number) => v * usable;
    const lengths = ROUTE.map((a, i) => {
      const b = ROUTE[(i + 1) % ROUTE.length];
      return Math.hypot(b.x - a.x, b.y - a.y);
    });
    const total = lengths.reduce((sum, v) => sum + v, 0);
    let along = (s.t * SPEED) % total;
    let leg = 0;
    while (along > lengths[leg]) along -= lengths[leg++];
    const from = ROUTE[leg];
    const to = ROUTE[(leg + 1) % ROUTE.length];
    const f = along / lengths[leg];
    const rx = px(lerp(from.x, to.x, f));
    const ry = py(lerp(from.y, to.y, f));
    const heading = Math.atan2(py(to.y) - py(from.y), px(to.x) - px(from.x));

    const blocked = (col: number, row: number) =>
      OBSTACLES.some(
        (o) => col >= px(o.x) && col < px(o.x + o.w) && row >= py(o.y) && row < py(o.y + o.h),
      );

    for (let row = 0; row < usable; row++) {
      for (let col = 0; col < s.cols; col++) {
        const dx = col + 0.5 - rx;
        const dy = row + 0.5 - ry;
        const d = Math.hypot(dx, dy);
        let turn = Math.atan2(dy, dx) - heading;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        const seen = d < 11 && Math.abs(turn) < 0.6;
        if (blocked(col, row)) s.cell(col, row, seen ? MAIZE : PAPER, seen ? 0.95 : 0.26, 0.82);
        else if (seen) s.cell(col, row, s.tint, (1 - d / 11) * 0.8, 0.5);
      }
    }
    for (const o of OBSTACLES) {
      s.text(o.name, (px(o.x + o.w / 2) + 0.2) * s.step, (py(o.y) - 0.9) * s.step, MUTED, 'center');
    }

    // The planned path ahead of the robot, and the place it is heading for.
    for (let k = 1; k <= 14; k++) {
      const g = f + (k * 0.035) / lengths[leg];
      if (g > 1) break;
      s.cell(
        Math.floor(px(lerp(from.x, to.x, g))),
        Math.floor(py(lerp(from.y, to.y, g))),
        PAPER,
        0.5,
        0.26,
      );
    }
    const pulse = 0.5 + 0.5 * Math.sin(s.t * 5);
    s.ctx.strokeStyle = MAIZE;
    s.ctx.lineWidth = 2;
    s.ctx.globalAlpha = 0.5 + 0.5 * pulse;
    const goal = s.step * (1.3 + 0.4 * pulse);
    s.ctx.strokeRect(px(to.x) * s.step - goal, py(to.y) * s.step - goal, goal * 2, goal * 2);
    s.ctx.globalAlpha = 1;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++)
        s.cell(Math.floor(rx) + dx, Math.floor(ry) + dy, MAIZE, 1, 0.9);
    }
    s.cell(
      Math.floor(rx + Math.cos(heading) * 2),
      Math.floor(ry + Math.sin(heading) * 2),
      MAIZE,
      1,
      0.6,
    );

    const since = (along / SPEED) * 1;
    s.text('> ' + typed(from.say, since, 24), s.step, s.h - s.step * 1.3, PAPER);
  };
})();

// --- Human-AI: catching a mistake, and asking before going on ---------------

const human: Figure = (() => {
  const TASK = [
    'open the housing',
    'unplug the old filter',
    'insert the new filter',
    'reseat the cable',
    'close the housing',
  ];
  const WRONG = 2;
  const PACE = 1.7;
  // The third step goes wrong part way through, is flagged, questioned, and then redone.
  const DETECT = 1.0;
  const FLAG = 1.0;
  const ASK = 1.9;
  const DETOUR = DETECT + FLAG + ASK;
  const LOOP = TASK.length * PACE + DETOUR + 1.8;

  return (s) => {
    const now = s.t % LOOP;
    const left = s.step * 3.4;
    const right = s.w - s.step;
    const top = s.step * 4;
    const gap = (s.h - top - s.step * 0.4) / TASK.length;
    const cells = Math.floor((right - left) / s.step);
    let state = 'watching';

    TASK.forEach((step, i) => {
      // When each step starts, counting the detour taken by the step that goes wrong.
      const start = i * PACE + (i > WRONG ? DETOUR : 0);
      const y = top + i * gap;
      const row = Math.round((y + s.step * 0.9) / s.step);
      const col0 = Math.round(left / s.step);
      let fill = clamp((now - start) / PACE, 0, 1);
      let color = s.tint === PINK ? PAPER : s.tint;
      let label = step;
      let mark = now >= start + PACE ? 'ok' : '';

      if (i === WRONG) {
        const local = now - start;
        if (local < DETECT) {
          fill = clamp(local / PACE, 0, 1);
          mark = '';
        } else if (local < DETECT + FLAG) {
          fill = DETECT / PACE;
          color = PINK;
          label = 'mistake: wrong part';
          mark = Math.floor(local * 6) % 2 ? '!!' : '';
          state = 'mistake found';
        } else if (local < DETOUR) {
          fill = DETECT / PACE;
          color = PINK;
          label = typed('ask: which filter goes here?', local - DETECT - FLAG, 22);
          mark = '?';
          state = 'asking';
        } else {
          fill = clamp((local - DETOUR) / PACE, 0, 1);
          mark = fill >= 1 ? 'ok' : '';
        }
      }
      const begun = now >= start;
      s.text(`0${i + 1}`, s.step, y, begun ? PAPER : MUTED);
      s.text(
        label,
        left,
        y,
        !begun ? MUTED : color === PINK ? (mark === '?' ? MAIZE : PINK) : PAPER,
      );
      s.text(mark, right, y, mark === 'ok' ? GREEN : color === PINK ? PINK : PAPER, 'right');
      for (let k = 0; k < cells; k++) {
        const on = begun && k < Math.round(fill * cells);
        s.cell(col0 + k, row, on ? color : PAPER, on ? 0.95 : 0.14, on ? 0.8 : 0.3);
      }
    });
    s.text(
      state,
      right,
      s.step * 0.9,
      state === 'watching' ? MUTED : state === 'asking' ? MAIZE : PINK,
      'right',
    );
  };
})();

// --- Health: an echocardiogram with tracked landmarks -----------------------

const health: Figure = (s) => {
  const ax = s.w / 2;
  const ay = s.step * 1.2;
  const R = s.h - ay - s.step * 3.4;
  const half = Math.min(0.72, Math.atan2(s.w * 0.47, R));
  const beat = (s.t * 1.1) % 1;
  const squeeze = Math.exp(-Math.pow((beat - 0.2) / 0.1, 2));
  const sweep = -half + ((s.t * 0.45) % 1) * 2 * half;

  // Two chambers; the larger one contracts with each beat.
  const chambers = [
    {
      cx: ax - R * 0.1,
      cy: ay + R * 0.56,
      rx: R * 0.21 * (1 - 0.2 * squeeze),
      ry: R * 0.3 * (1 - 0.12 * squeeze),
    },
    {
      cx: ax + R * 0.27,
      cy: ay + R * 0.62,
      rx: R * 0.13 * (1 + 0.1 * squeeze),
      ry: R * 0.2 * (1 + 0.06 * squeeze),
    },
  ];

  for (let row = 0; row < s.rows - 3; row++) {
    for (let col = 0; col < s.cols; col++) {
      const x = (col + 0.5) * s.step;
      const y = (row + 0.5) * s.step;
      const r = Math.hypot(x - ax, y - ay);
      const angle = Math.atan2(x - ax, y - ay);
      if (r < R * 0.07 || r > R || Math.abs(angle) > half) continue;
      let wall = 0;
      for (const c of chambers) {
        const d = Math.hypot((x - c.cx) / c.rx, (y - c.cy) / c.ry);
        wall = Math.max(wall, Math.exp(-Math.pow((d - 1) / 0.2, 2)));
      }
      const speckle = hash(col, row, Math.floor(s.t * 9));
      const glow = Math.exp(-Math.pow((angle - sweep) / 0.07, 2));
      const level = clamp(0.07 + wall * (0.5 + 0.45 * speckle) + 0.13 * speckle + 0.3 * glow, 0, 1);
      s.cell(col, row, glow > 0.5 ? MAIZE : wall > 0.5 ? s.tint : PAPER, level, 0.34 + 0.5 * level);
    }
  }

  // Landmarks on the main chamber, followed through the beat.
  const [lv] = chambers;
  const marks = [
    { x: lv.cx, y: lv.cy - lv.ry, name: 'apex' },
    { x: lv.cx - lv.rx * 0.82, y: lv.cy + lv.ry * 0.62, name: 'mv' },
    { x: lv.cx + lv.rx * 0.82, y: lv.cy + lv.ry * 0.62, name: '' },
  ];
  s.ctx.strokeStyle = MAIZE;
  s.ctx.lineWidth = 2;
  for (const m of marks) {
    const arm = s.step * 0.7;
    s.ctx.beginPath();
    s.ctx.moveTo(m.x - arm, m.y);
    s.ctx.lineTo(m.x + arm, m.y);
    s.ctx.moveTo(m.x, m.y - arm);
    s.ctx.lineTo(m.x, m.y + arm);
    s.ctx.stroke();
    if (m.name) s.text(m.name, m.x - arm - 4, m.y, MAIZE, 'right');
  }

  // The heartbeat itself, as a trace along the bottom.
  const base = s.h - s.step * 1.4;
  s.ctx.strokeStyle = s.tint;
  s.ctx.lineWidth = 1.5;
  s.ctx.beginPath();
  for (let x = s.step; x <= s.w * 0.62; x += 2) {
    const phase = (((s.t * 1.1 - (s.w * 0.62 - x) / (s.w * 0.36)) % 1) + 1) % 1;
    const spike =
      Math.exp(-Math.pow((phase - 0.2) / 0.035, 2)) * 1.6 -
      Math.exp(-Math.pow((phase - 0.27) / 0.04, 2)) * 0.5;
    const yy = base - spike * s.step;
    if (x === s.step) s.ctx.moveTo(x, yy);
    else s.ctx.lineTo(x, yy);
  }
  s.ctx.stroke();
  s.text(
    `view quality ${(0.86 + 0.05 * Math.sin(s.t * 0.7)).toFixed(2)}`,
    s.w - s.step,
    base,
    PAPER,
    'right',
  );
};

// --- Learning: choosing a coreset from an embedding space -------------------

const learning: Figure = (() => {
  const random = seeded(29);
  const CENTERS = [
    [0.26, 0.3],
    [0.71, 0.26],
    [0.31, 0.7],
    [0.74, 0.68],
  ];
  const COLORS = [PAPER, BLUE, GREEN, '#b79cff'];
  const gauss = () => (random() + random() + random() - 1.5) * 0.9;
  const points = Array.from({ length: 96 }, (_, i) => {
    const [cx, cy] = CENTERS[i % 4];
    return {
      x: cx + gauss() * 0.11,
      y: cy + gauss() * 0.12,
      sx: random(),
      sy: random(),
      group: i % 4,
    };
  });
  // Farthest-point order: each pick is the point farthest from everything already picked.
  const order: number[] = [0];
  const KEEP = 20;
  while (order.length < KEEP) {
    let best = 0;
    let bestD = -1;
    points.forEach((p, i) => {
      const d = Math.min(...order.map((j) => Math.hypot(p.x - points[j].x, p.y - points[j].y)));
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    });
    order.push(best);
  }
  const rank = new Map(order.map((index, k) => [index, k]));
  const LOOP = 12.5;

  return (s) => {
    const now = s.t % LOOP;
    const gather = now < 10.8 ? easeOut(now / 2.4) : 1 - easeOut((now - 10.8) / 1.5);
    const kept = clamp(Math.floor((now - 2.6) / 0.3), 0, KEEP);
    const usable = s.h - s.step * 3;

    points.forEach((p, i) => {
      const x = lerp(p.sx, p.x, gather) * s.w + Math.sin(s.t * 0.9 + i) * 1.5;
      const y = lerp(p.sy, p.y, gather) * usable + Math.cos(s.t * 0.8 + i * 1.7) * 1.5;
      const picked = (rank.get(i) ?? KEEP) < kept;
      if (picked) {
        const half = s.step * 0.62;
        s.ctx.fillStyle = MAIZE;
        s.ctx.fillRect(x - half, y - half, half * 2, half * 2);
        s.ctx.strokeStyle = MAIZE;
        s.ctx.lineWidth = 1;
        s.ctx.globalAlpha = 0.5;
        s.ctx.strokeRect(x - half * 2, y - half * 2, half * 4, half * 4);
        s.ctx.globalAlpha = 1;
      } else {
        const half = s.step * 0.3;
        s.ctx.globalAlpha = kept >= KEEP ? 0.28 : 0.85;
        s.ctx.fillStyle = COLORS[p.group];
        s.ctx.fillRect(x - half, y - half, half * 2, half * 2);
        s.ctx.globalAlpha = 1;
      }
    });
    s.text(
      `keep ${String(kept).padStart(2, '0')} / ${points.length}`,
      s.step,
      s.h - s.step * 1.3,
      PAPER,
    );
    s.text(
      kept >= KEEP ? 'coreset chosen' : gather < 1 ? 'embedding' : 'selecting',
      s.w - s.step,
      s.h - s.step * 1.3,
      MUTED,
      'right',
    );
  };
})();

const FIGURES: Record<string, Figure> = { video, language, robotics, human, health, learning };

/** A moment at which each figure makes a good still, for reduced motion. */
const STILL: Record<string, number> = {
  video: 1.6,
  language: 9.2,
  robotics: 6,
  human: 6.4,
  health: 0.5,
  learning: 9.5,
};

function mount(root: HTMLElement) {
  const name = root.dataset.figure ?? '';
  const figure = FIGURES[name];
  const canvas = root.querySelector('canvas');
  const ctx = canvas?.getContext('2d');
  if (!figure || !canvas || !ctx) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage: Stage = {
    ctx,
    w: 0,
    h: 0,
    step: 10,
    cols: 0,
    rows: 0,
    t: STILL[name] ?? 0,
    tint: TINTS[name] ?? MAIZE,
    cell(col, row, color, alpha = 1, size = 0.8) {
      if (col < 0 || row < 0 || col >= stage.cols || row >= stage.rows) return;
      const side = stage.step * size;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(
        (col + 0.5) * stage.step - side / 2,
        (row + 0.5) * stage.step - side / 2,
        side,
        side,
      );
      ctx.globalAlpha = 1;
    },
    text(value, x, y, color = PAPER, align = 'left') {
      ctx.font = font;
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(value.toUpperCase(), x, y);
    },
  };
  let font = '500 11px monospace';
  let dpr = 1;
  let running = false;
  let visible = false;
  let last = 0;

  function resize() {
    const rect = root.getBoundingClientRect();
    stage.w = Math.round(rect.width);
    stage.h = Math.round(rect.height);
    if (stage.w === 0 || stage.h === 0) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas!.width = Math.round(stage.w * dpr);
    canvas!.height = Math.round(stage.h * dpr);
    stage.step = clamp(Math.round(stage.w / 46), 7, 13);
    stage.cols = Math.floor(stage.w / stage.step);
    stage.rows = Math.floor(stage.h / stage.step);
    const size = clamp(Math.round(stage.w / 36), 9, 13);
    font = `500 ${size}px ${getComputedStyle(canvas!).fontFamily || 'monospace'}`;
    if (!running) draw();
  }

  function draw() {
    if (stage.w === 0) return;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.clearRect(0, 0, stage.w, stage.h);
    // The resting grid that every figure is drawn over.
    ctx!.fillStyle = FAINT;
    const dot = Math.max(1, stage.step * 0.14);
    for (let row = 0; row < stage.rows; row++) {
      for (let col = 0; col < stage.cols; col++) {
        ctx!.fillRect(
          (col + 0.5) * stage.step - dot / 2,
          (row + 0.5) * stage.step - dot / 2,
          dot,
          dot,
        );
      }
    }
    figure(stage);
    root.dataset.painted = '';
  }

  function frame(now: number) {
    if (!running) return;
    stage.t += Math.min((now - last) / 1000, 0.05);
    last = now;
    draw();
    requestAnimationFrame(frame);
  }

  function setRunning(next: boolean) {
    const allowed = next && !reduceMotion && !document.hidden;
    if (allowed === running) return;
    running = allowed;
    if (running) {
      last = performance.now();
      requestAnimationFrame(frame);
    }
  }

  new ResizeObserver(resize).observe(root);
  resize();
  document.fonts?.ready.then(() => {
    resize();
  });
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    setRunning(visible);
  }).observe(root);
  document.addEventListener('visibilitychange', () => setRunning(visible));
}

export function mountFigures(): void {
  for (const root of document.querySelectorAll<HTMLElement>('[data-figure]')) {
    if (root.dataset.mounted !== undefined) continue;
    root.dataset.mounted = '';
    mount(root);
  }
}
