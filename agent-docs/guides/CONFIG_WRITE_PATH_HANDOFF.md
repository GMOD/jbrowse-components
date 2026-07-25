---
name: config-write-path-handoff
description: Migrating the remaining raw configuration.setSlot call sites onto the typed setConf, which model factories gain the check, and the concurrency hazard. Read before touching config writes.
---

# Config write path handoff

Config **reads** are typo-checked. Config **writes** were not, and the write
side is the one config mistake with no diagnostic at any layer. `setConf` was
fixed in `4c8d5f06fd` and `LinearAlignmentsDisplay` was migrated as the proving
ground.

**Status: everything is migrated except 11 pinned sites in hic and arc**, which
are blocked only by another agent's uncommitted edits. Every name typechecked,
so none of them were broken. The widened group and the wiggle mixin are done
too, for consistency rather than safety.

That means the invariant is now greppable, which is the real payoff. Every
`self.configuration.setSlot('literal', ...)` left in non-test source is one of
those 11. Every other surviving `.setSlot(` writes a genuinely dynamic name
(`tracks.ts`, `promotableDefaults.ts`, the `slotFacade`, the `target.setSlot`
copy loop in `MultiSampleVariantBaseModel`) or writes to a config node that is
not `self.configuration` (`loadHubSpec.ts`), so `setConf` does not apply. If
that grep ever turns up something else, it is an unmigrated site, not a
judgement call.

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

### Pinned, so migrating gains the check (11 sites left of 79)

| Sites | File | State |
| --- | --- | --- |
| 9 | `plugins/hic/src/LinearHicDisplay/model.ts` | blocked, dirty |
| 1 | `plugins/arc/src/LinearPairedArcDisplay/model.ts` | blocked, dirty |
| 1 | `plugins/arc/src/LinearArcDisplay/model.ts` | blocked, dirty |

All three carry parts of one in-flight refactor removing the SVG export's
`overrideHeight` option (hic collapses `yScalarForHeight` into the `yScalar`
getter, both arc models drop the `opts` pass-through). Committing any of them
would publish that half-finished work. Re-check with `git status --short` and
finish them once it lands; the recipe is unchanged and each is a one-file
commit.

Done, for reference: maf `stateModel.ts` (23), variants `LDDisplay/shared.ts`
(14) and `MultiSampleVariantBaseModel.ts` (11), canvas
`LinearMultiRowFeatureDisplay/model.ts` (8), sequence
`LinearReferenceSequenceDisplay/model.ts` (6), wiggle
`MultiLinearWiggleDisplay/model.ts` (4), gwas
`LinearManhattanDisplay/stateModelFactory.ts` (2).

### Widened, so migrating gained consistency only (17 sites, done)

`plugins/canvas/src/LinearBasicDisplay/baseModel.ts` (7),
`plugins/wiggle/src/LinearWiggleDisplay/model.ts` (4),
`plugins/gccontent/src/LinearGCContentDisplay/shared.tsx` (3),
`plugins/canvas/src/LinearBasicDisplay/model.ts` (3).

These take `AnyConfigurationSchemaType`, so `ConfigurationSlotName<...>`
resolves to `any` and `setConf` still checks nothing in them. They were migrated
anyway, for the greppability described at the top rather than for safety: a raw
`setSlot` on a literal slot name is now unambiguously an unmigrated site. They
will gain the check for free if their factory is ever pinned.

**Do not pin them just to enable this.**
`packages/core/src/configuration/CLAUDE.md` explains why wiggle and the canvas
base deliberately stay widened.

### Must stay on raw `setSlot`

`packages/core/src/configuration/promotableDefaults.ts` and
`packages/core/src/util/tracks.ts` write genuinely dynamic slot names, which is
exactly what the untyped action exists for. So does the config editor's slot
facade. `setSlot` is not deprecated, it is just not for named slots.

`plugins/wiggle/src/shared/WiggleScoreConfigMixin.ts` was a third case, now
done. It is a mixin, so its `self` is not typed with `configuration` at all, and
it had grown its own local `setConf` plus a `ConfNode` cast carrying `setSlot` —
duplicating the cast core `setConf` exists to centralize. It now calls
`setConf(confNode(self), ...)` and `ConfNode` is down to
`{ configuration: AnyConfigurationModel }`. Slot names stay unchecked there,
since that type is widened; the win was deleting the duplicate cast.

