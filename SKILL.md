---
name: vibeviz-skill-guide
description: Stable, deterministic, and testable workflow guide for the VibeViz Three.js visualizer. Use when implementing, testing, reviewing, or documenting visualizer features while preserving contracts, determinism, and merge discipline.
---

# VibeViz Skill Guide (for AI Agents / Codex)

## Prime directive
Ship a stable, deterministic, testable visualizer generator. No drifting requirements. No contract breakage.

## Non-negotiables
- Do not edit `src/contracts/*` unless task explicitly requires it.
- Keep code deterministic: visuals depend only on (seed, loopT, params, audio/midi/motion inputs).
- Every new module must include:
  1) typed interfaces
  2) at least one unit test OR an e2e assertion
  3) doc update in `/docs/*` if behavior changes

## Determinism rules
- Any randomness must use seeded RNG.
- Looping must use `loopT` (0..1), not raw time.
- Visual snapshot tests must use fixed seed + fixed time.

## Testing rules
- Unit tests (Vitest): math, mapping, stores, preset roundtrips.
- E2E (Playwright): panel toggles, preset load, export click.
- Visual regression: render 3 templates with fixed seed/time and compare screenshot baselines.
- Hardware-dependent systems (MIDI/Webcam) must have mock mode.

## Definition of Done (DoD)
A task is done when:
- `pnpm verify` passes locally
- no console errors in dev
- feature works in Chrome
- docs updated if any new behavior/UI is added

## Coding standards
- TypeScript strict, no `any` unless isolated and justified
- Single responsibility modules
- Prefer pure functions for mapping/curves
- Avoid hidden global state
- Handle permissions (audio/midi/webcam) gracefully

## Merge protocol (multi-agent)
- Each agent works in a dedicated branch:
  `agent/<area>/<short-name>`
- Touch only files in your ownership list.
- If you must change shared code, open a small PR and tag `needs-architect`.
- Provide a short PR note:
  - What changed
  - How to test
  - Screenshots if UI changed

## Quick troubleshooting
- If FPS tanks, reduce density, disable postFX, and add LOD.
- If audio analysis is noisy, add envelope smoothing and clamp outputs.
- If visual tests are flaky, fix timebase + resolution + seed and avoid reading wall-clock.
