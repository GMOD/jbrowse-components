---
name: config-write-path-handoff
description: Migrating the remaining raw configuration.setSlot call sites onto the typed setConf, which model factories gain the check, and the concurrency hazard. Read before touching config writes.
---

# Config write path handoff

Config **reads** are typo-checked. Config **writes** were not, and the write
side is the one config mistake with no diagnostic at any layer. `setConf` was
fixed in `4c8d5f06fd` and `LinearAlignmentsDisplay` was migrated as the proving
ground.

**Status: done.** All 79 pinned sites are migrated, plus the 17 widened ones and
the wiggle mixin. Every name typechecked, so none of them were broken.

The real payoff is that the invariant is now greppable. No
`self.configuration.setSlot('literal', ...)` remains in non-test source. Every
surviving `.setSlot(` writes a genuinely dynamic name (`tracks.ts`,
`promotableDefaults.ts`, the `slotFacade`, the `target.setSlot` copy loop in
`MultiSampleVariantBaseModel`) or writes a config node that is not
`self.configuration` (`loadHubSpec.ts`), so `setConf` does not apply. If that
grep turns up a literal slot name, it is an unmigrated site, not a judgement
call.

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

### Pinned, so migrating gains the check (79 of 79, done)

The last 11 (hic 9, both arc models 1 each) landed in `c5444342dc`. All 79 names
typechecked, so nothing in the pinned group was ever broken.

Those three files were carrying an unrelated in-flight refactor at the time
(removing the SVG export's `overrideHeight` option), which is why earlier passes
skipped them. See "Committing a file another agent is editing" below for how
that was resolved without waiting.

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
commit. One commit per plugin keeps the blast radius small and lets you skip a
busy file without stalling the rest.

### Committing a file another agent is editing

Skipping is the cheap answer, but a file can stay busy for a long time. The last
11 sites here sat blocked across several passes. You can commit **only your own
hunks** and leave theirs untouched in the working tree, because `git commit` with
no pathspec commits the **index**, while `git commit -- <path>` commits the
working tree. Never `git stash` for this: it snapshots the whole worktree and
yanks their edits out from under them.

```sh
git diff --cached --stat                  # MUST be empty first, or you sweep in
git diff -- <file> > /tmp/theirs.patch    # snapshot theirs BEFORE you edit
# ...make your edits...
git add <file>                            # stages theirs + yours
git apply --cached -R /tmp/theirs.patch   # unstages theirs, leaving only yours
git diff --cached                         # eyeball: only your hunks
git commit -m ...                         # no pathspec: commits the index
```

Then prove you did no harm: `git diff -- <file>` should be byte-identical to
`/tmp/theirs.patch`, and the index should be empty again. It only works when the
two edits touch different regions, and it does mean HEAD briefly holds your
change without theirs, so typecheck first and make sure your hunks don't depend
on theirs. Say so in the commit message, since the partial-commit is otherwise
invisible to whoever reads it later.

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
- ~~Em-dash comments in `renderSvg.tsx`~~ and ~~the coverage y-axis side~~ both
  done in `8c042bfec1`.

  The axis turned out to be worse than a side mismatch, which is worth recording
  because reasoning about it from the source alone under-called it. `YScaleBar`
  grows its ticks and labels *away* from the spine (`orientation="left"` grows
  leftward, so the spine is the axis's right edge). The export translated to the
  band's left edge and drew left-oriented, so with `contentLeft` at its usual 0
  the labels rendered at **x = -9, off the image entirely**; the compact label
  meanwhile sat under the group label chips. A probe test rendering the real
  component confirmed both before anything changed
  (`coverageAxisExport.test.tsx`, which now guards the fix).

  It now mirrors `CoverageAxisHost`'s three-way choice: compact label
  right-aligned via `textAnchor="end"`, full axis right when grouped so it
  clears the chips, left otherwise with its spine inset by the label width. The
  geometry lives in `coverageAxisStyle.ts` alongside `COMPACT_AXIS_HEIGHT`,
  since that module exists precisely to stop these two paths drifting.
