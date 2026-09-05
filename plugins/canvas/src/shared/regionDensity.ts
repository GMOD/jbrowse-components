import { featuresPerPx } from '../RenderFeatureDataRPC/densityGate.ts'

export interface RegionDensityStats {
  featureCount: number
  regionWidthBp: number
}

// Delegates to the same `featuresPerPx` the worker's gate uses: main thread and
// worker must agree on the number, or the banner contradicts the short-circuit
// that produced it.
export function screenDensity(ds: RegionDensityStats, bpPerPx: number) {
  return featuresPerPx(
    ds.featureCount,
    { start: 0, end: ds.regionWidthBp },
    bpPerPx,
  )
}
