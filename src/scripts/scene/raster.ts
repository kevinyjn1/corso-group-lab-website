/** Sampling figures onto the dot grid, and the box and label drawing shared by the scenes. */
import { type Box, clamp } from './geometry';
import type { Figure } from './figures';

export const INK = '#05080f';

/** The dot grid a scene is sampled on. Dots below `bottom` are not part of the scene. */
export interface Grid {
  step: number;
  width: number;
  bottom: number;
}

/**
 * Sample a figure on the grid. Fills `cells` with flat [x, y, coverage] triples for the dots
 * the figure touches, and returns the box around the dots it mostly covers. Returns null when
 * too little of the figure is in frame to count as visible.
 */
export function sample(
  figure: Pick<Figure, 'bounds' | 'sdf'>,
  { step, width, bottom }: Grid,
  cells: number[],
): Box | null {
  const { bounds } = figure;
  cells.length = 0;
  if (bounds.x1 < bounds.x0 || bounds.y1 < bounds.y0) return null;
  const c0 = Math.max(0, Math.floor(bounds.x0 / step));
  const c1 = Math.min(Math.ceil(width / step) - 1, Math.ceil(bounds.x1 / step));
  const r0 = Math.max(0, Math.floor(bounds.y0 / step));
  const r1 = Math.min(Math.floor((bottom - 1) / step) - 1, Math.ceil(bounds.y1 / step));
  let count = 0;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const cx = col * step + step / 2;
      const cy = row * step + step / 2;
      const cover = clamp(0.5 - figure.sdf(cx, cy) / step, 0, 1);
      if (cover <= 0.04) continue;
      cells.push(cx, cy, cover);
      if (cover >= 0.5) {
        count++;
        x0 = Math.min(x0, cx);
        y0 = Math.min(y0, cy);
        x1 = Math.max(x1, cx);
        y1 = Math.max(y1, cy);
      }
    }
  }
  if (count < 3) return null;
  const pad = step * 0.9;
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}

/** Paint sampled cells as squares that grow and brighten with coverage. */
export function paintCells(
  ctx: CanvasRenderingContext2D,
  cells: number[],
  step: number,
  color: string,
  opacity = 1,
) {
  ctx.fillStyle = color;
  for (let i = 0; i < cells.length; i += 3) {
    const cover = cells[i + 2];
    const size = step * (0.2 + 0.62 * cover);
    ctx.globalAlpha = (0.35 + 0.65 * cover) * opacity;
    ctx.fillRect(cells[i] - size / 2, cells[i + 1] - size / 2, size, size);
  }
  ctx.globalAlpha = 1;
}

/** Corner brackets of a box, in the current stroke style. */
export function drawCorners(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const tick = Math.min(9, w / 3, h / 3);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const [cx, cy, sx, sy] of [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x, y + h, 1, -1],
    [x + w, y + h, -1, -1],
  ]) {
    ctx.moveTo(cx + sx * tick, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * tick);
  }
  ctx.stroke();
}

export interface ChipStyle {
  fontFamily: string;
  fontSize: number;
  /** Width of the scene: chips are kept inside it. */
  width: number;
  /** Chips drop below their box instead of rising above this y. */
  top: number;
}

/** A label chip above a box, with an optional dimmer detail after the text. */
export function drawChip(
  ctx: CanvasRenderingContext2D,
  text: string,
  detail: string,
  box: Box,
  color: string,
  alpha: number,
  { fontFamily, fontSize, width, top }: ChipStyle,
) {
  ctx.font = `500 ${fontSize}px ${fontFamily}`;
  const textWidth = ctx.measureText(text).width;
  const detailWidth = detail ? ctx.measureText(detail).width + 8 : 0;
  const chipW = Math.ceil(textWidth + detailWidth + 12);
  const chipH = fontSize + 7;
  const chipX = clamp(box.x0, 0, width - chipW);
  const chipY = box.y0 - chipH - 3 < top ? box.y1 + 3 : box.y0 - chipH - 3;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(chipX, chipY, chipW, chipH);
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, chipX + 6, chipY + chipH / 2 + 0.5);
  if (detailWidth > 0) {
    ctx.globalAlpha = alpha * 0.6;
    ctx.fillText(detail, chipX + 6 + textWidth + 8, chipY + chipH / 2 + 0.5);
  }
  ctx.globalAlpha = 1;
}
