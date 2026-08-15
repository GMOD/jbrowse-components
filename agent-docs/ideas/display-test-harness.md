---
name: display-test-harness
description: The ten per-display testEnv.ts harnesses and their divergent session shims — what the duplication has cost, and the three homes a shared one could take. Read before writing an eleventh, or before unifying them.
---

# One display test harness instead of ten

Every display plugin builds its own headless harness — a `PluginManager`, a track
type, a display type, a real `LinearGenomeView`, and a stub session with a mocked
`rpcManager` — in a `testEnv.ts`. **13 files, 2,107 lines**; three are thin
re-exports of a sibling, so ten are real copies of one shape.

It has produced two systemic failures, both silent and wide:

- **Nine harnesses muted every display-contract check**, by copying
  `console.error = jest.fn()` — the channel `assertDisplayContract` and
  `makeRetryContractCheck` report through (DISPLAYCHROME.md §"The retry
  contract").
- **Twenty-one of twenty-eight session shims were missing
  `getDisplayTypeDefault`.** DISPLAY_TYPE_DEFAULTS.md §"Historical note" names
  the cause: the shims are never annotated as `AbstractSessionModel`, so tsc
  catches nothing and a missing member surfaces as a runtime `TypeError` inside
  a MobX reaction.

## The divergence, measured

Session members each harness happens to stub, 2026-08-15:

<!-- prettier-ignore -->
| harness | lines | getDisplayTypeDefault | setDisplayTypeDefault | getCanonicalRefName2 | getGeneticCodeId | palette | themeOptions | notifyError | queueDialog |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `arc/shared` | 151 | Y | | | Y | | | Y | Y |
| `canvas/LinearBasicDisplay` | 305 | Y | Y | | Y | | | Y | Y |
| `canvas/LinearMultiRowFeatureDisplay` | 193 | Y | | | | | | Y | Y |
| `gwas/LinearManhattanDisplay` | 208 | Y | Y | | | | | Y | Y |
| `hic/LinearHicDisplay` | 148 | Y | | Y | Y | | | Y | Y |
| `linear-comparative-view/LGVSyntenyDisplay` | 236 | Y | Y | | | | | | |
| `maf/LinearMafDisplay` | 217 | Y | | | | Y | | Y | Y |
| `variants/shared` | 164 | Y | | Y | Y | Y | | Y | Y |
| `wiggle/LinearWiggleDisplay` | 187 | Y | | | | | | Y | Y |
| `wiggle/MultiLinearWiggleDisplay` | 237 | Y | Y | | | | | Y | Y |

`palette` is stubbed by two of ten and `themeOptions` by none, while
`session.palette` is the render input every display's color getters read
(ARCHITECTURE.md §"Theme-derived render inputs"). Nothing fails today; which
harnesses *could* reach a palette getter is decided by nothing.

Each declares the same `types.model({ name, view, configuration })`, the same
`rpcManager` / `assemblyManager` volatiles, `getTrackById`, `setView`, and a
`createDisplay()` that sets a width and one region. What genuinely differs is the
plugin registration and the assembly extent.

## The open question is the home

HiC's harness says the reasoning: *"kept local rather than shared: hoisting it
would make one plugin's tests depend on another's test utilities for the sake of
~40 lines of registration."* Fair at three copies; it is the tenth, the 40 lines
are ~150, and ARCHITECTURE.md §"Workspace tiers" already allows a test-only edge
(`@jbrowse/web`'s `createTestSession` is the precedent).

- **A private `packages/display-test-utils`** cannot hold the whole harness: the
  session wraps `linearGenomeViewStateModelFactory`, which lives in `plugins/*`,
  and a `packages/*` dependency on a plugin is the inversion
  `scripts/workspaceLayering.test.ts` pins. It could hold the session alone.
- **A subpath of `@jbrowse/plugin-linear-genome-view`**, which every consumer
  already depends on — but it has no `exports` map, so the helper either joins
  the public barrel or is reached by a deep `/src/` import.
- **Share only the session shim.** The narrowest, and the part that has actually
  drifted.

The third is the recommendation; the first two spend a packaging decision on the
half that was never the problem.

## Done looks like

One session shim **annotated as `AbstractSessionModel`**, so a member added to
that interface is a compile error in one place rather than a runtime `TypeError`
in whichever suite reaches it. The ten harnesses keep their registrations and
lose ~50 lines each.

Don't reinstate a blanket `console.error` silencer on the way; capture and assert
on the channel, as `assertDisplayContract.test.ts` does.
