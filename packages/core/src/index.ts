/**
 * @animations/core
 *
 * The engine-agnostic heart of the platform. Everything above this layer talks
 * to the `Renderer` interface, never to Three.js/Babylon directly — so a scene
 * authored once can be driven by any backend (WebGPU today, others later).
 */

/** A monotonically-increasing clock passed to every updatable each frame. */
export interface FrameClock {
  /** Seconds since the loop started. */
  readonly elapsed: number;
  /** Seconds since the previous frame. */
  readonly delta: number;
  /** Frame index since start. */
  readonly frame: number;
}

/** Anything that advances over time — animations, sims, node graphs. */
export interface Updatable {
  update(clock: FrameClock): void;
}

/** Which GPU backend a renderer resolved to at runtime. */
export type Backend = "webgpu" | "webgl2";

export interface RendererInitOptions {
  canvas: HTMLCanvasElement;
  /** Prefer WebGPU; fall back to WebGL2 if unavailable. Default: true. */
  preferWebGPU?: boolean;
  /** Device pixel ratio cap, to keep 4K/retina honest. Default: 2. */
  maxPixelRatio?: number;
}

/**
 * The one interface the rest of the platform depends on. Backends
 * (Three.js/WebGPU, Babylon, WebGL2 fallback) implement this.
 */
export interface Renderer {
  readonly backend: Backend;
  resize(width: number, height: number): void;
  /** Render a single frame. */
  render(clock: FrameClock): void;
  dispose(): void;
}

/** Detects the best available backend without constructing a renderer. */
export async function detectBackend(): Promise<Backend> {
  const nav = navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } };
  if (nav.gpu) {
    try {
      const adapter = await nav.gpu.requestAdapter();
      if (adapter) return "webgpu";
    } catch {
      /* fall through */
    }
  }
  return "webgl2";
}

/**
 * A fixed-timestep-friendly render loop. Owns the clock; drives a list of
 * updatables and then the renderer. Framework-agnostic.
 */
export class Loop {
  private readonly updatables = new Set<Updatable>();
  private running = false;
  private rafId = 0;
  private startTime = 0;
  private lastTime = 0;
  private frame = 0;

  constructor(private readonly renderer: Renderer) {}

  add(u: Updatable): () => void {
    this.updatables.add(u);
    return () => this.updatables.delete(u);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    // performance.now avoided at module scope for determinism-friendliness;
    // the first tick seeds the clock.
    this.startTime = 0;
    this.lastTime = 0;
    this.frame = 0;
    const tick = (now: number) => {
      if (!this.running) return;
      if (this.startTime === 0) this.startTime = now;
      const elapsed = (now - this.startTime) / 1000;
      const delta = this.lastTime === 0 ? 0 : (now - this.lastTime) / 1000;
      this.lastTime = now;
      const clock: FrameClock = { elapsed, delta, frame: this.frame++ };
      for (const u of this.updatables) u.update(clock);
      this.renderer.render(clock);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  dispose(): void {
    this.stop();
    this.updatables.clear();
    this.renderer.dispose();
  }
}

export const VERSION = "0.0.0";
