# Config/session migration audit

The webgl-poc branch removed the renderer config layer and collapsed several
display types. Saved sessions and `config.json` from released JBrowse must still
load.

## Status: mostly complete — one mechanism gap found 2026-06-18

Every display and view model was diffed against origin/main. The migration code
that exists (below) covers everything that matters; the rest are silent losses
(MST ignores unknown props) that are acceptable per the back-compat policy —
don't bend over backwards, punt awkward migrations, fix only crashes.

**Correction (2026-06-18):** the "no crash-level gaps" claim was wrong for one
*class* of migration. Config-schema `preProcessSnapshot` **does not run while a
`types.union` validates a snapshot** — and every display/track/adapter *config*
is reached through such a union (a track's `displays` array, the pluggable
display/adapter unions). The union validates the **raw** snapshot. Consequence:

- A config migration that turns old data into an **unknown extra prop** (renamed/
  removed slot) still works: MST ignores extra props, the union matches by `type`,
  then `create` runs `preProcessSnapshot` and the rename lands.
- A config migration that changes the **value of an existing constrained slot**
  (enum value rename, type narrow) **silently fails**: the union rejects the raw
  value first ("No matching type for union … value X is not assignable"),
  `preProcessSnapshot` never runs, the track drops.

This is why **enum-value renames must not live in a config-schema
`preProcessSnapshot`.** See "Choosing the migration seam" below.

Both known instances are fixed (2026-06-18) via `addDisplayConfigMigration`
(`packages/core/src/pluggableElementTypes/models/migrateTrackConfig.ts`) — a
helper that registers a `Core-preProcessTrackConfig` handler running the
migration before union validation:
- **Wiggle `defaultRendering: "xyplot"`** (MultiLinearWiggleDisplay) →
  `MultiLinearWiggleDisplay/preProcessTrackConfig.ts`.
- **Canvas `geneGlyphMode: "longest"` / boolean `showLabels`** (LinearBasicDisplay)
  → registered in `LinearBasicDisplay/index.ts` with `migrateBasicConfigSnapshot`.
  (`GENE_GLYPH_MODES`/`SHOW_LABELS_MODES` don't include the legacy values; the
  config-schema `preProcessSnapshot` alone could not repair them through the
  union. Session-saved model overrides migrate separately on the state model.)
- **Sweep done:** the other display config-schema `preProcessSnapshot` migrations
  (arc, chord-variant) only lift a `renderer` sub-config onto new slots — the
  legacy data becomes an unknown prop, so the union ignores it and the migration
  lands; no exposure. Adapter `normalizeSnapshot` migrations go through
  `FileLocation`'s `snapshotProcessor`, which DOES apply during union validation.
  If a future config-schema `preProcessSnapshot` rewrites a constrained slot
  value, route it through `addDisplayConfigMigration`.

## Method

For each display, diff **origin/main** against the current branch:

1. List every persisted MST `.props()` field and config slot on the OLD
   display(s) — `git show origin/main:<path>`. These are what appear in saved
   sessions.
2. List what the NEW display supports (props + config slots + `configOverrides`
   keys it reads via `getOverride`/`getConfWithOverride`).
3. A **gap** = an old setting that has a home in the new display but no
   migration path. A **removed feature** (no new home) is an acceptable loss.
4. Choose the migration seam by what you're rewriting (see next section).

## Choosing the migration seam

| What you're migrating | Seam | Why |
|---|---|---|
| Session-saved **state-model** prop (e.g. `sortedBy`, an override) | `preProcessSnapshot` on the **state model** | Model snapshots are migrated on hydration; works for renames and value fixes. |
| **Display/track/adapter type** rename | declarative `aliases` on the `DisplayType`/etc. | Applied centrally before union validation; each element owns its renames. |
| **Config slot** add / remove / rename (old data becomes an unknown prop) | `preProcessSnapshot` on the **config schema** | Union ignores the extra prop, matches by `type`, then the rename runs on create. |
| **Config slot value** rewrite on an *existing constrained slot* (enum rename, type narrow) | `addDisplayConfigMigration(pm, [types], migrateFn)` | Registers a `Core-preProcessTrackConfig` handler that runs **before** union validation — config-schema `preProcessSnapshot` does NOT (see Status). |

Reference for the last row: `addDisplayConfigMigration`
(`packages/core/src/pluggableElementTypes/models/migrateTrackConfig.ts`) maps a
migrate fn over a track snapshot's matching displays before validation. Call it
from the display's plugin (see `MultiLinearWiggleDisplay/preProcessTrackConfig.ts`
and `LinearBasicDisplay/index.ts`). Pass canonical + alias type names (it runs
before alias normalization), and keep the migrate fn idempotent — it can also be
reused as the config-schema `preProcessSnapshot` for direct-create defense.

## Recurring bug patterns (check on every newly-migrated display)

- **`*Setting`-suffix mismatch.** Released props were often bare (`sortedBy`,
  `lineWidth`); some migrate code only handles the `*Setting` form. Accept both.
- **Enum value rename / type change crashes on load.** A bad enum value or wrong
  type throws at hydration (drops the track). Seen: `geneGlyphMode 'longest'`,
  `bicolorPivot` (stringEnum → number). Check every enum/number slot. **For
  *config* slots, fix it in a `Core-preProcessTrackConfig` handler, not the
  config-schema `preProcessSnapshot` — the latter does not run in the union (see
  Status).**
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
