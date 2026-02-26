# VibeViz Implementation Stages

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
- [ ] Run smoke e2e and panel toggle verification (blocked: runtime tooling unavailable)

## Stage 2 - Templates Pack v1 and Presets

- [x] Implement templates: `wireframeBlob`, `spiroRing`, `pointCloudOrb`
- [x] Implement model-oriented templates: `modelEdges`, `modelVertexGlow`
- [x] Implement `TemplateRegistry`
- [x] Implement preset storage/import/export and migrations scaffold
- [ ] Run visual snapshots for 3 templates with fixed seed/time (blocked: runtime tooling unavailable)
- [ ] Run preset roundtrip tests (blocked: runtime tooling unavailable)

## Stage 3 - Audio and Modulation Core

- [x] Implement `AudioEngine` with mock mode
- [x] Implement `ModulatorEngine` with deterministic apply order
- [x] Implement schema-driven parameter controls and modulator editing UI
- [ ] Run unit coverage for analyzer normalization and modulation math (blocked: runtime tooling unavailable)

## Stage 4 - MIDI, Webcam, and Model Features

- [x] Implement `MidiEngine` with mock injection
- [x] Implement `WebcamEngine` with mock intensity path
- [x] Implement `ModelEngine` GLB loading/centering/scaling
- [ ] Verify e2e behavior for mock MIDI/Webcam/model upload (blocked: runtime tooling unavailable)

## Stage 5 - Export, CI, and Closure

- [x] Implement zip/export embed pipeline (`src/export/Exporter.ts`)
- [x] Add CI workflow (`.github/workflows/ci.yml`)
- [x] Add unit/e2e/visual test scaffolding
- [ ] Pass full clean-clone `pnpm verify` in CI/local (blocked: runtime tooling unavailable)

## Active Blockers

- Node.js, npm, pnpm, and corepack are not installed in the current execution environment.
- Git is not installed in the current execution environment.
- Because of that, `pnpm verify` and all automated test commands are not executable from this session.
