# Testing Strategy

## Commands

- `pnpm test` for unit tests (Vitest).
- `pnpm e2e` for Playwright smoke, preset, and visual regression tests.
- `pnpm verify` runs typecheck, lint, unit, e2e, and build.

## Deterministic Visual Regression

- Fixed resolution: `1280x720`
- Fixed seed: `1337`
- Fixed loop duration: `4s`
- Fixed sample time: `t=1.0s`

Hardware-dependent systems must support mock mode for tests.
