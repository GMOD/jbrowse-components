import { SvgRowLabels } from '@jbrowse/tree-sidebar'
import { YScaleBar, resolveSymlogConstant } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import ScoreLegend, { scoreLegendHeight } from '../shared/ScoreLegend.tsx'
import { getRowTop } from '../shared/wiggleComponentUtils.ts'

import type { ScoreRamp } from '../shared/ScoreLegend.tsx'
import type { YScaleTicks } from '@jbrowse/wiggle-core'

const AXIS_TO_LABEL_GAP_PX = 4

// Whether the one-line score legend takes the place of the per-row axes.
// Density encodes score as color, and a short row has no room for an axis, so
// both fall back to it — and a domain is what makes any scale real.
function scoreLegendShown(model: ScoreLegendModel) {
  return (
    !!model.domain &&
    (model.isDensityMode || model.rowHeightTooSmallForScalebar)
  )
}

interface ScoreLegendModel {
  domain: [number, number] | undefined
  isDensityMode: boolean
  rowHeightTooSmallForScalebar: boolean
  scoreRamp: ScoreRamp | undefined
}

/**
 * Px the score legend occupies at the top-right, which the source color key has
 * to start below.
 *
 * Both are pinned to the content's right edge and both draw from y=0, so
 * whenever they apply together the key lands on top of the score range — and
 * they apply together in exactly the case the key was widened for: a density
 * track whose rows are too short to label falls back to the score legend AND
 * gets a key. Exported so the two callers that draw the key (the on-screen
 * `FloatingLegend`, the inline one in `renderSvg`) offset it by the
 * same number this component lays the score legend out with.
 */
export function scoreLegendReservedPx(model: ScoreLegendModel) {
  return scoreLegendShown(model) ? scoreLegendHeight(model.scoreRamp) : 0
}

// Row labels (non-overlay mode) plus the Y-scale legend, shared by the live
// MultiWiggleComponent and the SVG export path so the two can't drift. The
// overlay-mode color legend is NOT here: it's composed by each path directly —
// on screen via the shared FloatingLegend (which portals above the
// inter-region separators), in export inline in renderSvg. Callers pass their
// own `legendRight`/`scalebarLeft`/`labelOffset` (the axis indent differs
// between screen and export, see ONSCREEN_AXIS_LEFT_PX).
interface ScaleModel extends ScoreLegendModel {
  sources: {
    name: string
    label?: string
    color?: string
    labelColor?: string
    group?: string
  }[]
  isOverlay: boolean
  effectiveRowHeight: number
  scaleType: string
  symlogConstant: number
  ticks?: YScaleTicks
  numSources: number
  numRows: number
  showRowLabels: boolean
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
    domain,
    scaleType,
    symlogConstant,
    ticks,
    numSources,
    numRows,
    scoreRamp,
    showRowLabels,
  } = model

  const scalebarsShown = !!domain && !scoreLegendShown(model)

  // The axes are left-oriented, so their ticks and numbers occupy the strip
  // that ends at `scalebarLeft`. Row labels start after that strip rather than
  // under it: a sample name can be arbitrarily long, so the axis takes the
  // fixed-width side and the labels keep growing rightward over the plot.
  const labels =
    numSources > 1 && !isOverlay && showRowLabels ? (
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
  // branch needs no separate tick guard), which is why the no-domain case is one
  // early null rather than a guard on each branch. Overlay is one row over the
  // full height (rowHeight === height, so getRowTop(0) === 0); multi-row draws
  // one scalebar per source down the track.
  const scalebars = !domain ? null : scalebarsShown ? (
    <g transform={`translate(${scalebarLeft})`}>
      {Array.from({ length: numRows }).map((_, idx) => (
        <g
          // eslint-disable-next-line @eslint-react/no-array-index-key -- fixed positional list, one scalebar per source row
          key={`scalebar-${idx}`}
          transform={`translate(0 ${getRowTop(idx, effectiveRowHeight)})`}
        >
          {/* insetLabels because these rows stack edge to edge (`ticks` is
              built with offset 0, see the model): a label centered on a row's
              own top or bottom tick straddles the boundary, so the first row's
              top label and the last row's bottom label are half-clipped by the
              track's <svg> and every boundary between them draws two labels on
              the same pixels. */}
          <YScaleBar ticks={ticks} orientation="left" insetLabels />
        </g>
      ))}
    </g>
  ) : (
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
  )

  return (
    <>
      {labels}
      {scalebars}
    </>
  )
})
