---
name: display-test-harness
description: The ten per-display testEnv.ts harnesses and their divergent session shims — what the duplication has already cost, and the three homes a shared one could take. Read before writing an eleventh, or before unifying them.
---

# One display test harness instead of ten

Every display plugin builds its own headless harness — a `PluginManager`, a
track type, a display type, a real `LinearGenomeView`, and a stub session with a
mocked `rpcManager` — in a file called `testEnv.ts`. There are **13 of them,
2,107 lines**, of which three (the variants sub-displays) are thin re-exports of
a sibling, so **ten are real**.

This is not a tidiness observation. The duplication has produced two systemic
failures already, both of the kind this repo hunts: silent, wide, and invisible
in any one file.

## What it has already cost

- **Nine harnesses muted every display-contract check.** They set
  `console.error = jest.fn()` as copied boilerplate, which is the channel
  `assertDisplayContract` and `makeRetryContractCheck` report through — so the
  checks ran, in exactly the suites that build real displays, and nothing could
  hear them. Removed 2026-08 (DISPLAYCHROME.md §"The retry contract"), and the
  ten-line comment explaining why now appears verbatim in each harness, which is
  the same copy under a different name.
- **Twenty-one of twenty-eight session shims were missing
  `getDisplayTypeDefault`**, several for display types that already had
  promotable slots. DISPLAY_TYPE_DEFAULTS.md §"Historical note" names the root
  cause exactly: *"tsc catches nothing here, because unit-test session fakes are
  bare `types.model({…})` shims that are never annotated as
  `AbstractSessionModel`. A missing member surfaces only as a runtime
  `TypeError` inside a MobX reaction."*

## The divergence, measured

Which session members each harness happens to stub, 2026-08-15:

<!-- prettier-ignore -->
| harness | lines | getDisplayTypeDefault | setDisplayTypeDefault | getCanonicalRefName2 | getGeneticCodeId | palette | themeOptions | notify | notifyError | queueDialog |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `arc/shared` | 151 | Y | | | Y | | | Y | Y | Y |
| `canvas/LinearBasicDisplay` | 305 | Y | Y | | Y | | | Y | Y | Y |
| `canvas/LinearMultiRowFeatureDisplay` | 193 | Y | | | | | | Y | Y | Y |
| `gwas/LinearManhattanDisplay` | 208 | Y | Y | | | | | Y | Y | Y |
| `hic/LinearHicDisplay` | 148 | Y | | Y | Y | | | Y | Y | Y |
| `linear-comparative-view/LGVSyntenyDisplay` | 236 | Y | Y | | | | | Y | | |
| `maf/LinearMafDisplay` | 217 | Y | | | | Y | | Y | Y | Y |
| `variants/shared` | 164 | Y | | Y | Y | Y | | Y | Y | Y |
| `wiggle/LinearWiggleDisplay` | 187 | Y | | | | | | Y | Y | Y |
| `wiggle/MultiLinearWiggleDisplay` | 237 | Y | Y | | | | | Y | Y | Y |

`palette` is stubbed by two of ten and `themeOptions` by none, while
ARCHITECTURE.md §"Theme-derived render inputs" makes `session.palette` the
render input every display's color getters read. Nothing is failing today
because no test in those suites reaches a palette getter; the point is that
which harnesses can is decided by nothing.

**The shape is one model repeated.** Each declares the same
`types.model({ name, view, configuration })` with the same `rpcManager` /
`assemblyManager` volatiles, the same `getTrackById`, the same `setView`, and
the same `createDisplay()` that sets a width and one displayed region. What
genuinely differs per display is the plugin registration — track type name,
display type name, adapter capabilities — and the assembly extent.

## Why it has not been fixed, and what would have to be decided

HiC's harness says out loud what everyone assumed: *"A third copy of the same
shape as canvas's and variants' harnesses, kept local rather than shared:
hoisting it would make one plugin's tests depend on another's test utilities for
the sake of ~40 lines of registration."* That was a reasonable call at three
copies. It is the tenth now, the 40 lines are ~150, and the reasoning has an
answer the repo already accepts — ARCHITECTURE.md §"Workspace tiers" allows a
test-only edge, and `@jbrowse/web`'s `createTestSession` is the precedent.

**The open question is the home, and each option has a real cost:**

- **A new private `packages/display-test-utils`.** The obvious shape, and it
  cannot hold the whole harness: the session wraps a real
  `linearGenomeViewStateModelFactory`, which lives in `plugins/*`, and a
  `packages/*` dependency on a plugin is the tier inversion
  `scripts/workspaceLayering.test.ts` pins. It could hold the *session model*
  alone, with the view passed in.
- **A subpath of `@jbrowse/plugin-linear-genome-view`.** Every consumer already
  depends on it. But the plugin has no `exports` map (`main: src/index.ts`), so
  the helper either joins the public barrel — test code in a plugin's published
  surface — or is reached by a deep `/src/` import, which is the shape
  `no-restricted-imports` and `noMockFromSrc` exist to discourage.
- **Leave the registration per plugin and share only the session.** The
  narrowest version, and it is the part that has actually drifted. It closes the
  `AbstractSessionModel` hole (one annotated shim, checked once) without moving
  anything that legitimately differs.

The third is the recommendation. The first two spend a packaging decision on the
half that was never the problem.

## What "done" looks like

One session shim, **annotated as `AbstractSessionModel`** so a member added to
that interface is a compile error in one place rather than a runtime `TypeError`
in whichever suite happens to reach it — which is the whole failure this
replaces. The ten harnesses keep their registrations and lose ~50 lines each.

Do not reinstate a blanket `console.error` silencer while doing it; capture and
assert on the channel instead, the way `assertDisplayContract.test.ts` does.
