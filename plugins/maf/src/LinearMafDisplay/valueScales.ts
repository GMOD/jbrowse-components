import { computeCoverageTicks } from '@jbrowse/alignments-core'

import { conservationTicks } from './components/conservationBand.ts'

import type { BandStack } from '@jbrowse/core/util/bandLayout'
import type { ValueScale } from '@jbrowse/wiggle-core'

export interface MafValueScaleInputs {
  topBands: BandStack<'coverage' | 'conservation'>
  coverageActive: boolean
  coverageDomain: [number, number] | undefined
  conservationActive: boolean
  scaleType: string
  symlogConstant: number
  guide: Pick<ValueScale, 'caption' | 'rules' | 'grid' | 'showAxis'>
}

export function mafValueScales({
  topBands,
  coverageActive,
  coverageDomain,
  conservationActive,
  scaleType,
  symlogConstant,
  guide,
}: MafValueScaleInputs): ValueScale[] {
  const scales: ValueScale[] = []
  if (coverageActive && coverageDomain) {
    const height = topBands.reserved.coverage
    scales.push({
      domain: coverageDomain,
      scaleType,
      height,
      ticks: computeCoverageTicks(
        coverageDomain,
        height,
        scaleType,
        symlogConstant,
      ),
      symlogConstant,
      ...guide,
      bandTops: [topBands.top.coverage],
    })
  }
  if (conservationActive) {
    const height = topBands.reserved.conservation
    scales.push({
      domain: [0, 100],
      scaleType: 'linear',
      height,
      ticks: conservationTicks(height),
      bandTops: [topBands.top.conservation],
    })
  }
  return scales
}
