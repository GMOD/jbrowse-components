import { SvgRowLabels } from '@jbrowse/tree-sidebar'
import { YScaleBar } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import ScoreLegend from '../shared/ScoreLegend.tsx'
import { getRowTop } from '../shared/wiggleComponentUtils.ts'

import type { ScoreRamp } from '../shared/ScoreLegend.tsx'
import type { YScaleTicks } from '@jbrowse/wiggle-core'

const AXIS_TO_LABEL_GAP_PX = 4

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
  effectiveRowHeight: number
  isDensityMode: boolean
  domain: [number, number] | undefined
  scaleType: string
  ticks?: YScaleTicks
  rowHeightTooSmallForScalebar: boolean
  numSources: number
  numRows: number
  scoreRamp: ScoreRamp | undefined
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
  // right edge of the per-row axes: they are left-oriented, so their ticks and
  // numbers grow leftward from here
  scalebarLeft: number
  // x the row labels start at, before any axis clearance
  labelOffset: number
}) {
  const {
    sources,
    isOverlay,
    effectiveRowHeight,
    isDensityMode,
    domain,
    scaleType,
    ticks,
    rowHeightTooSmallForScalebar,
    numSources,
    numRows,
    scoreRamp,
  } = model

  // Density encodes score as color, and a short row has no room for an axis, so
  // both fall back to the one-line score legend.
  const scoreLegendOnly = isDensityMode || rowHeightTooSmallForScalebar
  const scalebarsShown = !!domain && !scoreLegendOnly

  // The axes are left-oriented, so their ticks and numbers occupy the strip
  // that ends at `scalebarLeft`. Row labels start after that strip rather than
  // under it: a sample name can be arbitrarily long, so the axis takes the
  // fixed-width side and the labels keep growing rightward over the plot.
  const labels =
    numSources > 1 && !isOverlay ? (
      <SvgRowLabels
        sources={sources}
        rowHeight={effectiveRowHeight}
        labelOffset={
          scalebarsShown
            ? Math.max(labelOffset, scalebarLeft + AXIS_TO_LABEL_GAP_PX)
            : labelOffset
        }
      />
    ) : null

  // A domain is what makes any scale real (`ticks` derives from it, so the axis
  // branch needs no separate tick guard). Overlay is one row over the full
  // height (rowHeight === height, so getRowTop(0) === 0); multi-row draws one
  // scalebar per source down the track.
  const scalebars = scalebarsShown ? (
    <g transform={`translate(${scalebarLeft})`}>
      {Array.from({ length: numRows }).map((_, idx) => (
        <g
          // eslint-disable-next-line @eslint-react/no-array-index-key -- fixed positional list, one scalebar per source row
          key={`scalebar-${idx}`}
          transform={`translate(0 ${getRowTop(idx, effectiveRowHeight)})`}
        >
          <YScaleBar ticks={ticks} orientation="left" />
        </g>
      ))}
    </g>
  ) : domain ? (
    <ScoreLegend
      domain={domain}
      scaleType={scaleType}
      canvasWidth={legendRight}
      ramp={scoreRamp}
    />
  ) : null

  return (
    <>
      {labels}
      {scalebars}
    </>
  )
})
