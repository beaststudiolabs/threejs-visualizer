# Architecture

## Current Root Experience

- `/` runs the shader-driven Particle Wizard app (`src/wizard/*` + `src/ui/App.tsx`).
- Core runtime responsibilities in `ParticleWizardRuntime`:
  - Three.js scene/camera/render loop
  - GLSL particle simulation and morphing across 10 spatial modes
  - Postprocessing chain (`EffectComposer`, bloom, afterimage trails)
  - Optional microphone bass analysis with toggle + sensitivity
  - Optional legacy MediaPipe hand tracking with calibration and pose mapping
  - Legacy dock/template modules remain in-repo for compatibility/future reuse, but are not active in the root UI.

## Runtime Layers

- `src/contracts/*` frozen shared interfaces.
- `src/core/*` deterministic render/time loop.
- `src/engines/*` input subsystems (audio/midi/webcam/model), each with mock mode.
- `src/modulators/*` deterministic signal routing to params.
- `src/templates/*` visual templates implementing `VisualizerTemplate`.
- `src/ui/*` React HUD and controls for the active wizard experience.
- `src/presets/*` persistence and migration.
- `src/export/*` zip/embed export.

## Camera Input Path

- Runtime camera input is mouse-first and intentionally excludes hand-edge gestures to keep orbit stable.
- Pointer drag updates camera targets directly:
  - `targetAz` from horizontal movement
  - `targetPol` from vertical movement
  - `targetDist` from wheel
- `HandWizardController` still drives sculpting offsets but no longer controls camera steering.

## Audio Path

- `MicAnalyzer` supports:
  - `start()` for activation
  - `stop()` for full release of stream/context
  - sensitivity scaling (`0..3`) for bass pump amount
- UI behavior:
  - short mic press toggles ON/OFF
  - long press opens sensitivity slider popout

## Determinism

- RNG uses seeded utility only.
- Templates update from `TemplateRuntime.loopT`.
- Visual snapshots use fixed seed/time/resolution.
- Sculpting and camera behavior remain deterministic from seeded runtime timing and hand calibration state.

## Presets

- Preset manager seeds 30 factory presets (6 per template) into local storage when missing.
- User presets with the same name override factory entries.
