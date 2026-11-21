import { conservationTicks } from './components/conservationBand.ts'

import type { MafTopBands } from './mafTopBands.ts'
import type { ScaleType, ValueScale, YScaleTicks } from '@jbrowse/wiggle-core'

export interface MafValueScaleInputs {
  topBands: Pick<MafTopBands, 'rects'>
  coverageDomain: [number, number] | undefined
  coverageTicks: () => YScaleTicks | undefined
  scaleType: ScaleType
  symlogConstant: number
  guide: Pick<ValueScale, 'caption' | 'rules' | 'grid' | 'showAxis'>
}

export function mafValueScales({
  topBands,
  coverageDomain,
  coverageTicks,
  scaleType,
  symlogConstant,
  guide,
}: MafValueScaleInputs): ValueScale[] {
  const scales: ValueScale[] = []
  const { coverage, conservation } = topBands.rects
  if (coverage.height > 0 && coverageDomain) {
    const ticks = coverageTicks()
    if (ticks) {
      scales.push({
        domain: coverageDomain,
        scaleType,
        height: coverage.height,
        ticks,
        symlogConstant,
        ...guide,
        bandTops: [coverage.top],
      })
    }
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
