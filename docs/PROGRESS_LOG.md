# PARTICLE WIZARD Progress Log

Keep entries chronological. Each entry should capture:
- Date/time (UTC)
- Stage + step reference
- What changed
- Verification performed
- Open blockers or follow-ups

---

## 2026-02-26 00:00 UTC - Bootstrap Start

- Stage: 0
- Completed:
  - Created repository skeleton and ownership-aligned directories.
  - Added core project configs (Vite/TS/Vitest/Playwright/ESLint/Prettier).
  - Added governance docs and CI workflow.
  - Added frozen contracts exactly in `src/contracts/types.ts` and `src/contracts/schema.ts`.
- Verification:
  - File tree inspected and confirmed.
- Blockers:
  - Node/pnpm tooling unavailable, so no command-based verification yet.

## 2026-02-26 00:20 UTC - Core + Feature Scaffold

- Stage: 1-5 (scaffold pass)
- Completed:
  - Implemented core runtime modules, engines, templates, modulators, presets, exporter.
  - Implemented React app shell with dock layout, panels, store, debug overlay.
  - Added unit and e2e test scaffolding including deterministic visual snapshot spec.
- Verification:
  - Static file inspection across all expected paths.
- Blockers:
  - `pnpm`, `node`, `npm`, and `corepack` commands unavailable in environment.
  - Automated typecheck/lint/test/e2e not yet executed.

## 2026-02-26 00:35 UTC - Continuity Tracking Added

- Stage: cross-cutting governance
- Completed:
  - Added `docs/IMPLEMENTATION_STAGES.md` as canonical stage checklist.
  - Added this `docs/PROGRESS_LOG.md` for resumable handoffs across agents.
- Verification:
  - Files created and referenced for future updates.
- Follow-ups:
  - Update both files at every stage transition and after each verification run.

## 2026-02-26 00:45 UTC - Continuity + Feature Patch Follow-up

- Stage: 4-5 + governance
- Completed:
  - Wired model upload path into UI and renderer template init flow.
  - Added export panel \"Copy Embed\" action.
  - Updated build script to run `tsc --noEmit` before Vite build.
  - Reinforced continuity policy references in `docs/CONTEXT.md` and `docs/AGENTS.md`.
- Verification:
  - Static diff/inspection completed for updated files.
- Blockers:
  - Automated command verification still blocked by missing Node/pnpm tooling.
  - Git not available, so branch/merge protocol commands cannot be executed in this environment.

## 2026-02-26 00:55 UTC - Handoff Continuity Checkpoint

- Stage: cross-stage documentation
- Completed:
  - Confirmed continuity requirements are now enforced in `docs/AGENTS.md`.
  - Confirmed stage checklist and progress log are linked from `docs/CONTEXT.md`.
  - Added missing model upload and embed-copy feature wiring in app UI flow.
  - Added extra verification scaffolds: `tests/e2e/export.spec.ts`, `tests/unit/modelEngine.test.ts`.
- Verification:
  - Required file checklist completed (`REQUIRED_FILES_OK`).
  - Governance references verified with targeted text search.
- Blockers:
  - Runtime verification remains pending until Node/pnpm/git are available.

## 2026-02-26 17:17 UTC - Feature Expansion: Model Reload, Auto Controls, Gradients, and Factory Presets

- Stage: 4-5 + docs/tests
- Completed:
  - Added explicit GLB load/reload flow in template panel with selected/loaded status telemetry.
  - Implemented mesh-only GLB sanitization and texture stripping in `ModelEngine`.
  - Added per-parameter controller bindings for MIDI/Webcam/Audio (with per-param MIDI CC and per-param audio source).
  - Introduced deterministic auto-modulator IDs (`auto:<param>:<source>`) and integrated non-number modulation mapping in `ModulatorEngine`.
  - Added radial gradient system (2-5 stops) to all templates with standardized params (`gradientStops`, `color`..`color5`).
  - Added 30 factory presets and bootstrap seeding in `PresetManager`.
  - Updated unit/e2e coverage for gradients, model sanitization, auto modulation mapping, preset seeding, and new UI controls.
  - Updated architecture/UI docs and implementation stage tracking.
- Verification:
  - `npm run typecheck` passes.
  - `npm run test -- --run` passes (20 tests).
  - `npm run build` passes.
  - `npm run e2e` partially passes: smoke/export/preset tests pass; visual snapshot suite fails due missing baselines and one pointCloud snapshot timeout.
- Blockers:
  - Lint baseline still fails due pre-existing global-env ESLint config issues (`no-undef` across browser/Node globals).
  - Visual snapshot baselines need to be accepted/committed, and pointCloud snapshot stabilization needs follow-up.

