import { YScaleBar, resolveSymlogConstant } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import ScoreLegend from '../shared/ScoreLegend.tsx'

import type { ScoreRamp } from '../shared/ScoreLegend.tsx'
import type { YScaleTicks } from '@jbrowse/wiggle-core'

// The single-wiggle scale for the SVG export: the left y-axis, or the one-line
// score legend in density mode (where score is encoded as color, not height).
// A domain is what makes either real — `ticks` derives from it, so the axis
// branch needs no separate tick guard. Single-plot counterpart of
// MultiWiggleSvgScales.
interface ScaleModel {
  isDensityMode: boolean
  domain: [number, number] | undefined
  scaleType: string
  symlogConstant: number
  scoreRamp: ScoreRamp | undefined
}

export default observer(function WiggleSvgScale({
  model,
  scalebarLeft,
  legendRight,
  ticks,
}: {
  model: ScaleModel
  // x the left-oriented axis is anchored at (the content's left edge)
  scalebarLeft: number
  // x the right-aligned score legend is pinned to (the content's right edge)
  legendRight: number
  ticks: YScaleTicks | undefined
}) {
  const { isDensityMode, domain, scaleType, symlogConstant, scoreRamp } = model
  return !domain ? null : isDensityMode ? (
    <ScoreLegend
      domain={domain}
      scaleType={scaleType}
      symlogConstant={resolveSymlogConstant(
        domain[0],
        domain[1],
        symlogConstant,
      )}
      canvasWidth={legendRight}
      ramp={scoreRamp}
    />
  ) : (
    <g transform={`translate(${scalebarLeft})`}>
      <YScaleBar ticks={ticks} orientation="left" />
    </g>
  )
})
