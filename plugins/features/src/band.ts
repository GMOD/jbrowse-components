// The feature pipeline as pure functions, for a display drawing these records
// in a band of its own (the multi-sample variant display's `records`): build,
// pack, fit, paint and pick, the same calls LinearBasicDisplay makes. Its own
// entry rather than the barrel, so the layout and fit modules load with the
// consuming display's lazy model and not at plugin install.
export { buildFeatureRenderData } from './RenderFeatureDataRPC/buildFeatureRenderData.ts'
export { GENE_GLYPH_DEFAULTS } from './RenderFeatureDataRPC/renderConfig.ts'
export { layoutRegionKey } from './LinearBasicDisplay/layoutInputs.ts'
export { labelFontSize } from './RenderFeatureDataRPC/glyphs/glyphUtils.ts'
export {
  fitLadderViews,
  fitLadderVolatiles,
} from './LinearBasicDisplay/fitLadderViews.ts'
export { fittedHeight } from './LinearBasicDisplay/fitLadder.ts'
export { scaleLaidOutData } from './LinearBasicDisplay/applyLayout.ts'
export {
  featureIdsTouchingBlocks,
  maxBottom,
} from './LinearBasicDisplay/layoutQueries.ts'
export { labelVisibility } from './LinearBasicDisplay/showLabelsMode.ts'
export { paintFeatureBand } from './LinearBasicDisplay/components/paintFeatureBand.ts'
export {
  buildFeatureFlatbushIndex,
  performMultiRegionHitDetection,
} from './LinearBasicDisplay/components/hitTesting.ts'

export type { FitLadderHost } from './LinearBasicDisplay/fitLadderViews.ts'
export type { FitStage } from './LinearBasicDisplay/fitLadder.ts'
export type { FeatureBandPaint } from './LinearBasicDisplay/components/paintFeatureBand.ts'
export type {
  FlatbushRegionIndexes,
  HitFeatureResult,
  VisibleRegion,
} from './LinearBasicDisplay/components/hitTesting.ts'
export type {
  LayoutInputs,
  LayoutRegionData,
} from './LinearBasicDisplay/layoutInputs.ts'
export type { DisplayConfig } from './RenderFeatureDataRPC/renderConfig.ts'
export type { FeatureDataResult } from './RenderFeatureDataRPC/rpcTypes.ts'
