# Testing Strategy

## Commands

- `pnpm test` for unit tests (Vitest).
- `pnpm e2e` for Playwright smoke/control behavior and visual regression tests.
- `pnpm verify` runs typecheck, lint, unit, e2e, and build.

## Deterministic Visual Regression

- Fixed resolution: `1280x720`
- Fixed seed: `1337`
- Fixed sample time: `t=1.0s`
- Test URL uses `?testMode=1` to avoid hardware prompts for mic/webcam in CI.

Hardware-dependent systems must support mock mode for tests.
