# Roadmap

A staged path from scaffold to platform. Dates are intentionally omitted — this
is sequencing, not a schedule.

## Phase 0 — Foundation (current)
- [x] Monorepo scaffold (pnpm workspaces, TypeScript, Vite)
- [x] Vision + architecture docs
- [x] Renderer abstraction stub (`packages/core`)
- [x] Runnable editor demo: WebGPU scene with animated GPU-driven visuals
- [ ] CI (lint, typecheck, build) once repo is on GitHub

## Phase 1 — Engine core
- [ ] `Renderer` interface with Three.js/WebGPU backend + WebGL2 fallback
- [ ] Scene graph + serializable **scene bundle** format
- [ ] Asset pipeline: glTF import (Draco/Meshopt)
- [ ] Camera rig + orbit/fly controls

## Phase 2 — Motion
- [ ] `packages/timeline`: keyframe tracks driving arbitrary properties
- [ ] Spring & easing library
- [ ] Playback engine (scrub, loop, speed) + editor timeline UI

## Phase 3 — Dynamics
- [ ] `packages/physics`: Rapier (WASM) rigid bodies + joints
- [ ] GPU compute particle system (WGSL)
- [ ] Cloth / soft-body (position-based dynamics)

## Phase 4 — Procedural node graph
- [ ] `packages/nodes`: graph runtime + evaluation
- [ ] Standard node library (geometry, material, sim, math, data)
- [ ] Node editor UI
- [ ] Third-party node plugin loading

## Phase 5 — Frontier primitives
- [ ] Gaussian Splatting (3DGS) playback
- [ ] OpenUSD import + layered composition
- [ ] WebXR (AR overlays, VR walkthrough)

## Phase 6 — Industrial / live data
- [ ] Telemetry adapters (WebSocket / MQTT-over-WS / SSE)
- [ ] Data → node-input bindings (digital-twin mapping)

## Phase 7 — Delivery
- [ ] Embeddable web player runtime
- [ ] Video export via WebCodecs
- [ ] Lottie / image-sequence / sprite-sheet export

## Phase 8 — Community
- [ ] Plugin registry
- [ ] Example gallery + templates
- [ ] Docs site