## 2026-02-26 17:22 UTC - Draco GLB Decode Support

- Stage: 4 model pipeline
- Completed:
  - Added `DRACOLoader` integration in `ModelEngine` and attached it to `GLTFLoader`.
  - Added local Draco decoder assets to `public/draco/gltf/`:
    - `draco_decoder.js`
    - `draco_decoder.wasm`
    - `draco_wasm_wrapper.js`
  - Switched from eager decoder preload to lazy decode initialization to avoid Node/jsdom test URL parsing errors.
- Verification:
  - `npm run typecheck` passes.
  - `npm run test -- tests/unit/modelEngine.test.ts --run` passes.

## 2026-02-27 03:20 UTC - Dual Palm Calibration Overlay

- Stage: root wizard UX + hand calibration telemetry
- Completed:
  - Replaced circular webcam calibration marker with dual open-palm SVG outlines in `src/ui/App.tsx` and `src/styles.css`.
  - Added mirrored dual-palm target evaluation helpers in `src/wizard/math.ts` (`mirrorWebcamX`, `evaluateDualPalmTargets`).
  - Updated `HandWizardController` dual calibration gating to use per-palm target readiness booleans while preserving the 1.2s hold.
  - Extended `HandDebugInfo` telemetry with `leftTargetReady` and `rightTargetReady` and propagated defaults through runtime HUD state.
  - Updated calibration guidance text to reference the new outlines.
  - Added unit coverage for target matching math and controller hold/reset behavior in:
    - `tests/unit/wizardMath.test.ts`
    - `tests/unit/handWizardController.test.ts`
  - Updated UI behavior documentation in `docs/UI_SPEC.md`.
- Verification:
  - `npm run typecheck` passes.
  - `npm run build` passes.
  - `npm run test -- --run` passes (36 tests).
- Blockers:
  - None at implementation level.

## 2026-02-27 00:20 UTC - Wizard Edge Gestures + Pro HUD Expansion

- Stage: 4-5 wizard runtime/UI pass
- Completed:
  - Added deterministic edge-sweep camera gesture module (`src/wizard/edgeGestures.ts`) with mirrored-space mapping, strict side-hand gating, deadzone handling, and dual-axis corner behavior.
  - Integrated edge gesture telemetry into `ParticleWizardRuntime` and applied camera target updates with hand-priority over mouse drag during active gestures.
  - Expanded runtime/public HUD state with mic sensitivity/level, edge telemetry, and camera debug telemetry.
  - Added direct mode selection API and expanded morph modes from 5 to 10 (including Klein, Helix, Gyroid, Superformula, Wave Knot) in both shader logic and math helper parity.
  - Upgraded `MicAnalyzer` with explicit `stop()` release behavior and adjustable sensitivity multiplier.
  - Rebuilt active wizard UI controls in `src/ui/App.tsx`:
    - top-right advanced controls (palette, visual tuning, mode selector, gesture sensitivity, camera response, performance sliders)
    - mic short-click toggle + long-press sensitivity popout
    - debug toggle and full telemetry panel in bottom-right
    - webcam preview moved to bottom-left and scaled to 2x desktop size
  - Updated CSS layout to match requested panel placement and responsive behavior.
  - Wired query defaults (`glow`, `threshold`, `gain`, `primary`, `secondary`, `accent`) and changed debug default to ON unless `debug=0`.
  - Added/updated tests:
    - `tests/unit/edgeGestures.test.ts` (new)
    - `tests/unit/micAnalyzer.test.ts` (new)
    - `tests/unit/wizardMath.test.ts` mode coverage extended to 0..9
    - `tests/e2e/smoke.spec.ts` layout assertions for advanced panel/webcam/debug
    - `tests/e2e/export.spec.ts` mic toggle, long-press slider, and color input assertion
  - Updated docs: `docs/UI_SPEC.md`, `docs/ARCHITECTURE.md`.
- Verification:
  - Static inspection and cross-file wiring validation completed.
- Blockers:
  - Local test execution currently blocked because `vitest` binary is unavailable in environment (`npm run test` fails before suite execution).

## 2026-02-27 03:36 UTC - Fullscreen/Hotkeys + FPS/Particle Sliders

