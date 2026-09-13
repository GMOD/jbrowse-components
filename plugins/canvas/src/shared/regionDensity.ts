import { featuresPerPx } from '../RenderFeatureDataRPC/densityGate.ts'

export interface RegionDensityStats {
  featureCount: number
  regionWidthBp: number
}

export function screenDensity(ds: RegionDensityStats, bpPerPx: number) {
  return featuresPerPx(ds.featureCount, ds.regionWidthBp, bpPerPx)
}
