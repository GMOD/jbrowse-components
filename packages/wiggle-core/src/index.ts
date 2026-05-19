export { getNiceDomain, getOrigin, getScale } from './scale.ts'
export type { ScaleOpts } from './scale.ts'

export {
  SCALE_TYPE_LINEAR,
  SCALE_TYPE_LOG,
  makeScoreNormalizer,
  scaleTypeFromString,
} from './normalize.ts'
export type { WiggleScaleType } from './normalize.ts'

export { computeAutoscaleDomain, domainFromStats } from './autoscale.ts'
export type { Dataset, FeatureArrays, ScoreStats } from './autoscale.ts'

export const YSCALEBAR_LABEL_OFFSET = 5

export interface YScaleTicks {
  ticks: { value: number; y: number; label?: string }[]
  yTop: number
  yBottom: number
}

export { default as SetMinMaxDialog } from './SetMinMaxDialog.tsx'
export { default as YScaleBar } from './YScaleBar.tsx'

export type {
  SourceRenderData,
  WiggleBackend,
  WiggleGPURenderState,
  WiggleRenderBlock,
  WiggleRenderingType,
} from './backendTypes.ts'

export type {
  SourceInfo,
  WiggleDataResult,
  WiggleFeatureArrays,
  WiggleSourceData,
} from './dataTypes.ts'

export type { WiggleGpuDisplayModel } from './displayModel.ts'