- Stage: 1 wizard runtime/UI controls
- Completed:
  - Added fullscreen and performance constants/API in `src/wizard/ParticleWizardRuntime.ts`:
    - `FPS_CAP_MIN/MAX/DEFAULT`
    - `PARTICLE_COUNT_MIN/MAX/DEFAULT`
    - `setTargetFps()` and `setParticleCount()`
  - Extended wizard HUD state with `targetFps` and replaced static particle count wiring with runtime state.
  - Implemented frame-cap throttling based on target FPS and removed the old `60` FPS HUD clamp.
  - Updated particle buffer construction to rebuild safely at runtime while preserving active mode/morph/uniform context.
  - Wired global hotkeys in `src/ui/App.tsx`:
    - `M` toggles control/info visibility
    - `F` toggles browser fullscreen
  - Added fullscreen-change synchronization and fullscreen button (`data-testid="fullscreen-btn"`).
  - Added live sliders (`data-testid="fps-slider"`, `data-testid="particle-slider"`) for `60..240` FPS and `1,000..100,000` particles.
  - Applied clean-view behavior so HUD, webcam, and status are hidden when controls are off or fullscreen is active.
  - Added/updated e2e coverage:
    - updated `tests/e2e/smoke.spec.ts`
    - new `tests/e2e/fullscreenAndPerformance.spec.ts`
  - Updated docs continuity files:
    - `docs/UI_SPEC.md`
    - `docs/IMPLEMENTATION_STAGES.md`
- Verification:
  - `npm run typecheck` passes.
  - `npm run e2e -- --output playwright-results-temp tests/e2e/smoke.spec.ts tests/e2e/fullscreenAndPerformance.spec.ts` passes (2/2).
- Blockers:
  - Default Playwright output file `playwright-results/.last-run.json` is permission-locked in this environment; tests were run with alternate output directory.

## 2026-02-27 00:45 UTC - Verification Follow-up for Wizard Edge/HUD Pass

- Stage: verification follow-up
- Completed:
  - Installed dependencies and re-ran validation after implementation.
- Verification:
  - `npm run typecheck` passes.
  - `npm run test -- --run` passes (14 files, 36 tests).
  - `npm run build` passes.
  - `npm run e2e -- tests/e2e/smoke.spec.ts tests/e2e/export.spec.ts --list` passes (tests discovered and parsed).
- Blockers:
  - Full Playwright execution remains blocked in this environment by Windows `EPERM` file/process permission errors in Playwright output directories and worker process spawn/cleanup.

## 2026-02-27 03:40 UTC - Persistent Palm Overlay + Live Recalibration

- Stage: wizard hand calibration UX refinement
- Completed:
  - Widened dual-palm calibration targets to `x=0.36` (left) and `x=0.64` (right) in mirrored display space.
  - Added explicit overlay opacity constants and switched runtime behavior to keep palm outlines faintly visible (`0.22`) after first dual calibration.
  - Implemented active dual-mode live recalibration hold (`1.5s`) with latch protection to avoid repeated neutral recapture during a continuous hold.
  - Kept initial dual activation timing unchanged at `1.2s`.
  - Updated webcam overlay positioning to fixed target anchors (36% / 64%) instead of center-gap layout.
  - Expanded hand calibration unit coverage for widened targets, persistent faint overlay behavior, live recalibration recapture, and latch re-arm behavior.
  - Updated UI/stage docs to reflect persistent overlay and live recalibration rules.
- Verification:
  - `npm run typecheck` passes.
  - `npm run test -- --run` passes (14 files, 38 tests).
  - `npm run build` passes.
- Blockers:
  - None for this change set.

## 2026-02-27 04:12 UTC - Hand Skeleton Debug Overlay

- Stage: wizard hand calibration UX refinement
- Completed:
  - Extended tracked hand payloads in `HandWizardController` to carry optional `landmarks` for debug rendering.
  - Added a mirrored green hand skeleton overlay in webcam UI (`src/ui/App.tsx`) for tracked hands:
    - one SVG per tracked hand,
    - explicit MediaPipe stick connections,
    - left/right debug hooks via `data-testid` (`left-hand-skeleton`, `right-hand-skeleton`),
    - visibility tied to tracked palms in debug payload.
  - Added styling for glowy neon-green stick lines and joints in `src/styles.css`.
  - Added unit coverage for landmark passthrough in `tests/unit/handWizardController.test.ts` and updated target math coverage in `tests/unit/wizardMath.test.ts`.
- Verification:
  - `npm run typecheck` could not be completed due pre-existing `ParticleWizardRuntime.ts` type regressions in this branch.
  - `npm run test -- --run` / `npm run build` blocked by environment/runtime issues unrelated to this overlay change.

## 2026-02-27 18:10 UTC - Aggressive Prune + Tasks Migration + Runtime Performance Pass

