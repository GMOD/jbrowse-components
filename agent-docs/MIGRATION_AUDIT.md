# Config/session migration audit — handoff

The webgl-poc branch removed the renderer config layer and collapsed several
display types. Saved sessions and `config.json` from released JBrowse must still
load. This tracks which displays have had their migration audited and which
still need it.

## Method (how the audited ones were done)

For each display, diff **origin/main** against the current branch:

1. List every persisted MST `.props()` field and config slot on the OLD
   display(s) — `git show origin/main:<path>`. These are what appear in saved
   sessions.
2. List what the NEW display supports (props + config slots + `configOverrides`
   keys it reads via `getOverride`/`getConfWithOverride`).
3. A **gap** = an old setting that has a home in the new display but no
   migration path to it. A **removed feature** (no new home) is an acceptable
   loss — note it, don't try to migrate it.
4. Migration lives in a `preProcessSnapshot` (wired on the state model and/or
   config schema). See the audited examples below for the pattern.

## Recurring bug patterns (check these on EVERY display)

- **`*Setting`-suffix mismatch.** Released props were often bare (`sortedBy`,
  `lineWidth`); some migrate code only handles the `*Setting` form. Fixed in
  alignments (`migrateAlignmentsSnapshot`) — almost certainly recurs elsewhere.
- **Enum value rename / type change crashes on load.** A bad enum value or wrong
  type throws at hydration (drops the track). Seen: `geneGlyphMode 'longest'`,
  `bicolorPivot` (stringEnum+value → number). Check every enum/number slot for a
  value or type that changed.
- **Config slot rename.** color1/color2/color3/outline →
  color/connectorColor/utrColor/outlineColor (canvas). Handle old names in
  `preProcessSnapshot`; don't reintroduce the old slot.

## Audited & fixed this session

- **Canvas feature** (`LinearBasicDisplay`, `LinearVariantDisplay` via canvas
  `baseModel.ts:135`) — renderer-config lift, color slot rename, enum fixes.
  `migrateBasicSnapshot.ts`.
- **Wiggle** (`LinearWiggleDisplay`, `MultiLinearWiggleDisplay`) —
  `migrateWiggleSnapshot.ts`; fixed bicolorPivot.
- **Alignments** (`LinearAlignmentsDisplay` ← Pileup/SNPCoverage/ReadArcs/
  ReadCloud) — `migrateAlignmentsSnapshot.ts`; fixed sortedBy/lineWidth. Removed
  features (no new home, documented): hideSmallIndels/hideMismatches/
  hideLargeIndels, fadeLikelihood, drawCloud, showYScalebar, jitter, minArcScore,
  showInterbaseCounts.
- **Track config** — `migrateTrackConfig.ts` (renderer-sub-config lift).

## Needs audit — prioritized

### HIGH — GPU-migrated, no/low migration, had renderer config

- **Arc** (`plugins/arc/src/LinearArcDisplay`, `LinearPairedArcDisplay`) — NO
  `preProcessSnapshot`. Old `ArcRenderer/configSchema.ts` had color, thickness,
  label, height, caption, displayMode (arcs|semicircles). Verify where these
  live now and whether old configs/sessions still apply them.
- **GWAS Manhattan** (`plugins/gwas/src/LinearManhattanDisplay`) — has
  `GpuManhattanRenderer` (was migrated) but no migration found. Wiggle-like
  (ScoreScaleModel/score config); check color + score-scale settings against the
  old display/renderer.
- **Multi-variant** (`MultiVariantDisplay`, `MultiVariantMatrixDisplay`) — go
  through `shared/MultiSampleVariantBaseModel.ts:230` which only calls the
  GENERIC `migrateOldSettingSnapshots` (strips `*Setting`). That won't catch
  renames, enum/type changes, type-remaps, or bare-name (non-`*Setting`) props.
  Many persisted settings (rowHeightMode, jexlFilters, sources/colors,
  renderingMode, autoHeight). Audit against origin/main explicitly.
- **Sequence** (`plugins/sequence/src/LinearReferenceSequenceDisplay`) — NO
  migration. Check height, color, show-reverse/complement/translation toggles.

### MEDIUM — has migration, coverage unverified

- **Hi-C** (`plugins/hic/src/LinearHicDisplay/model.ts:110`) — has a
  `preProcessSnapshot`; verify it covers old `HicRenderer` config (baseColor,
  color, maxHeight) + model props.
- **Synteny** (`LGVSyntenyDisplay` has preProcess; `LinearSyntenyDisplay` does
  NOT). Dotplot/synteny "stay on the primitive" (see CLAUDE.md) so lower risk,
  but confirm no persisted prop renames.
- **MAF** (`plugins/maf/src/LinearMafDisplay`) — multi-row alignment; check row
  height/color settings.

### LOW

- `LinearBareDisplay` (minimal), `LinearReadCloudDisplay`/`LinearReadArcsDisplay`
  already type-remapped by alignments.
- Circular `StructuralVariantChordRenderer` (strokeColor*) — verify chord track
  colors still resolve.

## View-level (separate from displays)

Scan view models for renamed/consolidated props (not yet checked):
`LinearComparativeView`, `DotplotView`, `CircularView`, `SvInspectorView`,
`BreakpointSplitView`, `SpreadsheetView`, `LinearGenomeView`. Look for any
`.props()` field renamed or removed between origin/main and now.
