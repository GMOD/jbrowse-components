---
name: adr-149-base-color-audit
description: A 2026-09-21 audit of ADR-149 (the per-base layer as its own `baseColor` object) against the code on main found no correctness bugs and every Decision and Consequence held. Waiting on three loose ends — whether `baseColor.scale` keeps a writer or goes, five stale comments naming `colorBy` where the code reads `baseLayer`, and the worker-side `colorBy` still typed `ColorBy` — and on a figure capture for the "every existing figure paints as it did" claim, which no suite checks. Read before touching `baseColor`, `setBaseLayer` or the per-base menu group.
---

# ADR-149 audit: `baseColor` is implemented as written

[ADR-149](../architecture-decision-records/adr-149-the-per-base-layer-is-its-own-colour-object.md)
was checked claim by claim against main at `470752b576`. `pnpm typecheck` is
clean, and 75 suites (1,072 tests) pass: `plugins/alignments/src/shared`,
`LinearAlignmentsDisplay/menus`, `model.coupling`, `fetchAutorun`,
`showSoftClipping`, `product-core` session migrations and
`jbrowse-img/src`. **Delete this file when the three items below land or are
declined.**

## What held

- **Schema**: `alignmentsBaseColorConfigSchema.ts` is closed, `field` an enum
  of the four `BASE_COLOR_FIELDS`, `scale` an enum of `none`.
- **Split runtime form**: `colorByOf` returns a `ReadColorBy` and paints a
  per-base name on `color` as the plain fill; `baseLayerOf`
  (`shared/alignmentsColor.ts:119`) reads `baseColor`. `setColorBy` and
  `setBaseLayer` (`LinearAlignmentsDisplay/model.ts:3250-3280`) each write only
  their own object.
- **Worker**: `rpcProps` sends `workerColorBy(colorBy)` and `baseLayer` whole;
  `extractFeatureArrays` reads the tag off the first and the per-base arrays
  and modification calls off the second in one pass.
- **Reach into other marks**: `bodyColorScheme` feeds `colorSchemeIndex`,
  `readColorContext.bodyScheme` and `arcColorsMatchReads`. The mismatch mute
  keys on `showModifications` (`paintsModifications(baseLayer)`).
  `framesChainStrand` gates on `baseLayer?.type ?? colorBy.type`, so the
  chain-strand framing holds off under any layer.
- **Menu**: read fills, then the "Per-base coloring" sub-header over None, the
  two per-base radios and the Modifications/Bisulfite submenus
  (`menus/colorBy.ts`). `GroupByDialog` calls only `setColorBy`.
- **Key**: `getReadDisplayLegendItems` lists `baseLayerLegend`, then
  `schemeLegend`, then the buckets.
- **Migration and tools**: `V4_BASE_COLOR_FIELDS` in `sessionMigrations`,
  jb2export's `baseColor:` modifier and its refusal of a per-base name on
  `color:`. Every `test_data` config and `probe-per-base-bin.ts` already use
  `baseColor`; website docs carry no ADR-148 spelling.

## Open

1. **`baseColor.scale: 'none'` has no writer.** Its slot description promises
   it "keeps the field for a switch back", but the None radio calls
   `setBaseLayer()`, which writes `{}` and drops the field. Only a hand-written
   config reaches the slot. Little is lost, since the modification settings
   live in the `modifications` slot. Either None writes `{ scale: 'none' }`,
   as `colorSnapshotFor` does for `color`, or the slot goes and the ADR's
   Decision says `field` alone.
2. **Stale comments** still say `colorBy.type === 'perBaseQuality'` /
   `'perBaseLetter'` where the code reads `baseLayer`:
   `RenderAlignmentDataRPC/types.ts:266,274`,
   `features/perBaseQuality/types.ts:2`, `features/perBaseLetter/types.ts:2`.
   `menus/modificationsMenu.ts:143` describes `patchMods` switching "the
   scheme", which after the split sets only the layer.
3. **The worker's `colorBy` is still `ColorBy`** (`extractFeatureArrays.ts:45`,
   `workerColorBy`), not `ReadColorBy`, so the ADR's "a comparison of the read
   scheme against a per-base name is a type error" holds on the main thread
   only.

## Not checked

"Every existing figure paints as it did" under the plain fill with a
modification layer. That needs a capture of the methylation and bisulfite
figures (`test_data/arabidopsis_methylation`, `test_data/methylation_test`),
not the unit suites.
