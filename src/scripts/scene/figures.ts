/**
 * The cast of the dot-matrix scenes, as signed distance fields.
 *
 * Figures are sized in units: `u` is one percent of the scene height, so the cast scales with
 * the viewport. `x` is the horizontal center, `dir` is 1 facing right or -1 facing left, `dist`
 * is how far the figure has traveled (it drives the gait), and `ground` is the y of the floor.
 */
import { type Bone, type Box, type Vec, capsule, circle } from './geometry';

export interface Figure {
  /** Loose bounds used to limit which dots are sampled. */
  bounds: Box;
  /** Limb segments, for the pose view. */
  bones: Bone[];
  /** Signed distance from a point to the silhouette, in pixels. */
  sdf: (x: number, y: number) => number;
}

/** Each member of the cast keeps one color wherever it appears. */
export const FIGURE_COLORS = {
  adult: '#ffcb05',
  dog: '#5cc8ff',
  ball: '#ff7ab6',
  bird: '#7be495',
} as const;

/** Radius of the ball, in units. */
export const BALL_RADIUS = 3.3;

export function walkingAdult(x: number, dir: number, dist: number, ground: number, u: number) {
  const phase = dist / (4.6 * u);
  const swing = Math.sin(phase);
  const bob = Math.abs(Math.cos(phase)) * 0.7 * u;
  const hipY = ground - 15 * u - bob;
  const shoulderY = ground - 26 * u - bob;
  const footY = ground - 1.8 * u;
  const head: Vec = { x: x + dir * 0.6 * u, y: ground - 32.5 * u - bob };
  const torso: Bone = [x, shoulderY, x, hipY];
  const legA: Bone = [x, hipY, x + swing * 6 * u, footY - Math.max(0, swing) * 1.4 * u];
  const legB: Bone = [x, hipY, x - swing * 6 * u, footY - Math.max(0, -swing) * 1.4 * u];
  const armA: Bone = [x, shoulderY + u, x - swing * 4.6 * u, ground - 16 * u - bob];
  const armB: Bone = [x, shoulderY + u, x + swing * 4.6 * u, ground - 16 * u - bob];
  const figure: Figure = {
    bounds: { x0: x - 10 * u, y0: ground - 38 * u, x1: x + 10 * u, y1: ground + u },
    bones: [[head.x, head.y, x, shoulderY], torso, legA, legB, armA, armB],
    sdf: (px, py) =>
      Math.min(
        circle(px, py, head.x, head.y, 3.5 * u),
        capsule(px, py, torso, 3.3 * u),
        capsule(px, py, legA, 1.9 * u),
        capsule(px, py, legB, 1.9 * u),
        capsule(px, py, armA, 1.45 * u),
        capsule(px, py, armB, 1.45 * u),
      ),
  };
  return figure;
}

export function runningDog(x: number, dir: number, dist: number, ground: number, u: number) {
  const phase = dist / (3.1 * u);
  const y = ground - Math.abs(Math.sin(phase)) * 1.5 * u;
  const leg = (offset: number, shift: number): Bone => {
    const hx = x + dir * offset;
    const lift = Math.max(0, Math.cos(phase + shift)) * 2 * u;
    return [hx, y - 7 * u, hx + dir * Math.sin(phase + shift) * 3.6 * u, ground - 1.3 * u - lift];
  };
  const legs = [
    leg(6.2 * u, 0),
    leg(4.6 * u, 1.1),
    leg(-6.6 * u, Math.PI),
    leg(-5 * u, Math.PI + 1.1),
  ];
  const body: Bone = [x - dir * 7.5 * u, y - 9.4 * u, x + dir * 7 * u, y - 9.9 * u];
  const head: Vec = { x: x + dir * 11.6 * u, y: y - 13.6 * u };
  const snout: Bone = [x + dir * 12.5 * u, y - 13 * u, x + dir * 16 * u, y - 12 * u];
  const ear: Bone = [x + dir * 10.4 * u, y - 16 * u, x + dir * 9.2 * u, y - 18.2 * u];
  const wag = Math.sin(phase * 2) * u;
  const tail: Bone = [x - dir * 10 * u, y - 11 * u, x - dir * 14.5 * u, y - 15.5 * u - wag];
  const figure: Figure = {
    bounds: { x0: x - 17 * u, y0: ground - 20 * u, x1: x + 19 * u, y1: ground + u },
    bones: [body, [body[2], body[3], head.x, head.y], tail, ...legs],
    sdf: (px, py) => {
      let d = Math.min(
        capsule(px, py, body, 3.5 * u),
        circle(px, py, head.x, head.y, 3 * u),
        capsule(px, py, snout, 1.45 * u),
        capsule(px, py, ear, 1.1 * u),
        capsule(px, py, tail, 1 * u),
      );
      for (const l of legs) d = Math.min(d, capsule(px, py, l, 1.3 * u));
      return d;
    },
  };
  return figure;
}

/** A ball centered on (x, y), with a single bone that shows which way it is moving. */
export function bouncingBall(x: number, y: number, dir: number, u: number) {
  const r = BALL_RADIUS * u;
  const figure: Figure = {
    bounds: { x0: x - r - u, y0: y - r - u, x1: x + r + u, y1: y + r + u },
    bones: [[x, y, x + dir * 7 * u, y]],
    sdf: (px, py) => circle(px, py, x, y, r),
  };
  return figure;
}

/** A bird whose body is at (x, y). `flap` is the wing phase in radians. */
export function flyingBird(x: number, y: number, dir: number, flap: number, u: number) {
  const tipY = y - Math.sin(flap) * 5.2 * u - 1.2 * u;
  const body: Bone = [x - dir * 2.4 * u, y, x + dir * 2.6 * u, y - 0.4 * u];
  const wingA: Bone = [x - dir * 0.4 * u, y - 0.6 * u, x - dir * 3 * u - 4.4 * u, tipY];
  const wingB: Bone = [x - dir * 0.4 * u, y - 0.6 * u, x - dir * 3 * u + 4.4 * u, tipY];
  const figure: Figure = {
    bounds: { x0: x - 10 * u, y0: y - 9 * u, x1: x + 10 * u, y1: y + 9 * u },
    bones: [body, wingA, wingB],
    sdf: (px, py) =>
      Math.min(
        capsule(px, py, body, 1.7 * u),
        capsule(px, py, wingA, 1.15 * u),
        capsule(px, py, wingB, 1.15 * u),
      ),
  };
  return figure;
}
