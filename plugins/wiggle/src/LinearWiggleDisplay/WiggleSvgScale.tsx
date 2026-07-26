import { YScaleBar } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import ScoreLegend from '../shared/ScoreLegend.tsx'

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
  posColor: string
  negColor: string
  bicolorPivot: number
  useBicolor: boolean
  id: string
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
  const {
    isDensityMode,
    domain,
    scaleType,
    posColor,
    negColor,
    bicolorPivot,
    useBicolor,
    id,
  } = model
  // Single-wiggle density always draws from posColor (the config doc for
  // `color` says so), so with bicolor off there is only one side to describe
  // and the plain [min, max] text stays the honest legend.
  const ramp = isDensityMode && useBicolor
    ? { posColor, negColor, pivot: bicolorPivot }
    : undefined
  return !domain ? null : isDensityMode ? (
    <ScoreLegend
      domain={domain}
      scaleType={scaleType}
      canvasWidth={legendRight}
      ramp={ramp}
      gradientId={`score-ramp-${id}`}
    />
  ) : (
    <g transform={`translate(${scalebarLeft})`}>
      <YScaleBar ticks={ticks} orientation="left" />
    </g>
  )
})
