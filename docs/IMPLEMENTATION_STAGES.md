# PARTICLE WIZARD Implementation Stages

This file is the canonical staged execution checklist for the project.
All agents must update stage and step status here as work progresses.

## Stage 0 - Bootstrap and Governance

- [x] Create root scaffold (`docs/`, `src/`, `tests/`, `public/`, `.github/workflows/`)
- [x] Add root configs (`package.json`, TS/Vite/Vitest/Playwright, ESLint, Prettier)
- [x] Add governance docs and bind to root `SKILL.md`
- [x] Add frozen contracts in `src/contracts/types.ts` and `src/contracts/schema.ts`
- [ ] Run `pnpm verify` baseline (blocked: Node/pnpm unavailable in current environment)

## Stage 1 - Core Runtime and Layout Shell

- [x] Implement `src/core/*` runtime modules (`RendererCore`, `Timebase`, scene/camera/hotkeys)
- [x] Implement dock layout shell and panel scaffolding
- [x] Add debug overlay wiring (`fps`, `t`, `loopT`, telemetry)
- [x] Add Particle Wizard fullscreen/hotkey controls and live FPS/particle sliders
- [x] Run smoke e2e and panel toggle verification

## Stage 2 - Templates Pack v1 and Presets

- [x] Implement templates: `wireframeBlob`, `spiroRing`, `pointCloudOrb`
- [x] Implement model-oriented templates: `modelEdges`, `modelVertexGlow`
- [x] Implement `TemplateRegistry`
- [x] Implement preset storage/import/export and migrations scaffold
- [ ] Run visual snapshots for 3 templates with fixed seed/time (missing snapshot baselines / one timeout case)
- [x] Run preset roundtrip tests

## Stage 3 - Audio and Modulation Core

- [x] Implement `AudioEngine` with mock mode
- [x] Implement `ModulatorEngine` with deterministic apply order
- [x] Implement schema-driven parameter controls and modulator editing UI
- [x] Run unit coverage for analyzer normalization and modulation math

## Stage 4 - MIDI, Webcam, and Model Features

- [x] Implement `MidiEngine` with mock injection
- [x] Implement `WebcamEngine` with mock intensity path
- [x] Implement `ModelEngine` GLB loading/centering/scaling
- [x] Add explicit GLB load/reload button and preview refresh flow
- [x] Sanitize GLB imports to mesh-only + texture-free materials
- [x] Replace circular webcam calibration marker with dual left/right palm outlines and per-palm readiness lighting
- [x] Keep palm outlines faintly visible post-activation and support 1.5s live dual-hand recalibration
- [x] Add per-parameter MIDI/Webcam/Audio control toggles with auto-modulator IDs
- [x] Extend modulation runtime for non-number params (boolean/select/color)
- [ ] Verify e2e behavior for mock MIDI/Webcam/model upload (model upload scenario not yet covered by Playwright fixture)

## Stage 5 - Export, CI, and Closure

- [x] Implement zip/export embed pipeline (`src/export/Exporter.ts`)
- [x] Add CI workflow (`.github/workflows/ci.yml`)
- [x] Add unit/e2e/visual test scaffolding
- [x] Add 30 factory presets with seeding bootstrap
- [x] Add 2-5 radial gradient support across all templates
- [ ] Pass full clean-clone `pnpm verify` in CI/local (blocked: runtime tooling unavailable)

## Active Blockers

- `npm run lint` currently fails due broad pre-existing `no-undef` ESLint environment configuration across browser/Node globals.
- Playwright visual snapshot baselines are not committed, so `tests/e2e/visualSnapshots.spec.ts` fails by writing new snapshots.
- One visual snapshot case (`pointCloudOrb`) currently times out in screenshot stabilization under test runner constraints.
