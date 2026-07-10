# Architecture & Technology Strategy

> The goal: a free, open-source platform for authoring **mesmerizing, real-time
> animations** — spanning industrial device visualization, 3D modeling,
> commercial web design, and physical dynamics — that runs anywhere a modern GPU
> does, primarily the browser.

This document surveys the cutting-edge landscape (as of early 2026) and commits
to a stack. Every choice below optimizes for three things: **GPU-first
performance**, **open standards**, and **a hackable, plugin-driven core**.

---

## 1. The rendering foundation — WebGPU first

WebGL served the web for a decade, but it is a dead end for the visuals we want
(compute, large instance counts, modern material graphs). We build **WebGPU
first, with a WebGL2 fallback**.

| Concern | Choice | Why |
|---|---|---|
| GPU API | **WebGPU** (fallback WebGL2) | Compute shaders, storage buffers, far lower draw-call overhead, modern pipeline. Broadly shipping in Chromium & Safari; Firefox rolling out. |
| Engine | **Three.js** w/ `WebGPURenderer` + **TSL** (Three.js Shading Language) | TSL is a node-based shader language that compiles to **both** WGSL and GLSL — one material graph, two backends. Largest ecosystem, MIT. |
| Alt engine (eval) | **Babylon.js** | Best-in-class WebGPU support, built-in Node Material Editor, strong for engineering/CAD-grade viz. Kept behind our renderer abstraction so we can A/B it. |
| Declarative layer | **React Three Fiber + drei** | Optional React binding for the editor UI; the core engine stays framework-agnostic. |

**Decision:** wrap the renderer behind our own thin `Renderer` interface
(`packages/core`) so the platform is never hard-married to one engine. Ship
Three.js/WebGPU as the default backend.

---

## 2. Dynamics & physics — the "mesmerizing" part

Motion that feels alive comes from simulation, not hand-keyed curves. We lean on
Rust/WASM engines compiled for the browser:

- **Rapier** (dimforge, Rust→WASM) — rigid bodies, joints, ragdolls. Deterministic,
  fast, MIT/Apache. Our default for mechanical/industrial dynamics.
- **Jolt Physics** (WASM build) — evaluated for large-scale, high-fidelity scenes
  (vehicles, complex constraints) where it outperforms.
- **GPU compute particles & fluids** — bespoke WGSL compute pipelines for
  particle systems, boids, SPH/PIC fluids, cloth. This is where WebGPU pays off
  and where most competitors (still on WebGL) can't follow.
- **Verlet / position-based dynamics** — lightweight soft-body & cloth in compute.

---

## 3. 3D content pipeline — open standards only

- **glTF 2.0** (+ Draco/Meshopt compression) — the delivery format ("JPEG of 3D").
- **OpenUSD** — the interchange & scene-composition backbone. This is the bridge
  to the *industrial* world: NVIDIA Omniverse, digital twins, and every serious
  DCC now speaks USD. We target USD import and layered composition.
- **Gaussian Splatting (3DGS)** — real-time photoreal capture playback. A
  first-class primitive, not an afterthought — this is a genuine frontier and a
  differentiator for "mesmerizing."
- **Blender** as the recommended free authoring companion (Geometry Nodes →
  glTF/USD export path documented for creators).

---

## 4. Animation & motion design

- **Timeline / sequencing** — our own keyframe + track model (`packages/timeline`),
  inspired by **Theatre.js** (MIT), designed to drive *any* property (transforms,
  materials, shader uniforms, physics params).
- **Easing & springs** — physically-based springs by default, classic bezier
  easing available. Motion should feel like matter, not like PowerPoint.
- **GSAP** — integrated as an optional driver (now fully free, all plugins) for
  teams that live in it.
- **Rive** — state-machine-driven interactive 2D/vector, evaluated as an embed
  primitive for UI-layer motion.
- **Lottie / dotLottie** — import/export for vector animation interchange.

---

## 5. Procedural authoring — a node graph at the core

The platform is **node-based** at heart (`packages/nodes`): a directed graph
where nodes emit geometry, drive materials, run simulations, or transform data.
Think Blender Geometry Nodes / TouchDesigner / Houdini, but open and web-native.
Nodes are the plugin surface — third parties ship nodes.

---

## 6. Industrial & real-time data

For the "industrial devices" use case, animation must bind to **live data**:

- **Data sources** — WebSocket / MQTT-over-WS / SSE telemetry adapters.
- **Digital-twin bindings** — map incoming signals to node-graph inputs
  (temperature → emissive color, RPM → rotation, pressure → deformation).
- **WebXR** — AR overlays on physical equipment; VR walkthroughs.

---

## 7. Delivery & export

Mesmerizing is worthless if it can't ship:

- **Embeddable web player** — a tiny runtime (`<script>` + one canvas) that plays
  a scene bundle. This is how commercial web-design work reaches production.
- **Video export** — WebCodecs (`VideoEncoder`) for in-browser MP4/WebM render-out,
  deterministic offline frame rendering for high-res.
- **Image sequences / sprite sheets / Lottie** for lighter targets.

---

## 8. Platform architecture (monorepo)

```
animations/
├── packages/
│   ├── core/       Renderer abstraction, scene graph, asset & scene bundle model
│   ├── physics/    Rapier/Jolt + GPU-compute dynamics
│   ├── timeline/   Keyframe tracks, sequencing, springs/easing
│   └── nodes/      Node-graph runtime + standard node library (the plugin surface)
├── apps/
│   └── editor/     Web editor (Vite + WebGPU) — the creative surface
└── docs/           Vision, architecture, roadmap
```

**Tooling:** TypeScript everywhere, pnpm workspaces, Vite for the editor, Vitest
for tests. Rust/WASM (via wasm-pack) for any compute-heavy custom kernels.

---

## 9. Licensing posture

- Platform code: **MIT** — maximum adoption, minimum friction.
- We only depend on OSS-compatible licenses (MIT / Apache-2.0 / BSD). No
  copyleft in the runtime path. Rapier (Apache-2.0), Three.js (MIT), and USD
  (Apache-2.0-ish TOML) all qualify.

---

## 10. What makes this different

Most web-animation tools pick one lane. This platform's bet is that **WebGPU
finally makes it possible to unify them** — GPU compute dynamics + photoreal
splats + a procedural node graph + live industrial data + a real timeline — in
one open, embeddable runtime. That combination does not exist for free today.
