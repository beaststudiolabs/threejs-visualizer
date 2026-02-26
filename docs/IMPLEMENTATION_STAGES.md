# VibeViz Implementation Stages

This file is the canonical staged execution checklist for the project.
All agents must update stage and step status here as work progresses.

## Stage 0 - Bootstrap and Governance

- [x] Create root scaffold (`docs/`, `src/`, `tests/`, `public/`, `.github/workflows/`)
- [x] Add root configs (`package.json`, TS/Vite/Vitest/Playwright, ESLint, Prettier)
- [x] Add governance docs and bind to root `SKILL.md`
- [x] Add frozen contracts in `src/contracts/types.ts` and `src/contracts/schema.ts`
- [x] Run `pnpm verify` baseline

## Stage 1 - Core Runtime and Layout Shell

- [x] Implement `src/core/*` runtime modules (`RendererCore`, `Timebase`, scene/camera/hotkeys)
- [x] Implement dock layout shell and panel scaffolding
- [x] Add debug overlay wiring (`fps`, `t`, `loopT`, telemetry)
- [x] Run smoke e2e and panel toggle verification

## Stage 2 - Templates Pack v1 and Presets

- [x] Implement templates: `wireframeBlob`, `spiroRing`, `pointCloudOrb`
- [x] Implement model-oriented templates: `modelEdges`, `modelVertexGlow`
- [x] Implement `TemplateRegistry`
- [x] Implement preset storage/import/export and migrations scaffold
- [x] Run visual snapshots for 3 templates with fixed seed/time
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
- [ ] Verify e2e behavior for mock MIDI/Webcam/model upload (follow-up: add dedicated e2e for model-upload path)

## Stage 5 - Export, CI, and Closure

- [x] Implement zip/export embed pipeline (`src/export/Exporter.ts`)
- [x] Add CI workflow (`.github/workflows/ci.yml`)
- [x] Add unit/e2e/visual test scaffolding
- [x] Pass full clean-clone `pnpm verify` in CI/local

## Active Blockers

- No hard blocker for local verification; `pnpm verify` passes in this environment.
- Follow-up hardening item: add explicit e2e coverage for model upload + mock MIDI/Webcam interaction path in one scenario.
