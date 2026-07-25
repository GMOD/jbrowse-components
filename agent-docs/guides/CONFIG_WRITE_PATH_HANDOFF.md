---
name: config-write-path-handoff
description: Migrating the remaining raw configuration.setSlot call sites onto the typed setConf, which model factories gain the check, and the concurrency hazard. Read before touching config writes.
---

# Config write path handoff

Config **reads** are typo-checked. Config **writes** were not, and the write
side is the one config mistake with no diagnostic at any layer. `setConf` was
fixed in `4c8d5f06fd` and `LinearAlignmentsDisplay` was migrated as the proving
ground. Roughly 97 call sites remain.

## What was wrong, and why it is worth finishing

`getConf`'s slot param is constrained to
`ConfigurationSlotName<schema> | string[]`, where the array arm is for slot
paths. Any name outside the schema fails to satisfy that, so it is a hard
compile error. `setConf` carried `| string` instead of `| string[]`, and every
string satisfies `| string`, so it validated nothing. Dropping the stray arm
turned the check on at zero cost, because all 11 call sites that existed at the
time were already valid.

Most call sites did not use `setConf` at all. They called
`self.configuration.setSlot(...)` directly, which takes a plain `string`.

The runtime behaviour is what makes this worth chasing rather than filing as a
nit. Probed both layers on a real schema:

```
typo write threw:       NO          (setSlot does self[slotName] = value)
readback:               3           (lands on an undeclared property)
wrong-type write threw: YES         (MST does type-check the assignment)
featureHeight now:      7           (the real slot never moved)
```

So an unknown slot name fails at neither layer. Nothing throws, nothing
persists, and the correctly spelled `getConf` read keeps returning the default.
A one character slip in a slot name is a setting that silently does nothing,
forever. A wrong *value* type is not a concern, MST catches that at runtime.

## The migration

Mechanical. `self.configuration.setSlot('x', v)` becomes `setConf(self, 'x', v)`,
importing `setConf` from `@jbrowse/core/configuration`. For alignments this was a
single `perl -0pi -e "s/self\.configuration\.setSlot\(/setConf(self, /g"`
followed by `oxfmt` to reflow the few multi-line calls. All 46 names typechecked,
so nothing there was actually broken, but the file no longer reads through a
checked path while writing through an unchecked one.

**Checking only engages when the factory's `configSchema` param is concretely
typed.** Same lever as reads, see the "Config read type narrowing" section of
`packages/core/src/configuration/CLAUDE.md`. That splits the remaining sites into
three groups.

### Pinned, so migrating gains the check (79 sites)

| Sites | File |
| --- | --- |
| 23 | `plugins/maf/src/LinearMafDisplay/stateModel.ts` |
| 14 | `plugins/variants/src/LDDisplay/shared.ts` |
| 11 | `plugins/variants/src/shared/MultiSampleVariantBaseModel.ts` |
| 9 | `plugins/hic/src/LinearHicDisplay/model.ts` |
| 8 | `plugins/canvas/src/LinearMultiRowFeatureDisplay/model.ts` |
| 6 | `plugins/sequence/src/LinearReferenceSequenceDisplay/model.ts` |
| 4 | `plugins/wiggle/src/MultiLinearWiggleDisplay/model.ts` |
| 2 | `plugins/gwas/src/LinearManhattanDisplay/stateModelFactory.ts` |
| 1 | `plugins/arc/src/LinearPairedArcDisplay/model.ts` |
| 1 | `plugins/arc/src/LinearArcDisplay/model.ts` |

Start with MAF. It is the largest single win and its factory already takes
`LinearMafDisplayConfigModel`.

### Widened, so migrating gains nothing yet (17 sites)

`plugins/canvas/src/LinearBasicDisplay/baseModel.ts` (7),
`plugins/wiggle/src/LinearWiggleDisplay/model.ts` (4),
`plugins/gccontent/src/LinearGCContentDisplay/shared.tsx` (3),
`plugins/canvas/src/LinearBasicDisplay/model.ts` (3).

