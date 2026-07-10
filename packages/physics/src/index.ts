/**
 * @animations/physics
 *
 * Dynamics for the platform. Planned backends:
 *  - Rapier (Rust→WASM) for deterministic rigid bodies & joints (default)
 *  - Jolt (WASM) for large-scale / high-fidelity scenes
 *  - Custom WGSL compute pipelines for particles, SPH/PIC fluids, and cloth
 *
 * See docs/ROADMAP.md → Phase 3.
 */

export const VERSION = "0.0.0";
