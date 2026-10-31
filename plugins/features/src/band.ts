// The feature pipeline as pure functions, for a display drawing these records
// in a band of its own (the variant display's `records`): build,
// pack, fit, paint and pick, the same calls LinearBasicDisplay makes, the
// density gate it refuses a dense window with and its record menu rows. Its own
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
export {
  scaleLaidOutData,
  unplaceBelow,
} from './LinearBasicDisplay/applyLayout.ts'
export {
  createMembershipMemo,
  featureIdsTouchingBlocks,
  maxBottom,
} from './LinearBasicDisplay/layoutQueries.ts'
export { isPlacedRow } from './LinearBasicDisplay/rowPlacement.ts'
export { labelVisibility } from './LinearBasicDisplay/showLabelsMode.ts'
export { DEFAULT_TOOLTIP } from './RenderFeatureDataRPC/featureTooltip.ts'
export {
  FEATURE_DESCRIPTION_FIELD,
  FEATURE_NAME_FIELD,
} from './RenderFeatureDataRPC/featureNameField.ts'
export { featureGroupSections } from './LinearBasicDisplay/facet.ts'
export {
  featureHeightMenuItem,
  labelCheckboxItems,
  trackSizingItems,
} from './LinearBasicDisplay/trackMenus.ts'
export { MIN_GROW_HEIGHT } from './LinearBasicDisplay/heightViews.ts'
export {
  featureSpanRegion,
  fetchFeatureDetails,
} from './shared/fetchFeatureDetails.ts'
export { createFeatureDetailsOpener } from './shared/openFeatureDetails.ts'
export {
  featureHighlightMenuItems,
  featureRecordMenuItems,
} from './LinearBasicDisplay/featureContextMenu.ts'
export {
  FeatureHighlightModel,
  resolveFeatureHighlights,
} from './LinearBasicDisplay/featureHighlight.ts'
export { featureHighlightListActions } from './LinearBasicDisplay/featureHighlightViews.ts'
export { default as FeatureGateMixin } from './shared/FeatureGateMixin.ts'
export { paintFeatureBand } from './LinearBasicDisplay/components/paintFeatureBand.ts'
export {
  buildRegionInstanceIndex,
  drawnLabelTexts,
  featureHighlightInk,
} from './LinearBasicDisplay/featureHighlightInk.ts'
export {
  buildFeatureFlatbushIndex,
  performMultiRegionHitDetection,
} from './LinearBasicDisplay/components/hitTesting.ts'

export type { FitLadderHost } from './LinearBasicDisplay/fitLadderViews.ts'
export type {
  FeatureHighlightMenuSelf,
  FeatureMenuHit,
  FeatureRecordMenuSelf,
} from './LinearBasicDisplay/featureContextMenu.ts'
export type {
  FeatureHighlight,
  ResolvedHighlights,
} from './LinearBasicDisplay/featureHighlight.ts'
export type {
  GateHost,
  RegionGateMeasurement,
} from './shared/FeatureGateMixin.ts'
export type { FitStage } from './LinearBasicDisplay/fitLadder.ts'
export type {
  FeatureFacet,
  FeatureGroupSection,
} from './LinearBasicDisplay/facet.ts'
export type { FeatureBandPaint } from './LinearBasicDisplay/components/paintFeatureBand.ts'
export type {
  FeatureInkHost,
  RegionInstanceIndex,
} from './LinearBasicDisplay/featureHighlightInk.ts'
export type {
  FlatbushRegionIndexes,
  HitFeatureResult,
  VisibleRegion,
} from './LinearBasicDisplay/components/hitTesting.ts'
export type {
  LayoutInputs,
  LayoutRegionData,
} from './LinearBasicDisplay/layoutInputs.ts'
export type {
  DisplayConfig,
  DisplayMode,
} from './RenderFeatureDataRPC/renderConfig.ts'
export type { FeatureDataResult } from './RenderFeatureDataRPC/rpcTypes.ts'
