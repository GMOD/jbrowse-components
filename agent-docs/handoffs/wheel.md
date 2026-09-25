---
name: wheel
description: Report from the wheel-zoom fix: eased notches, the full requested zoom at any spin speed, and a 1.8x Ctrl+wheel notch.
---

test mouse wheel performance

It's landed on local main as three commits: the wheel-zoom fix plus the two doc updates in INTERACTION_PERF.md and GPU_CONTEXT_BUDGET.md. It fast-forwarded cleanly, and I removed the worktree and branch. Nothing is pushed yet.

Once it's in, wheel zoom behaves differently in three ways:

- Mouse notches ease over about 80ms instead of jumping in one frame.
- You get the full zoom you asked for, whatever the spin speed or frame rate.
- A single Ctrl+wheel notch zooms 1.8× instead of 1.2×.

On the checks, the 46 wheel-zoom tests passed after the final rebase and pnpm verify passed with typecheck. One related suite, installPerRegionFetchAutoruns.test.ts, fails the same way on main without this change, so I left it alone.
