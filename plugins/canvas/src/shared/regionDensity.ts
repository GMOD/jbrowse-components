import { featuresPerPx } from '../RenderFeatureDataRPC/densityGate.ts'

// Per-region density sample written after each fetch. featureCount comes from
// the worker; regionWidthBp is derived locally from the request's region.
export interface RegionDensityStats {
  featureCount: number
  regionWidthBp: number
}

// Features-per-pixel for a single region given its raw count, the region's
// genomic span, and the current bpPerPx. Used by the derived regionTooLarge
// banner and by force-load to sample observed density. Delegates to the same
// `featuresPerPx` the worker's gate uses: main thread and worker must agree on
// the number, or the banner contradicts the short-circuit that produced it —
// including on a zero-width region, which is why that guard now lives in
// `featuresPerPx` rather than here, where only this side of the pair had it.
export function screenDensity(ds: RegionDensityStats, bpPerPx: number) {
  return featuresPerPx(
    ds.featureCount,
    { start: 0, end: ds.regionWidthBp },
    bpPerPx,
  )
}