These take `AnyConfigurationSchemaType`, so `ConfigurationSlotName<...>`
resolves to `any` and `setConf` checks nothing. Migrating them is harmless and
buys consistency, but it does not buy safety until the factory is pinned, and
`packages/core/src/configuration/CLAUDE.md` explains why wiggle and the canvas
base deliberately stay widened. Do not pin them just to enable this.

### Must stay on raw `setSlot`

`packages/core/src/configuration/promotableDefaults.ts` and
`packages/core/src/util/tracks.ts` write genuinely dynamic slot names, which is
exactly what the untyped action exists for. So does the config editor's slot
facade. `setSlot` is not deprecated, it is just not for named slots.

`plugins/wiggle/src/shared/WiggleScoreConfigMixin.ts` is a third case. It is a
mixin, so its `self` is not typed with `configuration` at all. Centralizing that
cast is the original reason `setConf` exists, so this one can migrate, but
confirm the mixin's `self` satisfies `{ configuration: AnyConfigurationModel }`
first.

## Concurrency hazard, read this before starting

Several of the target files are edited by other agents on a regular basis. At the
time of writing `plugins/arc/src/LinearArcDisplay/model.ts`,
`plugins/arc/src/LinearPairedArcDisplay/model.ts`,
`plugins/hic/src/LinearHicDisplay/model.ts` and
`plugins/variants/src/LDDisplay/shared.ts` all had uncommitted changes from
someone else. That is why this migration was left unfinished rather than done in
one sweep.

`git commit -- <paths>` takes the **working tree** at those paths, so committing
a file that carries another agent's in-flight edits publishes their work under
your message. Check `git status --short -- <file>` immediately before each
commit, and skip any file that is already dirty. One commit per plugin keeps the
blast radius small and lets you skip a busy file without stalling the rest.

## Verifying

`pnpm typecheck` is the whole test. A migrated file that compiles proves every
slot name in it is real. If a name does **not** compile, that is a genuine latent
bug, so read it carefully rather than reverting: it means that setting has never
worked.

The regression guard is in
`packages/core/src/configuration/configTypeNarrowing.test.ts`, which is enforced
by `pnpm typecheck` rather than jest. It holds negative `@ts-expect-error`
assertions for both `getConf` and `setConf`. Re-loosening either constraint makes
the directive unused, which surfaces as `TS2578` and fails the build. Confirmed
by positive control.

## Unrelated leftovers from the same review pass

These are alignments items, not config items. They belong in
[TODO.md](../TODO.md) once that file is free of other agents' edits.

- `MIN_BAND_HEIGHT` (`LinearAlignmentsDisplay/model.ts`) is enforced in the band
  height setters but not in the `coverageHeight` / `readConnectionsHeight` /
  `sashimiArcsHeight` getters, so a config value below 20 renders as written and
  then jumps to 20 on the first drag. Adding the clamp to the getters changes
  rendering for such configs, so it wants a deliberate decision rather than a
  drive-by.
- `LinearAlignmentsDisplay/model.ts` re-exports `getInsertionType`,
  `insertionBarWidth as getInsertionRectWidthPx`, `textWidthForNumber`,
  `InsertionType` and `Region`. Nothing in the monorepo imports any of them from
  there (consumers go to `constants.ts` or `@jbrowse/alignments-core` directly),
  but they are published plugin surface, so per
  [PLUGIN_ABI_STABILITY.md](../reference/PLUGIN_ABI_STABILITY.md) removing them
  is a breaking change and needs a call, not a cleanup.
- Three comments in `LinearAlignmentsDisplay/renderSvg.tsx` still use em-dashes,
  against the house prose style. Every other file from that pass was converted,
  but `renderSvg.tsx` was carrying another agent's uncommitted edit at the time
  and committing it would have published their work. Convert when it is clean.
- The coverage y-axis **side** still differs between screen and export. On
  screen an ungrouped axis is on the left, a grouped one is on the right, and the
  compact `[0, max]` label is always on the right. The export always draws on the
  left. The compact-vs-full divergence was fixed (`e347808337`, shared through
  `coverageAxisStyle.ts`), the side was not.
