# Config/session migration audit

The webgl-poc branch removed the renderer config layer and collapsed several
display types. Saved sessions and `config.json` from released JBrowse must still
load.

## Status: complete — no crash-level gaps

Every display and view model was diffed against origin/main. No persisted-prop
rename, removal, or type/enum *narrowing* that fails MST validation on load
remains. The migration code that exists (below) covers everything that matters;
the rest are silent losses (MST ignores unknown props) that are acceptable per
the back-compat policy — don't bend over backwards, punt awkward migrations,
fix only crashes. Keep this doc as the method/pattern reference for the next
display that gets GPU-migrated.

## Method

For each display, diff **origin/main** against the current branch:

1. List every persisted MST `.props()` field and config slot on the OLD
   display(s) — `git show origin/main:<path>`. These are what appear in saved
   sessions.
2. List what the NEW display supports (props + config slots + `configOverrides`
   keys it reads via `getOverride`/`getConfWithOverride`).
3. A **gap** = an old setting that has a home in the new display but no
   migration path. A **removed feature** (no new home) is an acceptable loss.
4. Migration lives in a `preProcessSnapshot` (on the state model and/or config
   schema). See the existing migrations for the pattern.

## Recurring bug patterns (check on every newly-migrated display)

- **`*Setting`-suffix mismatch.** Released props were often bare (`sortedBy`,
  `lineWidth`); some migrate code only handles the `*Setting` form. Accept both.
- **Enum value rename / type change crashes on load.** A bad enum value or wrong
  type throws at hydration (drops the track). Seen: `geneGlyphMode 'longest'`,
  `bicolorPivot` (stringEnum → number). Check every enum/number slot.
- **Config slot rename.** e.g. color1/color2/color3/outline →
  color/connectorColor/utrColor/outlineColor (canvas). Handle old names in
  `preProcessSnapshot`; don't reintroduce the old slot.

## Two checks that reclassified every "gap" flagged during the audit

- **A type/enum change only crashes if the dangerous value was ever persisted.**
  Most models strip defaults in `postProcessSnapshot`
  (`...(x !== default ? {x} : {})`). If the risky value WAS the stripped default
  it never reached disk. Example: `rowHeightMode` went `'auto'|number` →
  `types.number`, but `'auto'` was the stripped default, so only numbers were
  saved — compatible. Verify with `git show origin/main:<model>` before writing
  migration code.
- **Widening is always load-safe; only narrowing or rename crashes.** A `type`
  literal widened to `types.string`, or a union broadened, still validates old
  values. An *unknown* prop on a snapshot (removed feature, or a prop relocated
  to the view) is silently ignored by MST — a silent loss, not a crash — so it's
  a candidate to punt, not a must-fix. A *relocated display/renderer type* keeps
  its registered `name`, so old `type:`/`renderer.type` strings still resolve
  (e.g. ChordVariantDisplay + StructuralVariantChordRenderer moved variants →
  circular-view with names and slots intact).

## Migration code that exists

- **Canvas feature** (`LinearBasicDisplay`, `LinearVariantDisplay`) —
  `migrateBasicSnapshot.ts`: renderer-config lift, color slot rename, enum fixes.
- **Wiggle** (`LinearWiggleDisplay`, `MultiLinearWiggleDisplay`) —
  `migrateWiggleSnapshot.ts`; bicolorPivot.
- **Alignments** (`LinearAlignmentsDisplay` ← Pileup/SNPCoverage/ReadArcs/
  ReadCloud) — `migrateAlignmentsSnapshot.ts`; sortedBy/lineWidth + type remaps.
- **Multi-variant** / **Hi-C** — `migrateOldSettingSnapshots` (`*Setting` →
  `configOverrides`) plus a local `preProcessSnapshot` (Hi-C drops legacy
  `resolution`, migrates colorScheme/showLegend).
- **Track config** — `migrateTrackConfig.ts` (renderer-sub-config lift).
