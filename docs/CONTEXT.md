# VibeViz Context

VibeViz is a deterministic Three.js visualizer generator with a TouchDesigner-lite workflow.

## Binding Policy

The root [SKILL.md](../SKILL.md) is binding policy for all contributors and agents.
Execution continuity files:
- Stage checklist: [IMPLEMENTATION_STAGES.md](./IMPLEMENTATION_STAGES.md)
- Running log: [PROGRESS_LOG.md](./PROGRESS_LOG.md)

Required on every PR:
- Keep visuals deterministic (`seed`, `loopT`, params, and engine inputs only).
- Do not change `src/contracts/*` without Architect approval and `CONTRACT_CHANGE` tag.
- Add typed interfaces for new modules.
- Add at least one unit test or e2e assertion for new behavior.
- Update docs in `docs/*` for behavior/UI changes.

## Definition of Done

- `pnpm verify` passes.
- No console errors in dev.
- Works in Chrome.
- Docs updated where behavior changes.

## Current Status (2026-02-26)

- Upstream reconciliation branch is active: `agent/reconcile/local-snapshot`.
- Local clean-clone verification is green via `pnpm verify`.
- Remaining quality follow-up: explicit e2e scenario for model upload + mock MIDI/Webcam behavior in one flow.