## Concurrency hazard, read this before starting

Several of the target files are edited by other agents on a regular basis, and
which ones are busy shifts. That is why this migration ran in stages rather than
as one sweep: on the first pass both arc models, hic and
`plugins/variants/src/LDDisplay/shared.ts` were dirty; by the second, LD had
been committed and only hic and arc were still held.

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

- ~~`MIN_BAND_HEIGHT`~~ done in `9941bec10b`, but **not** by the clamp this
  entry originally proposed. Clamping the `coverageHeight` /
  `readConnectionsHeight` / `sashimiArcsHeight` getters would have let an
  interaction constraint override declarative config: the constant exists so the
  resize handle stays grabbable, and clamping the getter would have made a thin
  band unauthorable rather than merely undraggable. Since the handles drag via
  `set*Height(current + dy)`, the floor belongs in terms of the current height,
  so it is now `min(20, current)` in the three setters. A band at or above 20 is
  unaffected, which is every default and realistically every real config;
  a smaller one keeps its height and can still be dragged, never below where it
  already is. Covered by `bandHeight.test.ts`.
- ~~`LinearAlignmentsDisplay/model.ts` re-exports~~ removed in `589607e043`,
  along with a sixth the entry missed (`ArcColorByType`). **This entry's premise
  was wrong**: they were not published plugin surface, so no ABI call was
  needed. Worth recording how that was settled, because the same check applies
  next time. A symbol in a plugin's `src/` is externally reachable only via one
  of three routes — `packages/core/src/ReExports/list.ts`, the plugin's
  `exports = {}` object (`getPlugin('X').exports.Y`), or the package's `exports`
  map in `package.json`. All three said no here: absent from `list.ts`,
  alignments has no `exports` object, and the map publishes only
  `"." -> esm/index.js` with no deep subpaths, so
  `@jbrowse/plugin-alignments/LinearAlignmentsDisplay/model` is not importable
  at all. `src/index.ts` re-exports exactly one symbol from that file, the
  `LinearAlignmentsDisplayModel` type. That made it in-tree dead code the
  compiler could validate. Being in a plugin's `src/` does not by itself make a
  symbol ABI — check the three routes before deferring on that basis.
- Three comments in `LinearAlignmentsDisplay/renderSvg.tsx` still use em-dashes,
  against the house prose style. Every other file from that pass was converted,
  but `renderSvg.tsx` was carrying another agent's uncommitted edit at the time
  and committing it would have published their work. Convert when it is clean.
- The coverage y-axis **side** still differs between screen and export. The
  compact-vs-full divergence was fixed (`e347808337`, shared through
  `coverageAxisStyle.ts`), the side was not. Diagnosed but not fixed, because
  `renderSvg.tsx` was still carrying another agent's in-flight edit. Exactly
  what to change:

  On screen (`components/PileupComponent.tsx`) the side is a three-way choice.
  Ungrouped and full-height draws left (`orientation="left"` at
  `scalebarOverlapLeft`). Grouped and full-height draws **right**
  (`orientation="right"` at `right: SCROLLBAR_WIDTH + 2`), deliberately, so the
  axis clears the group label chips anchored at `left: 4`. The compact
  `[0, max]` label is right in both cases (`classes.compactAxisLabel`, `right:
  SCROLLBAR_WIDTH + 2`).

  In export, `CoverageScaleBars` in `renderSvg.tsx` hardcodes all three to the
  left: the compact `<text>` sits at `x={left}` and the full bar is
  `orientation="left"`. So a grouped export puts the axis straight through the
  group labels. Its comment claims it mirrors `CoverageAxisHost`, which is true
  only of the compact-vs-full choice, so fix the comment too.

  The pattern to copy is `InsertSizeScaleBar`, immediately below it in the same
  file, which already switches side correctly and anchors its right-hand case at
  `translate(canvasWidth - 50)`. `CoverageScaleBars` needs the grouped flag
  threaded in and a right-hand branch; note there is no scrollbar in an export,
  so `SCROLLBAR_WIDTH` is not the right inset, and the compact `<text>` will
  want `textAnchor="end"` rather than a bare `x`.
