import { bandChipRowWidth } from '@jbrowse/display-kit/groupLabelStyle'

import { conservationTicks } from './components/conservationBand.ts'

import type { MafBandLabel } from './mafEncodeViews.ts'
import type { MafTopBands } from './mafTopBands.ts'
import type { ScaleType, ValueScale, YScaleTicks } from '@jbrowse/wiggle-core'

export interface MafValueScaleInputs {
  topBands: Pick<MafTopBands, 'rects'>
  coverageDomain: [number, number] | undefined
  coverageTicks: () => YScaleTicks | undefined
  scaleType: ScaleType
  symlogConstant: number
  guide: Pick<ValueScale, 'caption' | 'rules' | 'grid' | 'showAxis'>
  chips: readonly Pick<MafBandLabel, 'band' | 'text'>[]
}

function chipsLeft(
  chips: MafValueScaleInputs['chips'],
  band: MafBandLabel['band'],
) {
  const chip = chips.find(c => c.band === band)
  return chip ? bandChipRowWidth([chip.text]) : 0
}

export function mafValueScales({
  topBands,
  coverageDomain,
  coverageTicks,
  scaleType,
  symlogConstant,
  guide,
  chips,
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
        left: chipsLeft(chips, 'coverage'),
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
      left: chipsLeft(chips, 'conservation'),
      bandTops: [conservation.top],
    })
  }
  return scales
}