- Stage: root runtime hardening / housekeeping
- Completed:
  - Fixed particle shader visibility path in `ParticleWizardRuntime` by moving visibility discard logic out of vertex shader compilation failure path.
  - Upgraded default runtime profile to high + adaptive:
    - default FPS cap to `144`
    - default particle count to `50,000`
    - adaptive auto-thresholds derived from current FPS cap
    - renderer `powerPreference: "high-performance"`
    - reduced per-frame allocations in hot path (reused center vectors)
  - Optimized mic analyzer frame loop by reusing FFT buffer allocations.
  - Migrated webcam hand tracking backend from legacy Hands script path to MediaPipe Tasks Vision adapter in `src/wizard/legacyMediaPipe.ts` (GPU preferred, CPU fallback).
  - Increased camera capture resolution to `640x480` and relaxed tracking confidence defaults for dual-hand stability.
  - Improved mirrored left/right palm assignment fallback logic in `wizard/math.ts` to avoid role inversion under label inconsistencies.
  - Per user-selected aggressive prune, removed legacy non-root source trees and non-wizard unit/e2e suites.
  - Regenerated `tests/e2e/visualSnapshots.spec.ts` baseline for the updated renderer output.
  - Removed unused runtime dependencies (`fflate`, `zustand`) and updated architecture/UI docs for single-path runtime.
  - Updated ESLint ignores/rules for generated assets and TypeScript `no-undef` false positives.
  - Updated `verify` script to use `npm run` chain in this environment.
  - Removed unused Draco decoder assets from `public/draco/*` after legacy model pipeline prune.
- Verification:
  - `npm run typecheck` passes.
  - `npm run lint` passes.
  - `npm run build` passes.
  - `npm run test -- --run` passes (3 files, 17 tests).
  - `npm run e2e:core` passes (3/3).
  - `npm run e2e` passes (4/4).
  - `npm run verify` passes end-to-end.
- Blockers:
  - None.

## 2026-02-27 19:10 UTC - Background Button Toggle + Hold Color Picker

- Stage: 1 wizard runtime/UI controls
- Completed:
  - Extended `ParticleWizardRuntime` HUD/public state with `backgroundStarsEnabled` and `backgroundColor`.
  - Added runtime APIs `toggleBackgroundStars()` and `setBackgroundColor()` with forced-black behavior when starfield is OFF.
  - Added renderer background application path to sync clear color + star visibility without rebuilding star geometry.
  - Added bottom `BACKGROUND` button in `src/ui/App.tsx` with:
    - short press starfield toggle
    - long press (`325ms`) background color popout
    - long-press suppression of short-press toggle
  - Added background color popout (`background-color-popout`, `background-color-input`) and responsive styles.
  - Updated e2e coverage:
    - `tests/e2e/smoke.spec.ts` checks `background-btn` visibility
    - `tests/e2e/export.spec.ts` checks short toggle, long-press popout, and color input update
  - Updated docs:
    - `docs/UI_SPEC.md`
    - `docs/ARCHITECTURE.md`
    - `docs/IMPLEMENTATION_STAGES.md`
- Verification:
  - `npm run typecheck` fails due pre-existing `HandWizardController` type errors unrelated to this feature.
  - `npm run e2e -- --list tests/e2e/smoke.spec.ts tests/e2e/export.spec.ts` passes (tests parse/list correctly).
  - Full Playwright execution blocked in this environment by Windows `EPERM` (`spawn EPERM` / `.last-run.json` lock).
- Blockers:
  - Environment-level Playwright process/file permission restrictions prevent full e2e execution.

## 2026-02-27 19:20 UTC - Webcam/Tracker Reliability Recovery

- Stage: wizard runtime resilience
- Completed:
  - Decoupled camera bootstrap from tracker bootstrap in `HandWizardController`.
  - Added explicit health telemetry fields:
    - `cameraState`
    - `trackingStateDetail`
  - Ensured tracker failures no longer hide webcam when camera stream is active.
  - Added tracker diagnostics via query:
    - `tracker=off`
    - `tracker=mockfail`
    - `tracker=remote`
  - Upgraded `legacyMediaPipe` loader contract to typed load result with error codes:
    - `assets-load-failed`
    - `model-load-failed`
    - `runtime-error`
    - `disabled`
  - Implemented local-first MediaPipe asset resolution (`/mediapipe/*`) with optional remote fallback.
  - Added deterministic e2e scenario for tracker-off behavior in `tests/e2e/smoke.spec.ts`.
  - Expanded unit coverage for init-time camera/tracker success and failure states.
  - Updated architecture and UI docs for decoupled camera/tracker behavior and diagnostics.
