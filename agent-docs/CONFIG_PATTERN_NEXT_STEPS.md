# Config Pattern: Next Steps

## Immediate (this branch)

- Run browser-test suite to update snapshots for new green/purple variant colors
- Verify all existing tracks render correctly after baseTrackConfig
  preProcessSnapshot change (renderer property promotion)
- Add e2e test for variant_colors asserting non-goldenrod pixels

## Completed

- ~~Move `readConfigValue` to core~~ — now in `packages/core/src/configuration/util.ts`
- ~~Eliminate bespoke override properties~~ — `ConfigOverrideMixin` replaces
  individual `types.maybe()` properties with one `configOverrides` frozen map.
  Applied to: LinearFeatureDisplay (canvas), LinearWiggleDisplay,
  MultiLinearWiggleDisplay. Migration in `preProcessSnapshot` handles old
  `track*` and `*Setting` property names.

## Short-term

- Alignments display: apply `ConfigOverrideMixin` (same pattern, similar
  override properties)
- Verify `geneGlyphMode` default change from 'all' to 'auto' works correctly
  in browser (config schema updated, auto mode switches based on zoom level)

## Medium-term

- Migrate HiC and dotplot displays from `ServerSideRendererType` to the GPU
  pipeline, adopting `getConfSnapshot` + `readConfigValue`

## Long-term

- Consider replacing JEXL with a more standard expression language (vega
  expressions, or a subset of JavaScript) for config callbacks
- Explore track-level config shortcuts so admins can write
  `{ "type": "FeatureTrack", "color": "green" }` without the `displays` array
