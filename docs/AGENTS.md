# Agent Ownership

Root [SKILL.md](../SKILL.md) is binding policy.

## Frozen Contracts

- `src/contracts/*` is architect-owned.
- Contract changes require a dedicated PR tagged `CONTRACT_CHANGE` and architect approval.

## Branching

- Use `agent/<area>/<short-name>` branches.
- Touch only owned paths.
- Shared code changes require small PR tagged `needs-architect`.

## PR Checklist

- What changed
- How to test
- Screenshots (if UI changed)
- Tests added or updated
- Docs updated (if behavior/UI changed)

## Stage Tracking Requirements

- Use [IMPLEMENTATION_STAGES.md](./IMPLEMENTATION_STAGES.md) as the authoritative stage checklist.
- Append every meaningful execution step to [PROGRESS_LOG.md](./PROGRESS_LOG.md).
- Before handing off to another agent, update both files with current status and blockers.
