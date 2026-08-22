---
name: test-session-fixture-cost
description: 65 test suites pay ~5s each to import `createTestSession`, and the cost is module load rather than the call — but the fast fixture is also a second way to build a session, which is the thing `createTestSession` exists to prevent. The measurement is done; what is parked is whether the fix is worth its own risk.
---

# The cost of importing createTestSession

Moved out of [TODO.md](../TODO.md) on 2026-08-22. It sat in the backlog's
small-and-self-contained section on the strength of its measurement, which is
solid — but the measurement is not the open question, and the open question is
whether to build anything at all. That is an idea, not an action item.

## The measurement

Taken 2026-08-22, warm jest cache, one worker: an empty suite is 2.0s, a suite
whose only body is `import { createTestSession } from '@jbrowse/web/testUtils'`
is 6.7s. Cold it is 12.6s. The calls themselves are not the cost —
`createTestSession()` is ~25ms after the first — so the nine-test
`PluginStoreWidget` suite spends essentially all of its 10.6s on module load.

`test_util.ts` imports `../corePlugins.ts`, so every suite that wants a session
evaluates the whole web plugin set, and jest gives each suite a fresh module
registry so none of it is shared. 65 suites import it
(`grep -rl "@jbrowse/web/testUtils"`), which is where a meaningful slice of the
wall clock goes.

## Why it is parked

A fixture that builds a session from only the plugins a suite names would be
fast, and would also be **a second way to build a session that can drift from
the real one** — which is the thing `createTestSession` exists to prevent. The
suites that would adopt it are exactly the ones testing plugin-facing behaviour,
where a session assembled differently from the app's own is the failure mode
nobody notices until it hides a real break.

So the trade is wall-clock against a fixture that can lie, and nobody has
argued the first is worth the second. If it is ever taken, the shape is a
`createTestSession({ plugins })` overload **sharing one code path**, not a
parallel helper — a second entry point with its own assembly is the version that
drifts.

## Not the flake it looks like

The `findByText` timeouts this used to produce were testing-library's own 1s
`asyncUtilTimeout`, now 5s in `config/jest/testingLibraryTimeout.js`
(`84ad6bd1a2`). That stopped the failures; it did not make the import cheaper,
and it is why the slow import no longer shows up as anything but wall clock.
