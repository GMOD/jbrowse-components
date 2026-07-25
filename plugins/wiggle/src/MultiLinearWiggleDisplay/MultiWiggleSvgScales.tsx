import { SvgRowLabels } from '@jbrowse/tree-sidebar'
import { YScaleBar } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import ScoreLegend from '../shared/ScoreLegend.tsx'
import { getRowTop } from '../shared/wiggleComponentUtils.ts'

import type { YScaleTicks } from '@jbrowse/wiggle-core'

// Row labels (non-overlay mode) plus the Y-scale legend, shared by the live
// MultiWiggleComponent and the SVG export path so the two can't drift. The
// overlay-mode color legend is NOT here: it's composed by each path directly —
// on screen via the hoisted MultiWiggleLegendOverlay (which paints above the
// inter-region separators), in export inline in renderSvg. Callers pass their
// own `legendRight`/`scalebarLeft`/`labelOffset` (the axis indent differs
// between screen and export, see ONSCREEN_AXIS_LEFT_PX).
interface ScaleModel {
  sources: {
    name: string
    label?: string
    color?: string
    labelColor?: string
    group?: string
  }[]
  isOverlay: boolean
  rowHeight: number
  isDensityMode: boolean
  domain: [number, number] | undefined
  dataRange: [number, number] | undefined
  scaleType: string
  ticks?: YScaleTicks
  rowHeightTooSmallForScalebar: boolean
  numSources: number
}

export default observer(function MultiWiggleSvgScales({
  model,
  legendRight,
  scalebarLeft,
  labelOffset,
}: {
  model: ScaleModel
  // x the right-aligned score legend is pinned to (the content's right edge)
  legendRight: number
  // x the per-row axes are anchored at
  scalebarLeft: number
  labelOffset: number
}) {
  const {
    sources,
    isOverlay,
    rowHeight,
    isDensityMode,
    domain,
    dataRange,
    scaleType,
    ticks,
    rowHeightTooSmallForScalebar,
    numSources,
  } = model

  const labels =
    numSources > 1 && !isOverlay ? (
      <SvgRowLabels
        sources={sources}
        rowHeight={rowHeight}
        labelOffset={labelOffset}
      />
    ) : null

  // Density encodes score as color, and a short row has no room for an axis, so
  // both fall back to the one-line score legend.
  const scoreLegendOnly = isDensityMode || rowHeightTooSmallForScalebar

  // A domain is what makes any scale real (`ticks` derives from it, so the axis
  // branch needs no separate tick guard). Overlay draws a single scalebar over
  // the full height (rowHeight === height, so getRowTop(0) === 0); rows draw one
  // per source down the track.
  const scalebars = !domain ? null : scoreLegendOnly ? (
    <ScoreLegend
      domain={domain}
      dataRange={dataRange}
      scaleType={scaleType}
      canvasWidth={legendRight}
    />
  ) : (
    <g transform={`translate(${scalebarLeft})`}>
      {Array.from({ length: isOverlay ? 1 : numSources }).map((_, idx) => (
        <g
          // eslint-disable-next-line @eslint-react/no-array-index-key -- fixed positional list, one scalebar per source row
          key={`scalebar-${idx}`}
          transform={`translate(0 ${getRowTop(idx, rowHeight)})`}
        >
          <YScaleBar ticks={ticks} orientation="left" />
        </g>
      ))}
    </g>
  )

  return (
    <>
      {labels}
      {scalebars}
    </>
  )
})
