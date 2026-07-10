# Vision

**A free, open-source platform for creating mesmerizing animations.**

## The problem

The tools for beautiful real-time motion are fragmented and mostly closed:

- **Spline, Rive, Cavalry, Cinema4D, Houdini, TouchDesigner** — powerful, but
  proprietary, expensive, or locked to the desktop.
- **Three.js, GSAP, Blender** — brilliant and open, but they are *libraries and
  DCCs*, not an integrated authoring-to-delivery platform.
- Nobody unifies **GPU dynamics + 3D + procedural node graphs + live data +
  timeline + one-click embed** in a single free tool.

Meanwhile the browser just got a real GPU API (**WebGPU**). The ceiling moved.

## The bet

Build the open platform that sits in that gap — web-native, GPU-first, and
hackable to the core — so that anyone can create animations that feel *alive*:

- A materials designer bringing a **commercial web hero** to life.
- An engineer building a **digital twin** of a machine that reacts to live
  telemetry.
- A motion designer sequencing a **photoreal Gaussian-splat** flythrough.
- A creative coder wiring a **GPU particle system** to audio.

One tool. Open source. Runs in a browser. Exports to production.

## Principles

1. **GPU-first.** If it can run on the GPU, it does. WebGPU compute is the point.
2. **Open standards.** glTF, OpenUSD, WebCodecs, WebXR — no proprietary lock-in.
3. **Everything is a node.** The node graph *is* the plugin API. Extending the
   platform and using it are the same act.
4. **Physically motivated motion.** Springs and simulation over hand-tweaked
   curves. Motion should read as matter.
5. **Author → embed in one step.** A scene you make is a `<canvas>` you ship.
6. **Free, forever, MIT.** Community-owned.

## Non-goals (for now)

- Not a general-purpose game engine.
- Not a video editor.
- Not a replacement for Blender/Houdini as a modeling/VFX DCC — we *interoperate*
  with them via USD/glTF.

## Naming

Working title: **animations**. Candidate names for the project brand (pick later):
*Lumen, Kinetix, Fluxform, Aurora, Prism, Mesmer*.