- Verification:
  - Pending.
- Blockers:
  - Local mediapipe binaries are expected in `public/mediapipe/*`; environment is offline so assets were not fetched automatically in this pass.

## 2026-02-27 19:55 UTC - 11th Mode `PARTICLE HANDS` (Per-Finger + Ghost Fade)

- Stage: 1 wizard runtime/UI controls + hand telemetry refinement
- Completed:
  - Added 11th runtime mode label `PARTICLE HANDS` and kept existing transform cycling/dropdown behavior.
  - Added deterministic finger-curl primitives in `src/wizard/math.ts`:
    - `FingerCurls`
    - `createZeroFingerCurls()`
    - `computeFingerCurls()`
    - `smoothFingerCurls()`
  - Extended `computeModePosition()` parity coverage to include mode `10` simplified particle-hand geometry.
  - Extended `HandWizardController` state and debug payloads with:
    - smoothed per-side finger curls (`mappedFingerCurlsLeft`, `mappedFingerCurlsRight`)
    - `singleRole` (`left`/`right`) with label-first resolution and mirrored-x fallback.
  - Added controller getters:
    - `getLeftFingerCurls()`
    - `getRightFingerCurls()`
    - `getSingleRole()`
  - Implemented single-hand side targeting (tracked side active, missing side smoothing toward neutral) and curl decay during degraded tracking.
  - Extended particle shader uniforms with:
    - `handFingerCurlsA` (thumb/index/middle/ring)
    - `handFingerCurlB` (pinky)
    - `handPresence`
  - Added shader branch `mode == 10` for stylized anatomical particle hands with per-finger curl articulation and flow noise.
  - Added runtime presence smoothing (`0.08`) and ghost alpha floor (`0.22`) for `PARTICLE HANDS` while forcing presence `1` outside hands mode.
  - Updated debug UI to show single-role and left/right curl telemetry.
  - Updated tests:
    - `tests/unit/wizardMath.test.ts` mode loop `0..10` + finger-curl cases
    - `tests/unit/handWizardController.test.ts` single-role and curl-decay coverage
    - `tests/e2e/export.spec.ts` mode count `11`, select `PARTICLE HANDS`, wrap to `SPHERICAL`.
  - Updated docs:
    - `docs/ARCHITECTURE.md`
    - `docs/UI_SPEC.md`
    - `docs/IMPLEMENTATION_STAGES.md`
- Verification:
  - `npm run typecheck` passes.
  - `npm run test -- --run` passes (3 files, 24 tests).
  - `npm run e2e -- --output playwright-results-temp tests/e2e/export.spec.ts` fails with Windows `EPERM` lock on `.last-run.json`.
  - Retry with isolated output (`playwright-results-hands11`) fails in this environment with `spawn EPERM`.
- Blockers:
  - Playwright execution is blocked in this environment by OS-level `EPERM` process/file permission errors.

## 2026-02-27 20:10 UTC - MediaPipe Availability Default Fallback + Local Override

- Stage: wizard runtime resilience
- Completed:
  - Extended tracker mode parsing in `src/wizard/query.ts` with `tracker=local`.
  - Updated runtime tracker mode unions to include `local` in:
    - `src/wizard/query.ts`
    - `src/wizard/HandWizardController.ts`
    - `src/wizard/ParticleWizardRuntime.ts`
  - Changed hand tracker boot behavior in `HandWizardController` to enable remote fallback by default (`allowRemoteFallback: trackerMode !== "local"`), while preserving:
    - `tracker=off` hard disable
    - `tracker=mockfail` forced bootstrap failure
  - Added unit coverage in `tests/unit/handWizardController.test.ts` to assert:
    - default mode calls loader with `allowRemoteFallback: true`
    - local mode calls loader with `allowRemoteFallback: false`
  - Added `tests/unit/query.test.ts` covering tracker parsing for `default`, `local`, `remote`, `off`, and `mockfail`.
  - Updated docs to reflect the new default behavior and diagnostics:
    - `docs/ARCHITECTURE.md`
    - `docs/UI_SPEC.md`
    - `public/mediapipe/README.md`
    - `docs/IMPLEMENTATION_STAGES.md`
- Verification:
  - `npm run typecheck` passes.
  - `npm run test -- tests/unit/query.test.ts tests/unit/handWizardController.test.ts --run` passes (2 files, 19 tests).
  - `npm run test -- --run` passes (4 files, 31 tests).
  - `npm run build` passes.
- Blockers:
  - None.
