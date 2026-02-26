# Architecture

## Runtime Layers

- `src/contracts/*` frozen shared interfaces.
- `src/core/*` deterministic render/time loop.
- `src/engines/*` input subsystems (audio/midi/webcam/model), each with mock mode.
- `src/modulators/*` deterministic signal routing to params.
- `src/templates/*` visual templates implementing `VisualizerTemplate`.
- `src/ui/*` dock layout, panels, and schema-driven controls.
- `src/presets/*` persistence and migration.
- `src/export/*` zip/embed export.

## Determinism

- RNG uses seeded utility only.
- Templates update from `TemplateRuntime.loopT`.
- Visual snapshots use fixed seed/time/resolution.
