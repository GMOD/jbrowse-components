import {
  buildCoverageTooltipBin,
  coverageBinAt,
} from '@jbrowse/alignments-core'

import type { MafRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { CoverageBandState } from '@jbrowse/alignments-core'

type Coverage = NonNullable<MafRegionData['coverage']>

export function coverageTooltipBinAt(
  coverage: Coverage,
  basePos: number,
  bpPerPx: number,
  reversed: boolean,
  band: Pick<CoverageBandState, 'showAlleles' | 'minAlleleFraction'>,
) {
  const position = coverageBinAt(coverage, basePos, bpPerPx, reversed, band)
  const bin =
    position === undefined
      ? undefined
      : buildCoverageTooltipBin(position, coverage, coverage)
  if (!bin) {
    return undefined
  }
  const idx = bin.position - coverage.coverageStartPos
  const identity =
    idx >= 0 && idx < coverage.identityScores.length
      ? (coverage.identityScores[idx] ?? Number.NaN)
      : Number.NaN
  return { ...bin, identity }
}
