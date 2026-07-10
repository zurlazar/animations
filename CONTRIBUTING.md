# Contributing

Thanks for wanting to build the open platform for mesmerizing animations.
It's early — which means your ideas shape the architecture, not just the code.

## Ground rules

- **Open standards over lock-in.** New format support should lean on glTF,
  OpenUSD, WebCodecs, WebXR, etc.
- **GPU-first.** If a feature can run as a WebGPU compute pass, prefer that.
- **Everything is a node.** New capabilities should be expressible as graph
  nodes wherever it makes sense — that's the plugin surface.
- **OSS-compatible deps only.** MIT / Apache-2.0 / BSD. No copyleft in the
  runtime path.

## Getting set up

```bash
pnpm install
pnpm dev          # run the editor demo
pnpm test         # run unit tests (Vitest)
pnpm -r build     # build all packages
```

Requires Node 20+, pnpm 9+, and a WebGPU-capable browser.

## Workflow

1. Open an issue describing the change (or comment on an existing one) before
   large work — let's align on direction early.
2. Branch from `main`, keep PRs focused.
3. Add tests for logic in `packages/*`.
4. Run `pnpm test` and typecheck before pushing.

## Good first areas

- Standard-library nodes (math, geometry, easing).
- glTF import edge cases.
- Example scenes for the gallery.
- Docs and tutorials.

See [docs/ROADMAP.md](docs/ROADMAP.md) for where things are headed.
