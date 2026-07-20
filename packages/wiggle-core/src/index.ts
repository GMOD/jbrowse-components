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
  computeAutoscaleDomain,
  computeScoreExtent,
  domainFromStats,
  getEffectiveScores,
} from './autoscale.ts'
export type { Dataset, FeatureArrays, ScoreStats } from './autoscale.ts'

export const YSCALEBAR_LABEL_OFFSET = 5

export { computeYTicks } from './computeYTicks.ts'

export { resolveRenderState } from './resolveRenderState.ts'

export interface YScaleTicks {
  items: { value: number; y: number; label?: string }[]
  yTop: number
  yBottom: number
}

export { CrossHatchLines, default as CrossHatches } from './CrossHatches.tsx'
export { makeRadioSubMenu } from './radioSubMenu.ts'
export { makeShowSubMenu } from './showSubMenu.ts'
export { makeResolutionSubMenuItem } from './ResolutionStepper.tsx'
export { makeScatterPointSizeMenuItem, makeSizeMenu } from './pointSizeMenu.tsx'
export {
  SMALL_POINT_MAX_DIAMETER_PX,
  appendPointMarker,
} from './pointMarker.ts'
export { default as SetMinMaxDialog } from './SetMinMaxDialog.tsx'

export {
  DEFAULT_AUTOSCALE_OPTIONS,
  makeAutoscaleTypeSubMenu,
  makeCrossHatchItem,
  makeScaleTypeSubMenu,
  makeScoreSubMenu,
  makeSetMinMaxScoreItem,
} from './scoreMenuItems.ts'
export type { ScoreScaleModel } from './scoreMenuItems.ts'
export { default as YScaleBar } from './YScaleBar.tsx'
export { default as YScaleBarOverlay } from './YScaleBarOverlay.tsx'

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
