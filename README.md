<div align="center">

# animations

**A free, open-source platform for creating mesmerizing animations.**

GPU-first · web-native · open standards · hackable to the core

</div>

---

`animations` is an in-progress open platform for authoring real-time motion that
feels *alive* — spanning **industrial device visualization & digital twins**,
**3D modeling**, **commercial web design**, and **physical dynamics**. It targets
the browser and is built **WebGPU-first**, so it can do things (GPU compute
particles, real-time fluids, Gaussian-splat playback) that WebGL-era tools can't.

> **Status:** early foundation. The scaffold, architecture, and a runnable
> WebGPU demo are in place. See the [roadmap](docs/ROADMAP.md).

## Why

The best tools for beautiful motion are fragmented and mostly closed (Spline,
Rive, Houdini, TouchDesigner) or are libraries rather than an integrated
platform (Three.js, GSAP, Blender). Nobody unifies **GPU dynamics + 3D +
procedural node graphs + live data + timeline + one-click embed** in one free
tool — and WebGPU just made that possible. Read the [vision](docs/VISION.md).

## The stack (see [ARCHITECTURE.md](docs/ARCHITECTURE.md))

| Layer | Technology |
|---|---|
| Rendering | **WebGPU** (WebGL2 fallback) via **Three.js** + **TSL** |
| Dynamics | **Rapier** / **Jolt** (WASM) + custom **WGSL compute** particles & fluids |
| 3D pipeline | **glTF 2.0**, **OpenUSD**, **Gaussian Splatting (3DGS)** |
| Motion | Custom timeline (Theatre.js-inspired), springs, **GSAP** driver |
| Procedural | Node graph (the plugin surface) |
| Industrial | WebSocket / MQTT / SSE telemetry → digital-twin bindings, **WebXR** |
| Delivery | Embeddable player, **WebCodecs** video export, Lottie |

## Repository layout

```
packages/
  core/       Renderer abstraction, scene graph, scene-bundle model
  physics/    Rapier/Jolt + GPU-compute dynamics
  timeline/   Keyframe tracks, sequencing, springs/easing
  nodes/      Node-graph runtime + standard node library (plugin surface)
apps/
  editor/     Web editor (Vite + WebGPU) — the creative surface
docs/         Vision, architecture, roadmap
```

## Quick start

Requires **Node 20+** and **pnpm 9+**, plus a **WebGPU-capable browser**
(Chrome/Edge 113+, Safari 18+, or Firefox with WebGPU enabled).

```bash
pnpm install
pnpm dev        # starts the editor demo at http://localhost:5173
```

The demo renders a GPU-driven, continuously morphing scene — the first proof
that the pipeline is alive.

## Contributing

This is a community project — see [CONTRIBUTING.md](CONTRIBUTING.md). The node
graph is designed so that *extending* the platform and *using* it are the same
act. Early contributors shape the architecture.

## License

[MIT](LICENSE) — free, forever.
