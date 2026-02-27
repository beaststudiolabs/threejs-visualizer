# Architecture

## Current Root Experience

- `/` runs the shader-driven Particle Wizard app (`src/wizard/*` + `src/ui/App.tsx`).
- Core runtime responsibilities in `ParticleWizardRuntime`:
  - Three.js scene/camera/render loop
  - GLSL particle simulation and morphing across 11 spatial modes
  - Postprocessing chain (`EffectComposer`, bloom, afterimage trails)
  - Background clear color + starfield visibility state
  - Optional microphone bass analysis with toggle + sensitivity
  - MediaPipe Tasks hand tracking with calibration and pose mapping
  - Per-finger hand curl mapping for the `PARTICLE HANDS` mode (thumb/index/middle/ring/pinky)
  - Hand-presence smoothing for single-hand ghost fade behavior in `PARTICLE HANDS`
  - Single active runtime path only (legacy dock/template stack removed)

## Runtime Layers

- `src/ui/App.tsx` React HUD and controls for the active wizard experience.
- `src/wizard/ParticleWizardRuntime.ts` scene/render loop, shader system, post FX, adaptive performance.
- `src/wizard/HandWizardController.ts` calibration state machine and hand intent mapping.
- `src/wizard/legacyMediaPipe.ts` MediaPipe Tasks compatibility adapter with local-first asset bootstrapping and typed failure codes.
- `src/wizard/math.ts` deterministic mapping and calibration helpers.
- `src/wizard/MicAnalyzer.ts` optional microphone bass pump.
- `src/utils/rng.ts` deterministic seeded RNG.

## Camera Input Path

- Runtime camera input is mouse-first and intentionally excludes hand-edge gestures to keep orbit stable.
- Pointer drag updates camera targets directly:
  - `targetAz` from horizontal movement
  - `targetPol` from vertical movement
  - `targetDist` from wheel
- `HandWizardController` still drives sculpting offsets but no longer controls camera steering.
- Hand init is two-phase:
  - camera stream bootstrap
  - tracker bootstrap
- Camera and tracker are decoupled for resilience:
  - camera can stay active with tracker disabled/unavailable
  - UI emits explicit `cameraState` and `trackingStateDetail` diagnostics in HUD.

## MediaPipe Asset Boot Strategy

- Local files in `public/mediapipe/*` are primary source:
  - `vision_bundle.js`
  - `wasm/*`
  - `hand_landmarker.task`
- Remote fallback is optional and disabled by default; it is enabled only via query diagnostics (`tracker=remote`).

## Audio Path

- `MicAnalyzer` supports:
  - `start()` for activation
  - `stop()` for full release of stream/context
  - sensitivity scaling (`0..3`) for bass pump amount
- UI behavior:
  - short mic press toggles ON/OFF
  - long press opens sensitivity slider popout

## Background Controls Path

- `ParticleWizardRuntime` owns background state:
  - `backgroundStarsEnabled` toggle for starfield visibility
  - `backgroundColor` for clear color selection
- Effective background render behavior:
  - stars ON: renderer clear color uses `backgroundColor`
  - stars OFF: renderer clear color forced to `#000000`
- UI behavior:
  - short `BACKGROUND` press toggles starfield
  - long `BACKGROUND` press opens color picker popout

## Determinism

- RNG uses seeded utility only.
- Templates update from `TemplateRuntime.loopT`.
- Visual snapshots use fixed seed/time/resolution.
- Sculpting and camera behavior remain deterministic from seeded runtime timing and hand calibration state.

## Presets

- Factory preset/template export stack was removed as part of aggressive pruning.
