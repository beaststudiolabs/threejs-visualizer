# Architecture

## Current Root Experience

- `/` now runs the shader-driven Particle Wizard app (`src/wizard/*` + `src/ui/App.tsx`).
- Core runtime responsibilities:
  - Three.js scene/camera/render loop in `ParticleWizardRuntime`
  - GLSL particle simulation and morphing across 5 spatial modes
  - Postprocessing chain (`EffectComposer`, bloom, afterimage trails)
  - Optional microphone bass analysis with smoothing
  - Optional legacy MediaPipe hand tracking with calibration and pose mapping
- Legacy dock/template modules remain in-repo for compatibility and future reuse, but are not active in the root UI.

## Runtime Layers

- `src/contracts/*` frozen shared interfaces.
- `src/core/*` deterministic render/time loop.
- `src/engines/*` input subsystems (audio/midi/webcam/model), each with mock mode.
- `src/modulators/*` deterministic signal routing to params.
- `src/templates/*` visual templates implementing `VisualizerTemplate`.
- `src/ui/*` dock layout, panels, and schema-driven controls.
- `src/presets/*` persistence and migration.
- `src/export/*` zip/embed export.

## Control Routing

- Parameter control routing uses modulators in two classes:
  - Auto bindings (`id` prefixed with `auto:`) created by per-parameter UI toggles.
  - Manual modulators edited in the bottom dock.
- Auto bindings are grouped by target parameter and resolved first, supporting additive MIDI + motion + audio control.
- Manual numeric modulators run after auto bindings for advanced stacking.
- Non-numeric target mappings are deterministic:
  - `boolean`: threshold at `0.5`
  - `select`: normalized option index
  - `color`: deterministic HSL hue mapping

## Determinism

- RNG uses seeded utility only.
- Templates update from `TemplateRuntime.loopT`.
- Visual snapshots use fixed seed/time/resolution.

## Presets

- Preset manager now seeds 30 factory presets (6 per template) into local storage when missing.
- User presets with the same name override factory entries.
