import { computeCoverageTicks } from '@jbrowse/alignments-core'

import { conservationTicks } from './components/conservationBand.ts'

import type { MafTopBands } from './mafTopBands.ts'
import type { ValueScale } from '@jbrowse/wiggle-core'

export interface MafValueScaleInputs {
  topBands: Pick<MafTopBands, 'rects'>
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
  const { coverage, conservation } = topBands.rects
  if (coverage.height > 0 && coverageDomain) {
    const { height } = coverage
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
      bandTops: [coverage.top],
    })
  }
  if (conservation.height > 0) {
    const { height } = conservation
    scales.push({
      domain: [0, 100],
      scaleType: 'linear',
      height,
      ticks: conservationTicks(height),
      bandTops: [conservation.top],
    })
  }
  return scales
}
