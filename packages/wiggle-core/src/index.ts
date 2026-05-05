export { getNiceDomain, getOrigin, getScale } from './scale.ts'
export type { ScaleOpts } from './scale.ts'

export { makeScoreNormalizer } from './normalize.ts'

export { computeAutoscaleDomain, domainFromStats } from './autoscale.ts'
export type { Dataset, FeatureArrays, ScoreStats } from './autoscale.ts'

export const YSCALEBAR_LABEL_OFFSET = 5

export interface YScaleTicks {
  ticks: { value: number; y: number; label?: string }[]
  yTop: number
  yBottom: number
}

export { default as YScaleBar } from './YScaleBar.tsx'
