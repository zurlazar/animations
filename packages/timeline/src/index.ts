/**
 * @animations/timeline
 *
 * Sequencing primitives. This first slice ships the easing + spring math that
 * everything else (keyframe tracks, the editor timeline) will build on.
 * Motion in this platform is physically motivated by default — springs over
 * hand-tweaked curves — but classic easing is here when you want it.
 *
 * See docs/ROADMAP.md → Phase 2.
 */

export type Easing = (t: number) => number;

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

/** A small, complete-enough easing set. All map [0,1] → [0,1]. */
export const easing = {
  linear: (t) => clamp01(t),
  quadIn: (t) => clamp01(t) ** 2,
  quadOut: (t) => 1 - (1 - clamp01(t)) ** 2,
  quadInOut: (t) => {
    const x = clamp01(t);
    return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
  },
  cubicIn: (t) => clamp01(t) ** 3,
  cubicOut: (t) => 1 - (1 - clamp01(t)) ** 3,
  cubicInOut: (t) => {
    const x = clamp01(t);
    return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
  },
  /** Overshoots then settles — great for playful UI. */
  backOut: (t) => {
    const x = clamp01(t);
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
  },
  /** Decaying oscillation. */
  elasticOut: (t) => {
    const x = clamp01(t);
    if (x === 0 || x === 1) return x;
    const c4 = (2 * Math.PI) / 3;
    return 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
  },
} satisfies Record<string, Easing>;

/** Linear interpolation. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * A critically-dampable spring integrated with semi-implicit Euler. Feed it a
 * target each frame and step it by `dt`; read `.value`. This is the backbone of
 * "motion that feels like matter."
 */
export class Spring {
  value: number;
  private velocity = 0;

  constructor(
    initial = 0,
    /** Higher = snappier. */
    public stiffness = 170,
    /** Higher = less oscillation. */
    public damping = 26,
    /** Perceived mass. */
    public mass = 1,
  ) {
    this.value = initial;
  }

  /** Advance toward `target` by `dt` seconds. Returns the new value. */
  step(target: number, dt: number): number {
    // Sub-step for stability at large dt (e.g. tab regains focus).
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const force = -this.stiffness * (this.value - target) - this.damping * this.velocity;
      const accel = force / this.mass;
      this.velocity += accel * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }

  /** True once the spring has effectively settled at its target. */
  isSettled(target: number, epsilon = 0.001): boolean {
    return Math.abs(this.value - target) < epsilon && Math.abs(this.velocity) < epsilon;
  }
}

export const VERSION = "0.0.0";
