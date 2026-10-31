import { computeCoverageTicks } from '@jbrowse/alignments-core'

import { conservationTicks } from './components/conservationBand.ts'

import type { BandStack } from '@jbrowse/core/util/bandLayout'
import type { ValueScale } from '@jbrowse/wiggle-core'

export interface MafValueScaleInputs {
  topBands: BandStack<'coverage' | 'conservation'>
  coverageDomain: [number, number] | undefined
  scaleType: string
  symlogConstant: number
  guide: Pick<ValueScale, 'caption' | 'rules' | 'grid' | 'showAxis'>
}

export function mafValueScales({
  topBands,
  coverageDomain,
  scaleType,
  symlogConstant,
  guide,
}: MafValueScaleInputs): ValueScale[] {
  const scales: ValueScale[] = []
  const { reserved, top } = topBands
  if (reserved.coverage > 0 && coverageDomain) {
    const height = reserved.coverage
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
      bandTops: [top.coverage],
    })
  }
  if (reserved.conservation > 0) {
    const height = reserved.conservation
    scales.push({
      domain: [0, 100],
      scaleType: 'linear',
      height,
      ticks: conservationTicks(height),
      bandTops: [top.conservation],
    })
  }
  return scales
}
