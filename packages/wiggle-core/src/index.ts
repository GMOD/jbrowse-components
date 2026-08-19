export { scoreAxisConfigSchemaFields } from './scoreAxisConfigSchemaFields.ts'
export type { ScoreAxisConfigModel } from './scoreAxisConfigSchemaFields.ts'

export { getNiceDomain, getNiceScale, getOrigin, getScale } from './scale.ts'
export type { ScaleOpts } from './scale.ts'
export { toP } from './formatNumber.ts'

export {
  SCALE_TYPE_LINEAR,
  SCALE_TYPE_LOG,
  makeScoreNormalizer,
  scaleTypeFromString,
} from './normalize.ts'
export type { WiggleScaleType } from './normalize.ts'

export {
  autoscaleDomainFromStats,
  computeAutoscaleDomain,
  computeScoreExtent,
  computeScoreStats,
  domainFromStats,
  getEffectiveScores,
} from './autoscale.ts'
export type { Dataset, FeatureArrays, ScoreStats } from './autoscale.ts'

export { ONSCREEN_AXIS_LEFT_PX, YSCALEBAR_LABEL_OFFSET } from './constants.ts'

export { computeYTicks } from './computeYTicks.ts'

export { resolveRenderState } from './resolveRenderState.ts'

export {
  AXIS_GUTTER_WIDTH_PX,
  axisPlotBox,
  clampStrokeInsideAxis,
  leftAxisSpineX,
  scoreToAxisY,
} from './yScaleTicks.ts'
export type { YScaleTicks } from './yScaleTicks.ts'

export { CrossHatchLines, default as CrossHatches } from './CrossHatches.tsx'
export { makeResolutionSubMenuItem } from './ResolutionStepper.tsx'
export { makeScatterPointSizeMenuItem } from './pointSizeMenu.tsx'
export {
  SMALL_POINT_MAX_DIAMETER_PX,
  appendPointMarker,
} from './pointMarker.ts'
export { default as SetMinMaxDialog } from './SetMinMaxDialog.tsx'

export { DEFAULT_AUTOSCALE_OPTIONS } from './autoscale.ts'
export {
  makeAutoscaleTypeSubMenu,
  makeCrossHatchItem,
  makeScaleTypeSubMenu,
  makeScoreSubMenu,
  makeSetMinMaxScoreItem,
} from './scoreMenuItems.ts'
export type { ScoreScaleModel } from './scoreMenuItems.ts'
export { ScoreScaleMixin } from './ScoreScaleMixin.ts'
export { default as YScaleBar } from './YScaleBar.tsx'
export { default as YScaleBarOverlay } from './YScaleBarOverlay.tsx'

export {
  MIN_FILL_WIDTH_PX,
  NO_PREV_START,
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_LINE_CENTER,
  RENDERING_TYPE_SCATTER,
  RENDERING_TYPE_XYPLOT,
} from './renderingBackendTypes.ts'
export type {
  SourceRenderData,
  WiggleGPURenderState,
  WiggleRenderingBackend,
  WiggleRenderingType,
} from './renderingBackendTypes.ts'

export type {
  SourceInfo,
  WiggleDataResult,
  WiggleFeatureArrays,
  WiggleSourceData,
} from './dataTypes.ts'

export { type WiggleGpuDisplayModel } from './displayModel.ts'

export { collectWiggleTransferables } from './transferables.ts'

export { DEFAULT_GAP_BREAK_MULTIPLE, gapBreakLimit } from './gapBreak.ts'
