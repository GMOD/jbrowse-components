import {
  buildCoverageTooltipBin,
  coverageBinAt,
} from '@jbrowse/alignments-core'

import type { MafRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'

type Coverage = NonNullable<MafRegionData['coverage']>

export function coverageTooltipBinAt(
  coverage: Coverage,
  basePos: number,
  bpPerPx: number,
  reversed: boolean,
  minAlleleFraction: number | undefined,
) {
  const position = coverageBinAt(
    coverage,
    basePos,
    bpPerPx,
    reversed,
    minAlleleFraction,
  )
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
