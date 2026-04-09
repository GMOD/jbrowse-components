# Config Pattern: Next Steps

## Immediate (this branch)

- Run browser-test suite to update snapshots for new green/purple variant colors
- Verify all existing tracks render correctly after baseTrackConfig
  preProcessSnapshot change (renderer property promotion)
- Add e2e test for variant_colors asserting non-goldenrod pixels

## Short-term

- Move `readConfigValue` from `plugins/canvas/src/RenderFeatureDataRPC/` to
  `packages/core/src/configuration/` alongside `getConfSnapshot` so any plugin
  can use it
- Wiggle displays: replace the bespoke override pattern
  (`self.colorSetting ?? getConf(self, 'color')`) with
  `getConfSnapshot` + override spread for consistency. Low urgency since these
  render on the main thread and work correctly today
- Alignments display: same — bespoke overrides could use the standard pattern
  but already work

## Medium-term

- Eliminate bespoke model override properties (`trackShowLabels`,
  `trackDisplayMode`, etc.) across all displays. Replace with direct config
  mutation: `self.configuration.color1.set('red')`. Session snapshots would
  store the delta from the base track config, not individual override properties.
  This would remove hundreds of lines of boilerplate across the codebase
- Migrate HiC and dotplot displays from `ServerSideRendererType` to the GPU
  pipeline, adopting `getConfSnapshot` + `readConfigValue`

## Long-term

- Consider replacing JEXL with a more standard expression language (vega
  expressions, or a subset of JavaScript) for config callbacks
- Explore track-level config shortcuts so admins can write
  `{ "type": "FeatureTrack", "color": "green" }` without the `displays` array
