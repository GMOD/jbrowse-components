import type { PreBaseCoverageBin } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion } from '@jbrowse/core/util/types'

export function processDepth(
  feature: Feature,
  bins: PreBaseCoverageBin[],
  region: AugmentedRegion,
) {
  const fstart = feature.get('start')
  const fend = feature.get('end')
  const fstrand = feature.get('strand') as -1 | 0 | 1
  const regionStart = region.start
  const regionEnd = region.end

  const clampedStart = Math.max(fstart, regionStart)
  const clampedEnd = Math.min(fend, regionEnd)

  // Bins are pre-initialized, optimize loop with direct index calculation
  const startIdx = clampedStart - regionStart
  const endIdx = clampedEnd - regionStart

  for (let i = startIdx; i < endIdx; i++) {
    const bin = bins[i]!
    bin.depth++
    bin.readsCounted++
    const ref = bin.ref
    ref.entryDepth++
    ref[fstrand]++
  }
}
